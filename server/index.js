import "./lib/env.js";
import { router as notebooksRoutes } from "./routes/notebooks.js";
import { router as aiRoutes } from "./routes/ai.js";
import { router as classesRoutes } from "./routes/classes.js";
import { router as flashcardsRoutes } from "./routes/flashcards.js";
import { router as forgeRoutes } from "./routes/forge.js";
import { router as unitnotesRoutes } from "./routes/unit-notes.js";
import { router as podcastsRoutes } from "./routes/podcasts.js";
import { router as userRoutes } from "./routes/user.js";
import { router as friendsRoutes } from "./routes/friends.js";
import { router as authRoutes } from "./routes/auth.js";
import { router as billingRoutes } from "./routes/billing.js";
import { router as socialRoutes } from "./routes/social.js";
import { router as miscRoutes } from "./routes/misc.js";
import express from "express";
import cors from "cors";
import { sendOnboardingEmail } from "./email.js";
import { supabase } from "./lib/supabase.js";
import { globalLimiter, webhookLimiter } from "./lib/limiters.js";
import { stripe } from "./lib/stripe.js";
import { pushEnabled } from "./lib/push.js";
import { getUserIdByStripeCustomer } from "./lib/usage.js";
import { pushNotification } from "./lib/users.js";
import { relayJarvis, trackEvent } from "./lib/analytics.js";


const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`\n❌ Missing required env vars: ${missing.join(", ")}`);
  console.error("   Add them to server/.env and restart.\n");
  process.exit(1);
}

const app = express();
// Behind Railway/Vercel's proxy, the client IP is in X-Forwarded-For. Trust the
// first hop so rate-limit IP keying uses the real client IP, not the proxy's.
app.set("trust proxy", 1);


// ── Middleware ────────────────────────────────────────────────────────────────
const stripTrailingSlash = (s) => (typeof s === "string" ? s.replace(/\/+$/, "") : s);
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  stripTrailingSlash(process.env.CLIENT_ORIGIN),  // https://scholr.dev
  "https://scholr.dev",
  "https://www.scholr.dev",
  "https://getscholr.com",      // marketing domain (landing page fetches /api/stats/public)
  "https://www.getscholr.com",
].filter(Boolean);

// ── Security headers ─────────────────────────────────────────────────────────
// Small hand-rolled set rather than a helmet dependency: this is a JSON API,
// so most of helmet's surface (CSP, frame options for HTML) does not apply.
app.disable("x-powered-by"); // stop advertising the framework and version
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");      // no MIME sniffing
  res.set("Referrer-Policy", "no-referrer");         // never leak API URLs onward
  res.set("Cross-Origin-Resource-Policy", "same-site");
  // Railway terminates TLS; tell browsers to never try this host over http.
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

app.use(cors({
  origin(origin, cb) {
    // Allow non-browser requests (curl, Railway healthcheck, server-to-server)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    // Don't throw — that prevents downstream cors headers from being set and
    // surfaces in browsers as the misleading "No 'Access-Control-Allow-Origin'"
    // message. Log it and reject cleanly instead.
    console.warn(`[cors] rejected origin: ${origin} (allowed: ${ALLOWED_ORIGINS.join(", ")})`);
    cb(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 204,
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

        // Squad plan checkout — one subscription covers a whole group, not
        // just the purchaser. Branches away from the personal-subscription
        // path entirely; nothing below this block runs for a squad checkout.
        if (session.metadata?.type === "squad") {
          const squadSub = await stripe.subscriptions.retrieve(subscriptionId).catch(err => {
            console.error(`[stripe] could not retrieve squad subscription ${subscriptionId}: ${err.message} — creating squad anyway`);
            return null;
          });
          const rawEnd = squadSub?.current_period_end ?? squadSub?.items?.data?.[0]?.current_period_end;
          const periodEnd = rawEnd ? new Date(rawEnd * 1000).toISOString() : null;

          const { data: squad, error: squadErr } = await supabase.from("squads").insert({
            owner_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            current_period_end: periodEnd,
          }).select("id").single();
          if (squadErr) {
            console.error(`[stripe] squad creation failed for user=${userId}:`, squadErr.message);
            break;
          }
          // Same one-squad-per-user invariant POST /api/squad/join/:token
          // enforces — without this, a member of someone else's squad who
          // starts their own ends up with two squad_members rows, which
          // silently breaks hasActiveSquadPro's .maybeSingle() lookup (it
          // errors on >1 row and getUserTier swallows that as "not pro"),
          // so a squad owner could pay and never actually get Pro.
          await supabase.from("squad_members").delete().eq("user_id", userId);
          await supabase.from("squad_members").insert({ squad_id: squad.id, user_id: userId });
          console.log(`[stripe] checkout.session.completed: squad ${squad.id} created for owner=${userId}, period_end=${periodEnd}`);
          trackEvent(userId, "squad_created");
          break;
        }

        // Fetching the renewal date is a nice-to-have; granting Pro is not.
        // This call previously ran unguarded, so a missing "Subscriptions:
        // Read" permission on the API key — or any transient Stripe error —
        // threw, the handler 500'd, and a customer who had already been
        // charged never received Pro. The grant below now proceeds either way
        // and customer.subscription.updated fills in the date later.
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId).catch(err => {
          console.error(`[stripe] could not retrieve subscription ${subscriptionId}: ${err.message} — granting Pro anyway`);
          return null;
        });
        // Stripe's newer API moves current_period_end to items.data[0]; fall back to top-level
        const rawEnd = stripeSub?.current_period_end
          ?? stripeSub?.items?.data?.[0]?.current_period_end;
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
        trackEvent(userId, "subscription_created");
        relayJarvis("new_subscription", { userId });
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const isActive = sub.status === "active" || sub.status === "trialing";
        // current_period_end may be on items.data[0] in newer Stripe API versions
        const rawEnd = sub.current_period_end
          ?? sub.items?.data?.[0]?.current_period_end;
        const periodEnd = rawEnd ? new Date(rawEnd * 1000).toISOString() : null;
        await supabase.from("subscriptions")
          .update({
            tier: isActive ? "pro" : "free",
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", sub.id);
        // A subscription ID belongs to exactly one of the two tables — this
        // is a harmless no-op update (0 rows matched) for whichever table it
        // isn't. Squad expiry works the same way personal expiry does:
        // current_period_end in the past means hasActiveSquadPro says no.
        await supabase.from("squads")
          .update({ current_period_end: isActive ? periodEnd : null })
          .eq("stripe_subscription_id", sub.id);
        console.log(`[stripe] subscription.updated: id=${sub.id} status=${sub.status} tier=${isActive ? "pro" : "free"}`);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await supabase.from("squads")
          .update({ current_period_end: null })
          .eq("stripe_subscription_id", sub.id);
        await supabase.from("subscriptions")
          .update({ tier: "free", stripe_subscription_id: null, updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", sub.id);
        console.log(`[stripe] subscription.deleted: id=${sub.id} → free`);
        relayJarvis("subscription_cancelled", { subscriptionId: sub.id });
        break;
      }
      case "invoice.payment_failed": {
        // A renewal charge failed. Do NOT downgrade here — Stripe auto-retries
        // (dunning), and the eventual real downgrade flows through
        // subscription.updated/deleted above. Just notify the user to fix their
        // card so they don't silently lose Pro.
        const invoice = event.data.object;
        const userId = await getUserIdByStripeCustomer(invoice.customer);
        if (userId) {
          await pushNotification(userId, "payment_failed", {
            attemptCount: invoice.attempt_count ?? null,
            nextPaymentAttempt: invoice.next_payment_attempt
              ? new Date(invoice.next_payment_attempt * 1000).toISOString()
              : null,
          });
          console.log(`[stripe] invoice.payment_failed: notified user=${userId} (attempt ${invoice.attempt_count})`);
        } else {
          console.warn(`[stripe] invoice.payment_failed: no user for customer=${invoice.customer}`);
        }
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

// 10mb limit so /api/notebooks/:id/images can accept base64-encoded
// generated images (a 1536x1536 PNG can be ~3–6 MB raw, ~4–8 MB as base64).
// File uploads go through multer (its own 10MB limit, set where `upload` is
// defined) and never hit this parser — everything else is plain text (chat,
// notes, Feynman explanations) and needs nowhere near this much, but images
// are the one real JSON-body consumer that does.
app.use(express.json({ limit: '10mb' }));

// Global rate limit on all /api routes. Registered AFTER the Stripe webhook
// route (above) so Stripe's retries are never throttled, and after express.json
// so it doesn't interfere with body parsing.
app.use("/api", globalLimiter);

// Attach authenticated user to req.user from Supabase JWT in Authorization header.
// Routes that need auth call this middleware explicitly.


// ── Routes ────────────────────────────────────────────────────────────────────

// GET /healthz — Railway healthcheck
app.get("/healthz", (_, res) => res.json({ ok: true }));

// GET /api/health — env var presence check (values never exposed)
//
// This list had drifted: it was written before push notifications and the
// Squad plan shipped, so the four vars those features need weren't checked.
// Both went missing in production and /api/health still answered all-true,
// which is exactly the blind spot that let it go unnoticed. Anything a
// feature hard-requires belongs here, or this endpoint lies by omission.
//
// `features` is the derived view the client uses so the UI doesn't offer a
// button that cannot work. Booleans only — never values, and the key names
// stay server-side of the `env` block.
app.get("/api/health", (_, res) => {
  const env = {
    SUPABASE_URL:              !!process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY:         !!process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    CLAUDE_API_KEY:            !!process.env.CLAUDE_API_KEY,
    OPENAI_API_KEY:            !!process.env.OPENAI_API_KEY,
    RESEND_API_KEY:            !!process.env.RESEND_API_KEY,
    CLIENT_ORIGIN:             !!process.env.CLIENT_ORIGIN,
    STRIPE_SECRET_KEY:         !!process.env.STRIPE_SECRET_KEY,
    STRIPE_PRICE_ID:           !!process.env.STRIPE_PRICE_ID,
    STRIPE_PRICE_ID_SQUAD:     !!process.env.STRIPE_PRICE_ID_SQUAD,
    STRIPE_WEBHOOK_SECRET:     !!process.env.STRIPE_WEBHOOK_SECRET,
    VAPID_PUBLIC_KEY:          !!process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY:         !!process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT:             !!process.env.VAPID_SUBJECT,
  };
  res.json({
    ok: true,
    env,
    features: {
      push:  pushEnabled,
      squad: !!(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID_SQUAD),
      pro:   !!(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID),
    },
  });
});


// ── Classes endpoints ─────────────────────────────────────────────────────────


// Shared notes-context builder for every Claude call that reads a notebook's
// notes. Two jobs: (1) cap total size so one note-heavy notebook can't blow
// up a single request's cost (no truncation existed before — a notebook near
// the 40-note fetch limit with long PDFs could send tens of thousands of
// tokens on every single message, silently, with a fixed model+output cost
// hiding an unbounded input cost behind it); (2) keep the "Note: <title>"
// formatting consistent across call sites instead of five near-duplicate
// .map().join() blocks. ~4 chars/token is a rough but standard heuristic —
// good enough for a cost *ceiling*, not meant to be exact.


// ── Flashcards (spaced repetition, SM-2) ───────────────────────────────────────


// ── Unit notes endpoints ──────────────────────────────────────────────────────


// ── Invite endpoints ──────────────────────────────────────────────────────────


// ── Podcast Mode — AI two-host audio overviews (Pro-gated) ────────────────
// Two-stage pipeline:
//   1) Claude writes a two-host dialogue script from the notebook's notes.
//   2) OpenAI tts-1 voices each line; segments are concatenated as MP3 bytes
//      and uploaded to the 'scholr' storage bucket. No ffmpeg dependency —
//      tts-1 returns MPEG audio that concatenates acceptably for playback.
//
// The generate endpoint responds with the row id IMMEDIATELY and runs the
// pipeline in the background; the client polls GET /api/podcasts/:id for status.


// ── Feynman Mode ──────────────────────────────────────────────────────────────
// Compose a clean, secret-free error string from an AI SDK error (status/code/
// message only — never the API key). Mirrors how the podcast route surfaces
// failures so the client gets something actionable without leaking anything.


// ── OTP helpers ──────────────────────────────────────────────────────────────


// /api/test-email removed — was unprotected; use transactional email directly


// ── Subscription endpoints ────────────────────────────────────────────────────


// ── Friends system ────────────────────────────────────────────────────────────
// Mutual friendships are stored in `friendships` as one row per pair with
// user_a < user_b (enforced by CHECK constraint). Pending/declined requests
// live in `friend_requests` keyed by (from_user, to_user).

// Build the lexicographically-ordered pair so friendships always has one row
// per relationship regardless of who friended whom first.


// GET /api/friends/best — top 5 friends ranked by shared-notebook activity
// (last 90 days). Falls back to newest friends if there's no activity yet.


// Push a "Name is studying now" notification to friends who (a) have a push
// subscription, (b) aren't themselves online right now (no point nudging
// someone already in the app), and (c) haven't been pushed about this same
// friend in the last hour (push_notify_log). Fire-and-forget from the caller.


// ── Social notifications (friend requests / accepts / notebook invites) ─────────
// Separate from the activity-based `notifications` table (migration 008); these
// live in `social_notifications`. See migration 016.




// Unmatched API routes: reply JSON, not Express's HTML 404 page, so a client
// typo or a removed endpoint surfaces as a readable message rather than an
// unparseable body. Non-/api paths keep the default behaviour.
// ── Routes ───────────────────────────────────────────────────────────────────
app.use(notebooksRoutes);
app.use(aiRoutes);
app.use(classesRoutes);
app.use(flashcardsRoutes);
app.use(forgeRoutes);
app.use(unitnotesRoutes);
app.use(podcastsRoutes);
app.use(userRoutes);
app.use(friendsRoutes);
app.use(authRoutes);
app.use(billingRoutes);
app.use(socialRoutes);
app.use(miscRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({ error: `No such endpoint: ${req.method} ${req.originalUrl}` });
});

// ── JSON error handler ───────────────────────────────────────────────────────
// Without this, an error thrown in any route (a rejected Stripe call, say)
// falls through to Express's default handler, which replies with an HTML error
// page. The client does `res.json().catch(() => ({}))` and ends up with no
// message at all, so a real backend failure surfaced to users as a button that
// silently did nothing. Every route now fails as JSON the UI can display.
// Must stay last, after all routes.
app.use((err, req, res, _next) => {
  const status = err?.statusCode || err?.status || 500;
  const detail = err?.message || String(err);
  // Always log the real thing — Railway logs are where diagnosis belongs.
  console.error(`[error] ${req.method} ${req.path} ->`, detail);
  if (res.headersSent) return;
  // Only surface the message for faults the caller can act on (4xx we raise
  // ourselves). Upstream 5xx text can carry provider account ids, key
  // fragments and internal URLs — a Stripe permission error leaked exactly
  // that to the browser — so those are generic to the client.
  const safe = status < 500 || process.env.DEBUG === "1";
  res.status(status).json({
    error: safe ? detail : "Something went wrong on our end. Please try again.",
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Scholr API running on http://localhost:${PORT}`);
  console.log(`CORS allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`CLIENT_ORIGIN env: ${process.env.CLIENT_ORIGIN ?? "(not set — using fallback)"}`);
});

// ── Onboarding email worker: send due pending emails (hourly) ─────────────────
// Backward-compatible: if migration 024 hasn't run, the query errors and is
// logged, never crashing the server.
async function processPendingEmails() {
  try {
    const { data: due, error } = await supabase
      .from("pending_emails")
      .select("id, user_id, email, email_type")
      .eq("sent", false)
      .lte("send_at", new Date().toISOString())
      .limit(100);
    if (error) { console.error("[pending_emails]", error.message); return; }
    if (!due?.length) return;

    const userIds = [...new Set(due.map(d => d.user_id))];
    const { data: profs } = await supabase
      .from("profiles").select("user_id, email_unsubscribed").in("user_id", userIds);
    const unsubscribed = new Set((profs || []).filter(p => p.email_unsubscribed).map(p => p.user_id));

    for (const row of due) {
      try {
        if (!unsubscribed.has(row.user_id)) {
          await sendOnboardingEmail(row.email_type, row.email, "", row.user_id);
        }
        await supabase.from("pending_emails")
          .update({ sent: true, sent_at: new Date().toISOString() })
          .eq("id", row.id);
      } catch (e) { console.error(`[pending_emails send ${row.id}]`, e.message); }
    }
    console.log(`[pending_emails] processed ${due.length}`);
  } catch (e) { console.error("[pending_emails worker]", e.message); }
}
// Both workers write to the live database and send real mail, so a developer
// running this against production credentials must be able to keep them off.
// Default stays on: production sets nothing and behaves exactly as before.
const WORKERS_DISABLED = process.env.DISABLE_WORKERS === "1";
if (WORKERS_DISABLED) console.warn("[workers] disabled via DISABLE_WORKERS=1 — no email will be sent");

if (!WORKERS_DISABLED) {
  setInterval(processPendingEmails, 60 * 60 * 1000); // hourly
  setTimeout(processPendingEmails, 30 * 1000);        // once shortly after boot
}

// ── Renewal-reminder worker: warn Pro users 3 days before they renew ──────────
// Same pattern as processPendingEmails (single-instance in-process timer). The
// reminder_sent_for_period marker makes it idempotent per billing period:
// reset naturally when current_period_end advances to a new value.
// Backward-compatible: if migration 021 hasn't run, the query errors and is
// logged, never crashing the server.
async function processRenewalReminders() {
  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days
    const { data: due, error } = await supabase
      .from("subscriptions")
      .select("user_id, current_period_end, reminder_sent_for_period")
      .eq("tier", "pro")
      .gte("current_period_end", now.toISOString())
      .lte("current_period_end", horizon.toISOString())
      .limit(500);
    if (error) { console.error("[renewal_reminders]", error.message); return; }
    if (!due?.length) return;

    let sent = 0;
    for (const row of due) {
      try {
        const cpe = row.current_period_end;
        if (!cpe) continue;
        const cpeMs = new Date(cpe).getTime();
        // (#2) Robust epoch comparison — skip if already reminded for this period
        // regardless of timestamp string formatting differences.
        if (row.reminder_sent_for_period && new Date(row.reminder_sent_for_period).getTime() === cpeMs) continue;

        const cpeIso = new Date(cpe).toISOString(); // canonical (…Z) for the filter
        const prev = row.reminder_sent_for_period;

        // (#4) Atomic claim: flip the marker ONLY if it's still unset or for an
        // older period. Two racing workers can't both claim the same row — the
        // loser's update matches no rows. select() returns the rows we changed.
        const { data: claimed, error: claimErr } = await supabase
          .from("subscriptions")
          .update({ reminder_sent_for_period: cpeIso })
          .eq("user_id", row.user_id)
          .or(`reminder_sent_for_period.is.null,reminder_sent_for_period.lt.${cpeIso}`)
          .select("user_id");
        if (claimErr) { console.error(`[renewal_reminders claim ${row.user_id}]`, claimErr.message); continue; }
        if (!claimed || claimed.length === 0) continue; // another worker claimed it

        // (#3) Send AFTER claiming; if the insert fails, revert the marker so the
        // next daily run retries instead of silently skipping this period.
        const days = Math.max(0, Math.ceil((cpeMs - Date.now()) / 86400000));
        const ok = await pushNotification(row.user_id, "renewal_reminder", { periodEnd: cpe, days });
        if (ok) {
          sent++;
        } else {
          await supabase.from("subscriptions")
            .update({ reminder_sent_for_period: prev ?? null })
            .eq("user_id", row.user_id);
        }
      } catch (e) { console.error(`[renewal_reminders send ${row.user_id}]`, e.message); }
    }
    if (sent) console.log(`[renewal_reminders] sent ${sent}`);
  } catch (e) { console.error("[renewal_reminders worker]", e.message); }
}
if (!WORKERS_DISABLED) {
  setInterval(processRenewalReminders, 24 * 60 * 60 * 1000); // daily
  setTimeout(processRenewalReminders, 45 * 1000);            // once shortly after boot
}
