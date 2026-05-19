import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
config({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });
import express from "express";
import cors from "cors";
import multer from "multer";
import { randomBytes } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendOtpEmail, sendInviteEmail } from "./email.js";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";

// ── Rate limiters (applied per-route below) ───────────────────────────────────
// Auth'd routes key by user ID; IP is the fallback (ipKeyGenerator handles IPv6 safely)
const queryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  keyGenerator: req => req.user?.id ?? ipKeyGenerator(req),
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
const forgeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: req => req.user?.id ?? ipKeyGenerator(req),
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many Forge requests. Please try again later." },
});
const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  keyGenerator: req => req.user?.id ?? ipKeyGenerator(req),
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many checkout attempts. Please wait a moment." },
});
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  keyGenerator: req => ipKeyGenerator(req),
  standardHeaders: true, legacyHeaders: false,
});

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`\n❌ Missing required env vars: ${missing.join(", ")}`);
  console.error("   Add them to server/.env and restart.\n");
  process.exit(1);
}

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Stripe ────────────────────────────────────────────────────────────────────
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// ── Supabase clients ──────────────────────────────────────────────────────────
// Service-role client: bypasses RLS, used for all server-side mutations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Anon client: used only to verify user JWTs
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ── Middleware ────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  process.env.CLIENT_ORIGIN,           // https://scholr.dev
  "https://scholr.dev",
  "https://www.scholr.dev",
].filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    // Allow non-browser requests (curl, Railway healthcheck, server-to-server)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Stripe webhook — raw body MUST be parsed before express.json() ────────────
app.post("/api/webhooks/stripe", webhookLimiter, express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return res.status(400).json({ error: "Stripe webhook not configured" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (!subscriptionId) {
          console.log("[stripe] checkout.session.completed: no subscription ID (one-time payment?), skipping");
          break;
        }

        // Look up userId via customer first, then fall back to client_reference_id
        let userId = await getUserIdByStripeCustomer(customerId);
        if (!userId && session.client_reference_id) {
          userId = session.client_reference_id;
          console.log(`[stripe] userId from client_reference_id: ${userId}`);
        }

        if (!userId) {
          console.error(`[stripe] checkout.session.completed: no userId found for customer=${customerId}`);
          break;
        }

        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
        const rawEnd = stripeSub.current_period_end;
        const periodEnd = rawEnd ? new Date(rawEnd * 1000).toISOString() : null;

        await supabase.from("subscriptions").upsert({
          user_id: userId,
          tier: "pro",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        console.log(`[stripe] checkout.session.completed: user=${userId} → pro, period_end=${periodEnd}`);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const isActive = sub.status === "active" || sub.status === "trialing";
        const rawEnd = sub.current_period_end;
        const periodEnd = rawEnd ? new Date(rawEnd * 1000).toISOString() : null;
        await supabase.from("subscriptions")
          .update({
            tier: isActive ? "pro" : "free",
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", sub.id);
        console.log(`[stripe] subscription.updated: id=${sub.id} status=${sub.status} tier=${isActive ? "pro" : "free"}`);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await supabase.from("subscriptions")
          .update({ tier: "free", stripe_subscription_id: null, updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", sub.id);
        console.log(`[stripe] subscription.deleted: id=${sub.id} → free`);
        break;
      }
      default:
        console.log(`[stripe] unhandled event: ${event.type}`);
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

app.use(express.json());

// Attach authenticated user to req.user from Supabase JWT in Authorization header.
// Routes that need auth call this middleware explicitly.
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  console.log("requireAuth: checking token for", req.method, req.path);
  console.log("requireAuth: token present:", !!token);
  if (!token) {
    console.warn(`requireAuth: no token on ${req.method} ${req.path}`);
    return res.status(401).json({ error: "Missing auth token" });
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) {
    console.log("requireAuth: verification failed:", error?.message ?? "no user returned");
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = data.user;
  next();
}

// Verify the caller is a member of the given notebook.
async function requireMember(req, res, next) {
  const { data, error } = await supabase
    .from("notebook_members")
    .select("role")
    .eq("notebook_id", req.params.id)
    .eq("user_id", req.user.id)
    .maybeSingle();

  if (error) {
    console.error(`requireMember: DB error for notebook=${req.params.id} user=${req.user.id}:`, error);
    return res.status(500).json({ error: "Membership check failed" });
  }
  if (!data) {
    console.warn(`requireMember: DENIED — user=${req.user.id} is not a member of notebook=${req.params.id}`);
    return res.status(403).json({ error: "Not a member of this notebook" });
  }
  req.membership = data; // { role: 'owner' | 'member' }
  next();
}

// ── Subscription & usage helpers ─────────────────────────────────────────────

async function getUserIdByStripeCustomer(customerId) {
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}

async function getUserTier(userId) {
  const { data } = await supabase
    .from("subscriptions")
    .select("tier, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.tier === "pro" && data?.current_period_end && new Date(data.current_period_end) > new Date()) {
    return "pro";
  }
  return "free";
}

function getModel(tier) {
  return tier === "pro" ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001";
}

async function resetUsageIfNeeded(userId) {
  const { data } = await supabase
    .from("usage")
    .select("id, reset_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (data && new Date(data.reset_at) < new Date()) {
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);
    await supabase.from("usage").update({
      messages_this_month: 0,
      forge_outputs_this_month: 0,
      reset_at: nextReset.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
  }
}

async function checkUsageLimit(userId, type) {
  const tier = await getUserTier(userId);
  if (tier === "pro") return { allowed: true };
  await resetUsageIfNeeded(userId);
  const { data } = await supabase
    .from("usage")
    .select("messages_this_month, forge_outputs_this_month")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return { allowed: true }; // no record yet = new user
  if (type === "message" && (data.messages_this_month ?? 0) >= 75) {
    return { allowed: false, reason: "message_limit" };
  }
  if (type === "forge" && (data.forge_outputs_this_month ?? 0) >= 5) {
    return { allowed: false, reason: "forge_limit" };
  }
  return { allowed: true };
}

async function checkClassLimit(userId) {
  const tier = await getUserTier(userId);
  if (tier === "pro") return { allowed: true };
  const { count, error } = await supabase
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) return { allowed: true }; // fail open
  if ((count ?? 0) >= 3) return { allowed: false, reason: "class_limit" };
  return { allowed: true };
}

async function incrementUsage(userId, type) {
  const field = type === "message" ? "messages_this_month" : "forge_outputs_this_month";
  const { data: existing } = await supabase
    .from("usage")
    .select(`id, ${field}`)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    await supabase.from("usage").update({
      [field]: (existing[field] ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
  } else {
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);
    await supabase.from("usage").insert({
      user_id: userId,
      messages_this_month: type === "message" ? 1 : 0,
      forge_outputs_this_month: type === "forge" ? 1 : 0,
      reset_at: nextReset.toISOString(),
    });
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /healthz — Railway healthcheck
app.get("/healthz", (_, res) => res.json({ ok: true }));

// GET /api/health — env var presence check (values never exposed)
app.get("/api/health", (_, res) => res.json({
  ok: true,
  env: {
    SUPABASE_URL:              !!process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY:         !!process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    CLAUDE_API_KEY:            !!process.env.CLAUDE_API_KEY,
    RESEND_API_KEY:            !!process.env.RESEND_API_KEY,
    CLIENT_ORIGIN:             !!process.env.CLIENT_ORIGIN,
    STRIPE_SECRET_KEY:         !!process.env.STRIPE_SECRET_KEY,
    STRIPE_PRICE_ID:           !!process.env.STRIPE_PRICE_ID,
    STRIPE_WEBHOOK_SECRET:     !!process.env.STRIPE_WEBHOOK_SECRET,
  },
}));

// GET /api/notebooks — list notebooks the user belongs to
app.get("/api/notebooks", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("notebook_members")
    .select(`
      role,
      notebooks (
        id, title, topic, created_by, created_at, due_date, status, class_id,
        notes (count)
      )
    `)
    .eq("user_id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });

  const notebooks = (data ?? []).map(({ role, notebooks: nb }) => ({
    ...nb,
    notes_count: nb.notes[0]?.count ?? 0,
    role,
    notes: undefined,
  }));

  res.json(notebooks);
});

// GET /api/notebooks/shared — notebooks the user was invited to (member, not owner)
app.get("/api/notebooks/shared", requireAuth, async (req, res) => {
  console.log(`[shared] listSharedNotebooks: user=${req.user.id}`);
  const { data, error } = await supabase
    .from("notebook_members")
    .select(`
      role,
      notebooks (
        id, title, topic, created_by, created_at, due_date, status, class_id,
        notes (count)
      )
    `)
    .eq("user_id", req.user.id)
    .eq("role", "member");

  console.log(`[shared] query result: rows=${data?.length ?? 0} error=${error?.message ?? "none"}`);
  if (error) return res.status(500).json({ error: error.message });

  const notebooks = (data ?? []).map(({ role, notebooks: nb }) => ({
    ...nb,
    notes_count: nb.notes[0]?.count ?? 0,
    role,
    notes: undefined,
  }));

  console.log(`[shared] returning ${notebooks.length} shared notebooks for user=${req.user.id}`);
  res.json(notebooks);
});

// GET /api/notebooks/owned — notebooks the calling user created
app.get("/api/notebooks/owned", requireAuth, async (req, res) => {
  // Query notebooks directly by created_by to avoid join embedding issues
  const { data, error } = await supabase
    .from("notebooks")
    .select("id, title, topic, created_by, created_at, due_date, status, class_id, notes(count)")
    .eq("created_by", req.user.id);

  if (error) return res.status(500).json({ error: error.message });

  const notebooks = (data ?? []).map(nb => ({
    ...nb,
    notes_count: nb.notes[0]?.count ?? 0,
    role: "owner",
    notes: undefined,
  }));
  res.json(notebooks);
});

// GET /api/notebooks/starred — notebooks the calling user has starred
app.get("/api/notebooks/starred", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("starred_notebooks")
    .select(`
      notebook_id,
      notebooks (
        id, title, topic, created_by, created_at, due_date, status, class_id,
        notes (count)
      )
    `)
    .eq("user_id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });

  const notebooks = (data ?? []).map(({ notebooks: nb }) => ({
    ...nb,
    notes_count: nb.notes[0]?.count ?? 0,
    notes: undefined,
  }));
  res.json(notebooks);
});

// POST /api/notebooks — create a notebook
app.post("/api/notebooks", requireAuth, async (req, res) => {
  const { title, topic } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });

  const { data: nb, error } = await supabase
    .from("notebooks")
    .insert({ title, topic, created_by: req.user.id })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Creator becomes owner
  await supabase.from("notebook_members").insert({
    notebook_id: nb.id,
    user_id: req.user.id,
    role: "owner",
  });

  res.status(201).json(nb);
});

// GET /api/notebooks/:id/members — list all members with email and role
app.get("/api/notebooks/:id/members", requireAuth, requireMember, async (req, res) => {
  const { data: members, error } = await supabase
    .from("notebook_members")
    .select("user_id, role")
    .eq("notebook_id", req.params.id);

  if (error) return res.status(500).json({ error: error.message });

  // Fetch email + first_name from auth.users via admin API
  const results = await Promise.all(
    (members ?? []).map(async ({ user_id, role }) => {
      const { data } = await supabase.auth.admin.getUserById(user_id);
      return {
        user_id,
        role,
        email:      data?.user?.email ?? null,
        first_name: data?.user?.user_metadata?.full_name?.split(" ")[0]?.trim() ?? null,
      };
    })
  );

  res.json(results.filter(m => m.email));
});

// GET /api/notebooks/:id/messages — fetch shared chat history
app.get("/api/notebooks/:id/messages", requireAuth, requireMember, async (req, res) => {
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, created_at, created_by")
    .eq("notebook_id", req.params.id)
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// POST /api/notebooks/:id/messages — save a message to shared chat history
app.post("/api/notebooks/:id/messages", requireAuth, requireMember, async (req, res) => {
  const { role, content } = req.body;
  if (!role || !content) return res.status(400).json({ error: "role and content are required" });
  if (!["user", "assistant"].includes(role)) return res.status(400).json({ error: "role must be user or assistant" });

  const notebookId = req.params.id;
  const userId = req.user.id;
  console.log("saving message:", { notebookId, role, content: content.slice(0, 80), userId });

  const { data, error } = await supabase
    .from("messages")
    .insert({
      notebook_id: notebookId,
      role,
      content,
      created_by: role === "user" ? userId : null,
    })
    .select("id, role, content, created_at, created_by")
    .single();

  if (error) {
    console.error("failed to save message:", error);
    return res.status(500).json({ error: error.message });
  }
  console.log("message saved with id:", data?.id);
  res.status(201).json(data);

  // Activity log + @mention notifications — fire-and-forget
  if (role === "user") {
    logUserActivity(userId);
    (async () => {
      try {
        const mentions = [...new Set((content.match(/@([A-Za-z][A-Za-z0-9_]*)/g) ?? []).map(m => m.slice(1).toLowerCase()))];
        if (!mentions.length) return;

        const { data: members } = await supabase
          .from("notebook_members")
          .select("user_id")
          .eq("notebook_id", notebookId)
          .neq("user_id", userId);
        if (!members?.length) return;

        // Resolve member first names for matching
        const memberInfo = await Promise.all(members.map(async (m) => {
          const { data: u } = await supabase.auth.admin.getUserById(m.user_id);
          const fullName = u?.user?.user_metadata?.full_name ?? "";
          const first = fullName.split(" ")[0]?.trim() ?? "";
          const emailLocal = u?.user?.email?.split("@")[0] ?? "";
          return { user_id: m.user_id, first: first.toLowerCase(), emailLocal: emailLocal.toLowerCase() };
        }));

        const matched = memberInfo.filter(m =>
          mentions.includes(m.first) || mentions.includes(m.emailLocal)
        );
        if (!matched.length) return;

        // Look up notebook title for the description
        const { data: nb } = await supabase
          .from("notebooks").select("title").eq("id", notebookId).single();
        const { data: actor } = await supabase.auth.admin.getUserById(userId);
        const actorName = actor?.user?.user_metadata?.full_name?.split(" ")[0]?.trim()
          || actor?.user?.email?.split("@")[0]
          || "Someone";

        const { data: activity } = await supabase
          .from("activities")
          .insert({
            notebook_id: notebookId,
            user_id: userId,
            action: "mention",
            description: `${actorName} mentioned you in ${nb?.title ?? "a unit"}`,
          })
          .select("id")
          .single();
        if (!activity) return;

        await supabase.from("notifications").insert(
          matched.map(m => ({ user_id: m.user_id, activity_id: activity.id }))
        );
      } catch (err) {
        console.error("mention notification error:", err);
      }
    })();
  }
});

// POST /api/notebooks/:id/star — toggle star for the calling user
app.post("/api/notebooks/:id/star", requireAuth, requireMember, async (req, res) => {
  const { data: existing } = await supabase
    .from("starred_notebooks")
    .select("id")
    .eq("user_id", req.user.id)
    .eq("notebook_id", req.params.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("starred_notebooks").delete()
      .eq("user_id", req.user.id)
      .eq("notebook_id", req.params.id);
    return res.json({ starred: false });
  }

  const { error } = await supabase.from("starred_notebooks").insert({
    user_id: req.user.id,
    notebook_id: req.params.id,
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ starred: true });
});

// DELETE /api/notebooks/:id — owner-only hard delete
app.delete("/api/notebooks/:id", requireAuth, requireMember, async (req, res) => {
  if (req.membership.role !== "owner")
    return res.status(403).json({ error: "Only the owner can delete this notebook" });

  const { error } = await supabase
    .from("notebooks")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// ── Classes endpoints ─────────────────────────────────────────────────────────

// GET /api/classes — list the calling user's classes
app.get("/api/classes", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("classes")
    .select("id, title, color, created_at")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// POST /api/classes — create a class
app.post("/api/classes", requireAuth, async (req, res) => {
  const { title, color } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });

  const classLimit = await checkClassLimit(req.user.id);
  if (!classLimit.allowed) {
    return res.status(403).json({
      error: "class_limit_reached",
      message: "Free accounts are limited to 3 classes. Upgrade to Pro for unlimited.",
    });
  }

  const { data, error } = await supabase
    .from("classes")
    .insert({ user_id: req.user.id, title, color: color || "#A78BFA" })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/classes/:id/color — update a class's color (owner only)
app.patch("/api/classes/:id/color", requireAuth, async (req, res) => {
  const { color } = req.body;
  if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return res.status(400).json({ error: "color must be a 6-digit hex string (e.g. #A78BFA)" });
  }
  const { data: cls } = await supabase
    .from("classes")
    .select("id")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (!cls) return res.status(403).json({ error: "Class not found or not authorized" });

  const { data, error } = await supabase
    .from("classes")
    .update({ color })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/classes/:id/notebooks — list units inside a class
app.get("/api/classes/:id/notebooks", requireAuth, async (req, res) => {
  const { data: cls } = await supabase
    .from("classes")
    .select("id")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (!cls) return res.status(403).json({ error: "Class not found" });

  const { data, error } = await supabase
    .from("notebooks")
    .select("id, title, topic, created_at, due_date, status, class_id, notes(count)")
    .eq("class_id", req.params.id)
    .order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  res.json((data ?? []).map(nb => ({
    ...nb,
    notes_count: nb.notes[0]?.count ?? 0,
    notes: undefined,
  })));
});

// POST /api/classes/:id/notebooks — create a unit inside a class
app.post("/api/classes/:id/notebooks", requireAuth, async (req, res) => {
  const { title, topic } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });

  const { data: cls } = await supabase
    .from("classes")
    .select("id")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (!cls) return res.status(403).json({ error: "Class not found" });

  const { data: nb, error } = await supabase
    .from("notebooks")
    .insert({ title, topic, created_by: req.user.id, class_id: req.params.id })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from("notebook_members").insert({
    notebook_id: nb.id, user_id: req.user.id, role: "owner",
  });

  res.status(201).json(nb);
});

// DELETE /api/classes/:id — delete a class and all its notebooks/units
app.delete("/api/classes/:id", requireAuth, async (req, res) => {
  const { data: cls } = await supabase
    .from("classes")
    .select("id")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (!cls) return res.status(403).json({ error: "Class not found or not authorized" });

  const { error } = await supabase
    .from("classes")
    .delete()
    .eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ success: true, message: "Class deleted" });
});

// POST /api/notebooks/:id/invite — return (or regenerate) an invite link
app.post("/api/notebooks/:id/invite", requireAuth, requireMember, async (req, res) => {
  if (req.membership.role !== "owner")
    return res.status(403).json({ error: "Only owners can generate invite links" });

  // Optionally regenerate the token
  if (req.body.regenerate) {
    await supabase
      .from("notebooks")
      .update({ invite_token: null }) // triggers default gen_random_bytes
      .eq("id", req.params.id);
  }

  const { data, error } = await supabase
    .from("notebooks")
    .select("invite_token")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const inviteUrl = `${process.env.CLIENT_ORIGIN}/join/${data.invite_token}`;
  res.json({ invite_url: inviteUrl, token: data.invite_token });
});


// GET /api/notebooks/:id/notes — list ALL notes in a notebook (all members see all notes)
app.get("/api/notebooks/:id/notes", requireAuth, requireMember, async (req, res) => {
  const { data, error } = await supabase
    .from("notes")
    .select("id, title, content, file_url, created_at")
    .eq("notebook_id", req.params.id)  // no user_id filter — members see every note
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`listNotes: query error for notebook=${req.params.id}:`, error);
    return res.status(500).json({ error: error.message });
  }
  console.log(`listNotes: notebook=${req.params.id} role=${req.membership.role} found=${data?.length ?? 0} notes`);
  res.json(data ?? []);
});

// POST /api/notebooks/:id/notes — upload a note (text and/or file)
app.post(
  "/api/notebooks/:id/notes",
  requireAuth,
  requireMember,
  upload.single("file"),
  async (req, res) => {
    const { title } = req.body;
    let fileUrl = null;
    let content = req.body.content ?? null;

    if (req.file) {
      const path = `${req.params.id}/${Date.now()}_${req.file.originalname}`;
      const { error: uploadError } = await supabase.storage
        .from("scholr")
        .upload(path, req.file.buffer, { contentType: req.file.mimetype });

      if (uploadError) return res.status(500).json({ error: uploadError.message });

      const { data: urlData } = supabase.storage.from("scholr").getPublicUrl(path);
      fileUrl = urlData.publicUrl;

      // Extract text from the file buffer so the AI can read it
      const mime = req.file.mimetype;
      const name = req.file.originalname.toLowerCase();

      if (mime === "text/plain" || name.endsWith(".txt") || name.endsWith(".md")) {
        content = req.file.buffer.toString("utf-8");
      } else if (mime === "application/pdf" || name.endsWith(".pdf")) {
        try {
          const { default: pdfParse } = await import("pdf-parse");
          const parsed = await pdfParse(req.file.buffer);
          content = parsed.text.trim() || "[PDF had no extractable text]";
        } catch {
          content = "[PDF — text extraction failed]";
        }
      } else if (mime.startsWith("image/")) {
        content = "[image attachment]";
      } else {
        content = "[file attachment]";
      }
    }

    const { data, error } = await supabase
      .from("notes")
      .insert({
        notebook_id: req.params.id,
        uploader_id: req.user.id,
        title,
        content,
        file_url: fileUrl,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);

    // Bump daily activity for streak/heatmap
    logUserActivity(req.user.id);

    // Fire-and-forget: log activity and notify other members
    (async () => {
      try {
        const noteTitle = title || req.file?.originalname || "note";

        // Look up uploader's first name for a human-readable description
        const { data: uploaderData } = await supabase.auth.admin.getUserById(req.user.id);
        const uploaderName = uploaderData?.user?.user_metadata?.full_name?.split(" ")[0]?.trim()
          || uploaderData?.user?.email?.split("@")[0]
          || "Someone";

        const notebookId = req.params.id;
        const userId = req.user.id;
        const description = `${uploaderName} uploaded: ${noteTitle}`;
        console.log("creating activity:", { notebookId, action: "note_uploaded", description, userId });

        const { data: activity, error: activityError } = await supabase
          .from("activities")
          .insert({
            notebook_id: notebookId,
            user_id: userId,
            action: "note_uploaded",
            description,
          })
          .select("id")
          .single();

        if (activityError) {
          console.error("activity/notification error (activity insert):", activityError);
          return;
        }
        console.log("activity created:", activity?.id);

        if (!activity) { console.warn("activity insert returned no row"); return; }

        const { data: otherMembers, error: membersError } = await supabase
          .from("notebook_members")
          .select("user_id")
          .eq("notebook_id", notebookId)
          .neq("user_id", userId);

        if (membersError) {
          console.error("activity/notification error (members query):", membersError);
          return;
        }

        console.log("inserting notifications for", otherMembers?.length ?? 0, "members");

        if (otherMembers?.length) {
          const { error: notifError } = await supabase.from("notifications").insert(
            otherMembers.map(m => ({ user_id: m.user_id, activity_id: activity.id }))
          );
          if (notifError) console.error("activity/notification error (notifications insert):", notifError);
        }
      } catch (err) {
        console.error("activity/notification error:", err);
      }
    })();
  }
);

// GET /api/notifications — unread notifications for the current user
app.get("/api/notifications", requireAuth, async (req, res) => {
  console.log("fetching notifications for user:", req.user.id);
  const { data, error } = await supabase
    .from("notifications")
    .select(`
      id, is_read, created_at,
      activities (
        action, description, created_at,
        notebooks ( title )
      )
    `)
    .eq("user_id", req.user.id)
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("notifications query error:", error);
    return res.status(500).json({ error: error.message });
  }
  console.log("found notifications:", data?.length ?? 0);
  res.json(data ?? []);
});

// PATCH /api/notifications/clear-all — mark all unread notifications as read
app.patch("/api/notifications/clear-all", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", req.user.id)
    .eq("is_read", false)
    .select("id");

  if (error) return res.status(500).json({ error: error.message });
  res.json({ cleared: data?.length ?? 0 });
});

// POST /api/notebooks/:id/query — AI query against notebook notes (Derek chat)
app.post("/api/notebooks/:id/query", requireAuth, requireMember, queryLimiter, async (req, res) => {
  const { question } = req.body;
  const claudeKey = process.env.CLAUDE_API_KEY || req.headers["x-claude-key"];

  if (!question) return res.status(400).json({ error: "question is required" });
  if (!claudeKey) return res.status(400).json({ error: "Claude API key not configured on server" });

  // Usage limit check
  const userId = req.user.id;
  const usageCheck = await checkUsageLimit(userId, "message");
  if (!usageCheck.allowed) {
    return res.status(403).json({
      error: "message_limit_reached",
      message: "You have reached your 75 message limit for this month. Upgrade to Pro for unlimited messages.",
    });
  }

  const tier = await getUserTier(userId);
  const model = getModel(tier);

  // Pull all text notes for this notebook
  const { data: notes, error } = await supabase
    .from("notes")
    .select("title, content, created_at")
    .eq("notebook_id", req.params.id)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) return res.status(500).json({ error: error.message });

  const { data: nb } = await supabase
    .from("notebooks")
    .select("title, topic")
    .eq("id", req.params.id)
    .single();

  const notesContext = notes
    .map((n) => {
      const body = n.content ? n.content : "[file attachment — no text content]";
      return `Note: ${n.title || "Untitled"}\n${body}`;
    })
    .join("\n\n---\n\n");

  const anthropic = new Anthropic({ apiKey: claudeKey });

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: `You are a friendly study assistant for a notebook called "${nb?.title}" on the topic "${nb?.topic}". Answer the student's questions using the notes below as your source of truth. Write in plain conversational text like a helpful human tutor — no markdown, no asterisks, no pound signs, no bullet dashes, no headers, no bold. Just natural sentences and paragraphs. Keep answers concise. When you reference specific information from the notes, mention the source note title naturally. Example: "Based on the lecture notes titled 'Biology 101 Midterm Review', the mitochondria..." This helps the student trace facts back to their notes.\n\nNOTEBOOK NOTES:\n${notesContext || "(no notes uploaded yet)"}`,
      messages: [{ role: "user", content: question }],
    });

    const answer = message.content.find((b) => b.type === "text")?.text ?? "";
    const sources = (notes ?? [])
      .filter(n => n.title && answer.toLowerCase().includes(n.title.toLowerCase()))
      .map(n => n.title);
    res.json({ answer, sources });

    // Increment usage counter fire-and-forget
    incrementUsage(userId, "message").catch(err => console.error("usage increment error:", err));
  } catch (err) {
    if (err.status === 401) return res.status(400).json({ error: "Invalid Claude API key" });
    console.error("[query] Claude error:", err);
    res.status(500).json({ error: "Failed to get answer. Please try again." });
  }
});

// POST /api/notebooks/:id/forge — generate study materials with streaming SSE
app.post("/api/notebooks/:id/forge", requireAuth, requireMember, forgeLimiter, async (req, res) => {
  const { action, topic } = req.body;
  const claudeKey = process.env.CLAUDE_API_KEY || req.headers["x-claude-key"];

  const VALID_ACTIONS = ["study_guide", "questions", "flashcards", "summary"];
  if (!action || !VALID_ACTIONS.includes(action))
    return res.status(400).json({ error: "action must be one of: " + VALID_ACTIONS.join(", ") });
  if (!claudeKey)
    return res.status(400).json({ error: "Claude API key not configured on server" });

  // Usage limit check (before starting stream)
  const forgeUsage = await checkUsageLimit(req.user.id, "forge");
  if (!forgeUsage.allowed) {
    return res.status(403).json({
      error: "forge_limit_reached",
      message: "You have reached your 5 Forge output limit this month. Upgrade to Pro for unlimited.",
    });
  }

  const tier = await getUserTier(req.user.id);
  const forgeModel = getModel(tier);

  const { data: notes, error } = await supabase
    .from("notes")
    .select("title, content, created_at")
    .eq("notebook_id", req.params.id)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) return res.status(500).json({ error: error.message });

  const { data: nb } = await supabase
    .from("notebooks")
    .select("title, topic")
    .eq("id", req.params.id)
    .single();

  const notesContext = notes
    .map((n) => `Note: ${n.title || "Untitled"}\n${n.content || "[file attachment — no text content]"}`)
    .join("\n\n---\n\n");

  const focusStr = topic ? ` Focus specifically on: ${topic}.` : "";

  const prompts = {
    study_guide: `Create a comprehensive study guide from these notes.${focusStr} Write in plain text with no markdown, no # headers, no ** bold, no bullet dashes. Use natural section labels like "Key Concepts:" or "Important Definitions:" followed by a blank line. Use short paragraphs and simple numbered lists where helpful. Be thorough and educational.`,
    questions: `Generate 10 practice questions based on these notes.${focusStr} Write as a plain numbered list: "1. Question here" then a blank line between each. After all 10 questions, write "Answers:" on its own line followed by numbered answers. No markdown, no bold, no special formatting — just clean plain text.`,
    flashcards: `Create 10 flashcards based on these notes.${focusStr} Return ONLY a valid JSON array — no markdown, no explanation, no other text before or after the array. Exact format: [{"question": "...", "answer": "..."}, ...]. Cover the most important concepts.`,
    summary: `Write a clear, concise 2-3 paragraph summary of the main concepts from these notes.${focusStr} Write in plain prose with no markdown, no bullet points, no headers, no bold or asterisks. Just natural, readable paragraphs that a student could read and understand immediately.`,
  };

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const anthropic = new Anthropic({ apiKey: claudeKey });

  let stream;
  req.on("close", () => { try { stream?.controller?.abort(); } catch {} });

  try {
    stream = anthropic.messages.stream({
      model: forgeModel,
      max_tokens: 2048,
      system: `You are a study material generator for a notebook called "${nb?.title}" on the topic "${nb?.topic}". Generate high-quality, accurate study materials based solely on the notebook notes provided below. CRITICAL: Never use markdown formatting — no #, ##, **, *, -, or other markdown symbols. Write in plain, clean text only.\n\nNOTEBOOK NOTES:\n${notesContext || "(no notes uploaded yet)"}`,
      messages: [{ role: "user", content: prompts[action] }],
    });

    stream.on("text", (text) => {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    });

    await stream.finalMessage();
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    // Increment forge usage fire-and-forget
    incrementUsage(req.user.id, "forge").catch(err => console.error("forge usage increment error:", err));
  } catch (err) {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

// POST /api/notebooks/:id/forge-output — save a Forge-generated output
app.post("/api/notebooks/:id/forge-output", requireAuth, requireMember, async (req, res) => {
  const { type, content, topic, dateLabel } = req.body;
  console.log("saving forge output:", { type, notebookId: req.params.id, contentLength: content?.length });
  const VALID_TYPES = ["study_guide", "questions", "flashcards", "summary"];
  if (!type || !VALID_TYPES.includes(type)) return res.status(400).json({ error: "Invalid type" });
  if (!content) return res.status(400).json({ error: "content is required" });

  const labels = { study_guide: "Study Guide", questions: "Questions", flashcards: "Flashcards", summary: "Summary" };
  // Prefer the user's local date label (the server runs in UTC and would otherwise
  // embed a future-day date for users in earlier timezones near midnight UTC).
  // Lightly validate the shape before trusting it.
  const looksLikeDate = typeof dateLabel === "string" && /^[A-Za-z]+ \d{1,2}, \d{4}$/.test(dateLabel);
  const date = looksLikeDate
    ? dateLabel
    : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const title = `${labels[type]}${topic ? ` — ${topic}` : ""} — ${date}`;

  const { data, error } = await supabase
    .from("forge_outputs")
    .insert({ notebook_id: req.params.id, user_id: req.user.id, type, title, content })
    .select()
    .single();
  if (error) {
    console.error("forge output save failed:", error);
    return res.status(500).json({ error: error.message });
  }
  console.log("forge output saved:", data?.id);
  res.status(201).json(data);
  logUserActivity(req.user.id);
});

// GET /api/notebooks/:id/forge-outputs — list saved Forge outputs
app.get("/api/notebooks/:id/forge-outputs", requireAuth, requireMember, async (req, res) => {
  const { data, error } = await supabase
    .from("forge_outputs")
    .select("id, type, title, content, created_at")
    .eq("notebook_id", req.params.id)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// DELETE /api/forge-outputs/:id — delete a saved Forge output (owner only)
app.delete("/api/forge-outputs/:id", requireAuth, async (req, res) => {
  const { data: fo } = await supabase
    .from("forge_outputs")
    .select("id")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (!fo) return res.status(403).json({ error: "Not found or not authorized" });

  const { error } = await supabase.from("forge_outputs").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// ── Unit notes endpoints ──────────────────────────────────────────────────────

// GET /api/notebooks/:id/unit-notes — list all member-authored notes on a unit
app.get("/api/notebooks/:id/unit-notes", requireAuth, requireMember, async (req, res) => {
  const { data: rows, error } = await supabase
    .from("unit_notes")
    .select("id, user_id, content, created_at, updated_at")
    .eq("notebook_id", req.params.id)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  // Resolve display name + email per row via auth.admin
  const userIds = [...new Set((rows ?? []).map(r => r.user_id))];
  const userInfo = {};
  await Promise.all(userIds.map(async (uid) => {
    const { data } = await supabase.auth.admin.getUserById(uid);
    userInfo[uid] = {
      email: data?.user?.email ?? null,
      first_name: data?.user?.user_metadata?.full_name?.split(" ")[0]?.trim() ?? null,
      full_name: data?.user?.user_metadata?.full_name ?? null,
    };
  }));

  // Fetch reaction + comment counts in bulk for these notes
  const noteIds = (rows ?? []).map(r => r.id);
  const reactionsByNote = {};
  const commentCountByNote = {};
  if (noteIds.length) {
    const { data: rxRows } = await supabase
      .from("note_reactions")
      .select("unit_note_id, emoji, user_id")
      .in("unit_note_id", noteIds);
    for (const r of rxRows ?? []) {
      (reactionsByNote[r.unit_note_id] ??= []).push({ emoji: r.emoji, user_id: r.user_id });
    }
    const { data: cmRows } = await supabase
      .from("note_comments")
      .select("unit_note_id")
      .in("unit_note_id", noteIds);
    for (const c of cmRows ?? []) {
      commentCountByNote[c.unit_note_id] = (commentCountByNote[c.unit_note_id] ?? 0) + 1;
    }
  }

  res.json((rows ?? []).map(r => ({
    ...r,
    email: userInfo[r.user_id]?.email ?? null,
    first_name: userInfo[r.user_id]?.first_name ?? null,
    full_name: userInfo[r.user_id]?.full_name ?? null,
    reactions: reactionsByNote[r.id] ?? [],
    comment_count: commentCountByNote[r.id] ?? 0,
  })));
});

// POST /api/notebooks/:id/unit-notes — add a note to this unit
app.post("/api/notebooks/:id/unit-notes", requireAuth, requireMember, async (req, res) => {
  const { content } = req.body;
  if (typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "content is required" });
  }
  const trimmed = content.trim().slice(0, 2000);

  const { data, error } = await supabase
    .from("unit_notes")
    .insert({ notebook_id: req.params.id, user_id: req.user.id, content: trimmed })
    .select("id, user_id, content, created_at, updated_at")
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Resolve user info for the new note before returning
  const { data: u } = await supabase.auth.admin.getUserById(req.user.id);
  res.status(201).json({
    ...data,
    email: u?.user?.email ?? null,
    first_name: u?.user?.user_metadata?.full_name?.split(" ")[0]?.trim() ?? null,
    full_name: u?.user?.user_metadata?.full_name ?? null,
    reactions: [],
    comment_count: 0,
  });
  logUserActivity(req.user.id);
});

// DELETE /api/unit-notes/:id — delete a unit note (author only)
app.delete("/api/unit-notes/:id", requireAuth, async (req, res) => {
  const { data: note } = await supabase
    .from("unit_notes")
    .select("id")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (!note) return res.status(403).json({ error: "Not found or not authorized" });

  const { error } = await supabase.from("unit_notes").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// ── Invite endpoints ──────────────────────────────────────────────────────────

// POST /api/notebooks/:id/invites — send an email invite to a collaborator
app.post("/api/notebooks/:id/invites", requireAuth, requireMember, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes("@")) return res.status(400).json({ error: "A valid email is required" });

    // Look up notebook + class name for the email
    const { data: nb, error: nbError } = await supabase
      .from("notebooks")
      .select("title, classes(title)")
      .eq("id", req.params.id)
      .single();

    if (nbError) console.error("Invite: notebook lookup error:", nbError.message);

    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .insert({ notebook_id: req.params.id, created_by: req.user.id, email })
      .select("token")
      .single();

    if (inviteError) return res.status(500).json({ error: inviteError.message });

    const baseUrl = process.env.CLIENT_ORIGIN?.startsWith("http://localhost")
      ? "https://scholr.dev"
      : (process.env.CLIENT_ORIGIN || "https://scholr.dev");
    const inviteUrl = `${baseUrl}/invite/${invite.token}`;

    console.log(`[invite] sending to ${email} — url: ${inviteUrl}`);

    await sendInviteEmail(
      email,
      req.user.email,
      nb?.title ?? "a unit",
      nb?.classes?.title ?? null,
      inviteUrl,
    );

    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Invite endpoint error:", err);
    res.status(500).json({ error: "Failed to send invite email. Please try again." });
  }
});

// GET /api/invite/:token — public: return notebook + class name for join page
app.get("/api/invite/:token", async (req, res) => {
  const { data, error } = await supabase
    .from("invites")
    .select("notebook_id, notebooks(id, title, classes(title))")
    .eq("token", req.params.token)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Invite not found" });

  res.json({
    notebook_id:    data.notebook_id,
    notebook_title: data.notebooks.title,
    class_title:    data.notebooks.classes?.title ?? null,
  });
});

// POST /api/invite/:token/accept — authenticated: join the notebook as member
app.post("/api/invite/:token/accept", requireAuth, async (req, res) => {
  const { data: invite, error } = await supabase
    .from("invites")
    .select("notebook_id, notebooks(title)")
    .eq("token", req.params.token)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!invite) return res.status(404).json({ error: "Invalid or expired invite link" });

  const { error: upsertError } = await supabase.from("notebook_members").upsert(
    { notebook_id: invite.notebook_id, user_id: req.user.id, role: "member" },
    { onConflict: "notebook_id,user_id" }
  );

  if (upsertError) {
    console.error("acceptInvite: failed to add member:", upsertError);
    return res.status(500).json({ error: "Failed to join notebook: " + upsertError.message });
  }

  console.log(`[invite] accepted — user ${req.user.id} joined notebook ${invite.notebook_id}`);
  res.json({ notebook_id: invite.notebook_id, title: invite.notebooks?.title });
});

// ── Activity logging helper ───────────────────────────────────────────────
// Bumps the user's daily_activity counter for today (server-local date).
// Fire-and-forget — never blocks the request.
async function logUserActivity(userId) {
  if (!userId) return;
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const { data: existing } = await supabase
      .from("daily_activity")
      .select("id, activity_count")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("daily_activity")
        .update({ activity_count: (existing.activity_count ?? 0) + 1 })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("daily_activity")
        .insert({ user_id: userId, date: today, activity_count: 1 });
    }
  } catch (err) {
    console.error("logUserActivity error:", err.message);
  }
}

// ── Activity heatmap ──────────────────────────────────────────────────────
// GET /api/user/activity-heatmap — last 365 days of activity for current user
app.get("/api/user/activity-heatmap", requireAuth, async (req, res) => {
  const start = new Date();
  start.setDate(start.getDate() - 365);
  const startStr = start.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("daily_activity")
    .select("date, activity_count")
    .eq("user_id", req.user.id)
    .gte("date", startStr)
    .order("date", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data ?? []).map(r => ({ date: r.date, count: r.activity_count ?? 0 })));
});

// ── Reactions on unit notes ───────────────────────────────────────────────
// POST /api/unit-notes/:id/react — body: { emoji }
app.post("/api/unit-notes/:id/react", requireAuth, async (req, res) => {
  const { emoji } = req.body;
  if (typeof emoji !== "string" || !emoji.trim()) {
    return res.status(400).json({ error: "emoji is required" });
  }
  // Verify access: caller must be a member of the note's notebook
  const { data: note } = await supabase
    .from("unit_notes")
    .select("id, notebook_id")
    .eq("id", req.params.id)
    .maybeSingle();
  if (!note) return res.status(404).json({ error: "Note not found" });
  const { data: mem } = await supabase
    .from("notebook_members")
    .select("role")
    .eq("notebook_id", note.notebook_id)
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (!mem) return res.status(403).json({ error: "Not a member" });

  const { data, error } = await supabase
    .from("note_reactions")
    .upsert(
      { unit_note_id: req.params.id, user_id: req.user.id, emoji: emoji.trim() },
      { onConflict: "unit_note_id,user_id,emoji" }
    )
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// DELETE /api/unit-notes/:id/react/:emoji — remove user's reaction
app.delete("/api/unit-notes/:id/react/:emoji", requireAuth, async (req, res) => {
  const emoji = decodeURIComponent(req.params.emoji);
  const { error } = await supabase
    .from("note_reactions")
    .delete()
    .eq("unit_note_id", req.params.id)
    .eq("user_id", req.user.id)
    .eq("emoji", emoji);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// GET /api/unit-notes/:id/reactions — list reactions for a note (with names)
app.get("/api/unit-notes/:id/reactions", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("note_reactions")
    .select("id, emoji, user_id, created_at")
    .eq("unit_note_id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  const userIds = [...new Set((data ?? []).map(r => r.user_id))];
  const info = {};
  await Promise.all(userIds.map(async (uid) => {
    const { data: u } = await supabase.auth.admin.getUserById(uid);
    info[uid] = {
      first_name: u?.user?.user_metadata?.full_name?.split(" ")[0]?.trim() ?? null,
      email: u?.user?.email ?? null,
    };
  }));
  res.json((data ?? []).map(r => ({
    ...r,
    first_name: info[r.user_id]?.first_name ?? null,
    email: info[r.user_id]?.email ?? null,
  })));
});

// ── Comments on unit notes ────────────────────────────────────────────────
// POST /api/unit-notes/:id/comments — body: { content }
app.post("/api/unit-notes/:id/comments", requireAuth, async (req, res) => {
  const { content } = req.body;
  if (typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "content is required" });
  }
  // Membership check via the note's notebook
  const { data: note } = await supabase
    .from("unit_notes")
    .select("id, notebook_id")
    .eq("id", req.params.id)
    .maybeSingle();
  if (!note) return res.status(404).json({ error: "Note not found" });
  const { data: mem } = await supabase
    .from("notebook_members")
    .select("role")
    .eq("notebook_id", note.notebook_id)
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (!mem) return res.status(403).json({ error: "Not a member" });

  const trimmed = content.trim().slice(0, 2000);
  const { data, error } = await supabase
    .from("note_comments")
    .insert({ unit_note_id: req.params.id, user_id: req.user.id, content: trimmed })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  const { data: u } = await supabase.auth.admin.getUserById(req.user.id);
  res.status(201).json({
    ...data,
    first_name: u?.user?.user_metadata?.full_name?.split(" ")[0]?.trim() ?? null,
    full_name: u?.user?.user_metadata?.full_name ?? null,
    email: u?.user?.email ?? null,
  });
});

// GET /api/unit-notes/:id/comments — list comments with user info
app.get("/api/unit-notes/:id/comments", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("note_comments")
    .select("id, user_id, content, created_at")
    .eq("unit_note_id", req.params.id)
    .order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  const userIds = [...new Set((data ?? []).map(r => r.user_id))];
  const info = {};
  await Promise.all(userIds.map(async (uid) => {
    const { data: u } = await supabase.auth.admin.getUserById(uid);
    info[uid] = {
      first_name: u?.user?.user_metadata?.full_name?.split(" ")[0]?.trim() ?? null,
      full_name: u?.user?.user_metadata?.full_name ?? null,
      email: u?.user?.email ?? null,
    };
  }));
  res.json((data ?? []).map(r => ({
    ...r,
    first_name: info[r.user_id]?.first_name ?? null,
    full_name: info[r.user_id]?.full_name ?? null,
    email: info[r.user_id]?.email ?? null,
  })));
});

// DELETE /api/note-comments/:id — delete a comment (author only)
app.delete("/api/note-comments/:id", requireAuth, async (req, res) => {
  const { data: c } = await supabase
    .from("note_comments")
    .select("id")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (!c) return res.status(403).json({ error: "Not found or not authorized" });
  const { error } = await supabase.from("note_comments").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// ── Due date and status on notebooks ──────────────────────────────────────
// PATCH /api/notebooks/:id/due-date — body: { due_date }
app.patch("/api/notebooks/:id/due-date", requireAuth, requireMember, async (req, res) => {
  const { due_date } = req.body;
  // Allow null to clear, otherwise must be a valid ISO string
  if (due_date !== null && (typeof due_date !== "string" || isNaN(Date.parse(due_date)))) {
    return res.status(400).json({ error: "due_date must be an ISO date string or null" });
  }
  const { data, error } = await supabase
    .from("notebooks")
    .update({ due_date })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/notebooks/:id/status — body: { status }
app.patch("/api/notebooks/:id/status", requireAuth, requireMember, async (req, res) => {
  const { status } = req.body;
  const VALID = ["in_progress", "done", "need_help"];
  if (!VALID.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID.join(", ")}` });
  }
  const { data, error } = await supabase
    .from("notebooks")
    .update({ status })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Explain Differently ───────────────────────────────────────────────────
// POST /api/notebooks/:id/explain-differently — body: { messageId, level }
app.post("/api/notebooks/:id/explain-differently", requireAuth, requireMember, async (req, res) => {
  const { messageId, level } = req.body;
  const VALID = ["simpler", "more_advanced", "different_angle"];
  if (!VALID.includes(level)) {
    return res.status(400).json({ error: `level must be one of: ${VALID.join(", ")}` });
  }
  const claudeKey = process.env.CLAUDE_API_KEY || req.headers["x-claude-key"];
  if (!claudeKey) return res.status(400).json({ error: "Claude API key not configured on server" });

  // Fetch the original assistant message
  const { data: orig } = await supabase
    .from("messages")
    .select("id, role, content")
    .eq("id", messageId)
    .eq("notebook_id", req.params.id)
    .maybeSingle();
  if (!orig) return res.status(404).json({ error: "Original message not found" });

  // Fetch notes for context
  const { data: notes } = await supabase
    .from("notes")
    .select("title, content")
    .eq("notebook_id", req.params.id)
    .order("created_at", { ascending: false })
    .limit(40);

  const { data: nb } = await supabase
    .from("notebooks")
    .select("title, topic")
    .eq("id", req.params.id)
    .single();

  const notesContext = (notes ?? [])
    .map(n => `Note: ${n.title || "Untitled"}\n${n.content || "[file attachment — no text content]"}`)
    .join("\n\n---\n\n");

  const directives = {
    simpler: "Re-explain the previous answer as if I'm a 10-year-old. Use simple words and friendly analogies. No jargon.",
    more_advanced: "Re-explain the previous answer at a more rigorous, technical level. Use precise terminology and dive deeper into mechanisms.",
    different_angle: "Re-explain the previous answer from a different perspective or angle — try a different mental model or framing.",
  };

  const explainTier = await getUserTier(req.user.id);
  const explainModel = getModel(explainTier);
  const anthropic = new Anthropic({ apiKey: claudeKey });
  try {
    const message = await anthropic.messages.create({
      model: explainModel,
      max_tokens: 1024,
      system: `You are Derek, a friendly study assistant for a notebook called "${nb?.title}" on the topic "${nb?.topic}". Answer using the notes below. Write in plain conversational text — no markdown, no asterisks, no headers.\n\nNOTEBOOK NOTES:\n${notesContext || "(no notes uploaded yet)"}`,
      messages: [
        { role: "assistant", content: orig.content },
        { role: "user", content: directives[level] },
      ],
    });
    const answer = message.content.find(b => b.type === "text")?.text ?? "";
    res.json({ answer });
  } catch (err) {
    if (err.status === 401) return res.status(400).json({ error: "Invalid Claude API key" });
    console.error("[explain] Claude error:", err);
    res.status(500).json({ error: "Failed to generate explanation. Please try again." });
  }
});

// ── OTP helpers ──────────────────────────────────────────────────────────────

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken() {
  return randomBytes(32).toString("hex");
}

async function invalidateOldCodes(email, type) {
  await supabase
    .from("verification_codes")
    .update({ used: true })
    .eq("email", email)
    .eq("type", type)
    .eq("used", false);
}

// POST /api/auth/send-otp — generate & email a 6-digit code
// type: "signup" | "password_reset"
app.post("/api/auth/send-otp", async (req, res) => {
  const { email, type } = req.body;
  if (!email || !type) return res.status(400).json({ error: "email and type are required" });
  if (!["signup", "password_reset"].includes(type))
    return res.status(400).json({ error: "Invalid type" });

  let userId = null;

  if (type === "signup") {
    const { data: existing } = await supabase.rpc("get_user_id_by_email", { target_email: email });
    if (existing) return res.status(400).json({ error: "An account with this email already exists. Please log in instead." });
  } else {
    const { data: uid } = await supabase.rpc("get_user_id_by_email", { target_email: email });
    if (!uid) return res.json({ ok: true }); // don't reveal whether email is registered
    userId = uid;
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await invalidateOldCodes(email, type);

  const { error: insertErr } = await supabase.from("verification_codes").insert({
    email, code, type, user_id: userId, expires_at: expiresAt,
  });
  if (insertErr) return res.status(500).json({ error: "Failed to generate code" });

  try {
    await sendOtpEmail(email, code, type);
  } catch (err) {
    console.error("Email send error:", err.message);
    return res.status(500).json({ error: "Failed to send verification email. Check RESEND_API_KEY." });
  }

  res.json({ ok: true });
});

// POST /api/auth/verify-otp — validate code; create user (signup) or return reset token (password_reset)
app.post("/api/auth/verify-otp", async (req, res) => {
  const { email, code, type, password, fullName } = req.body;
  if (!email || !code || !type) return res.status(400).json({ error: "email, code, and type are required" });

  const { data: row } = await supabase
    .from("verification_codes")
    .select("id, user_id")
    .eq("email", email)
    .eq("code", code)
    .eq("type", type)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return res.status(400).json({ error: "Invalid or expired verification code." });

  if (type === "signup") {
    if (!password) return res.status(400).json({ error: "password is required" });

    const { error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName?.trim() ?? "" },
    });

    if (createErr) {
      if (createErr.message.toLowerCase().includes("already")) {
        return res.status(400).json({ error: "An account with this email already exists. Please log in." });
      }
      return res.status(500).json({ error: createErr.message });
    }

    await supabase.from("verification_codes").update({ used: true }).eq("id", row.id);
    return res.json({ ok: true });
  }

  // password_reset: issue a single-use reset token
  const resetToken = generateToken();
  await supabase
    .from("verification_codes")
    .update({ used: true, reset_token: resetToken })
    .eq("id", row.id);

  res.json({ ok: true, resetToken });
});

// POST /api/auth/reset-password — set a new password using a verified reset token
app.post("/api/auth/reset-password", async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) return res.status(400).json({ error: "resetToken and newPassword are required" });
  if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  const { data: row } = await supabase
    .from("verification_codes")
    .select("user_id")
    .eq("reset_token", resetToken)
    .maybeSingle();

  if (!row?.user_id) return res.status(400).json({ error: "Invalid or expired reset token" });

  const { error: updateErr } = await supabase.auth.admin.updateUserById(row.user_id, { password: newPassword });
  if (updateErr) return res.status(500).json({ error: updateErr.message });

  // Consume the token so it can't be reused
  await supabase.from("verification_codes").update({ reset_token: null }).eq("reset_token", resetToken);

  res.json({ ok: true });
});

// /api/test-email removed — was unprotected; use transactional email directly

// POST /api/auth/sign-out — server-side session invalidation
// The real work (clearing local session) happens via supabase.auth.signOut() on the client.
// This endpoint exists so the frontend has a consistent API surface and lets us
// invalidate the session server-side if needed in the future.
app.post("/api/auth/sign-out", requireAuth, async (req, res) => {
  res.status(200).json({ success: true });
});

// DELETE /api/auth/delete-account — permanently delete the calling user's account
app.delete("/api/auth/delete-account", requireAuth, async (req, res) => {
  const userId = req.user.id;

  try {
    console.log(`[delete-account] starting for user=${userId}`);

    // 1. Delete subscriptions first (FK to auth.users, no CASCADE)
    await supabase.from("subscriptions").delete().eq("user_id", userId);
    console.log("[delete-account] deleted subscriptions");

    // 2. Delete usage (FK to auth.users, no CASCADE)
    await supabase.from("usage").delete().eq("user_id", userId);
    console.log("[delete-account] deleted usage");

    // 3. Delete notifications (references activities + user_id)
    await supabase.from("notifications").delete().eq("user_id", userId);
    console.log("[delete-account] deleted notifications");

    // 4. Delete activities (FK to auth.users, no CASCADE)
    await supabase.from("activities").delete().eq("user_id", userId);
    console.log("[delete-account] deleted activities");

    // 5. Delete messages (FK to auth.users, no CASCADE)
    await supabase.from("messages").delete().eq("created_by", userId);
    console.log("[delete-account] deleted messages");

    // 6. Delete invites (FK to auth.users, no CASCADE)
    await supabase.from("invites").delete().eq("created_by", userId);
    console.log("[delete-account] deleted invites");

    // 7. Delete starred notebooks (CASCADE, but cascade is unreliable via GoTrue)
    await supabase.from("starred_notebooks").delete().eq("user_id", userId);
    console.log("[delete-account] deleted starred_notebooks");

    // 8. Delete notebook membership rows (CASCADE, but clean explicitly)
    await supabase.from("notebook_members").delete().eq("user_id", userId);
    console.log("[delete-account] deleted notebook_members");

    // 9. Delete daily_activity (FK to auth.users)
    await supabase.from("daily_activity").delete().eq("user_id", userId);
    console.log("[delete-account] deleted daily_activity");

    // 10. Now safe to delete the auth user — Postgres CASCADE handles the rest
    console.log("[delete-account] calling admin.deleteUser");
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.error("[delete-account] admin.deleteUser failed:", error.message, JSON.stringify(error));
      return res.status(500).json({ error: "Failed to delete account. Please try again." });
    }

    console.log(`[delete-account] success for user=${userId}`);
    res.status(204).end();
  } catch (err) {
    console.error("[delete-account] Unexpected error:", err);
    res.status(500).json({ error: "Failed to delete account. Please try again." });
  }
});

// ── Subscription endpoints ────────────────────────────────────────────────────

// GET /api/user/subscription — current tier + usage stats
app.get("/api/user/subscription", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const tier = await getUserTier(userId);
  await resetUsageIfNeeded(userId);

  const { data: usageRow } = await supabase
    .from("usage")
    .select("messages_this_month, forge_outputs_this_month, reset_at")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  res.json({
    tier,
    messagesUsed:   usageRow?.messages_this_month ?? 0,
    messagesLimit:  tier === "pro" ? null : 75,
    forgeUsed:      usageRow?.forge_outputs_this_month ?? 0,
    forgeLimit:     tier === "pro" ? null : 5,
    resetAt:        usageRow?.reset_at ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
  });
});

// POST /api/create-checkout-session — create a Stripe checkout session
app.post("/api/create-checkout-session", requireAuth, checkoutLimiter, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
  if (!process.env.STRIPE_PRICE_ID) return res.status(500).json({ error: "STRIPE_PRICE_ID not configured" });

  const userId = req.user.id;
  const userEmail = req.user.email;

  // Get or create Stripe customer
  let { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  let customerId = sub?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { supabase_user_id: userId },
    });
    customerId = customer.id;
    await supabase.from("subscriptions").upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      tier: "free",
    }, { onConflict: "user_id" });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    client_reference_id: userId, // ties checkout back to our user_id in webhook
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${process.env.CLIENT_ORIGIN || "https://scholr.dev"}/app?upgraded=true`,
    cancel_url: `${process.env.CLIENT_ORIGIN || "https://scholr.dev"}/pricing`,
  });

  res.json({ url: session.url });
});

// POST /api/create-portal-session — create a Stripe billing portal session
app.post("/api/create-portal-session", requireAuth, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe not configured" });

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", req.user.id)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return res.status(400).json({ error: "No Stripe customer found for this user" });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${process.env.CLIENT_ORIGIN || "https://scholr.dev"}/app`,
  });

  res.json({ url: session.url });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Scholr API running on http://localhost:${PORT}`);
  console.log(`CORS allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`CLIENT_ORIGIN env: ${process.env.CLIENT_ORIGIN ?? "(not set — using fallback)"}`);
});
