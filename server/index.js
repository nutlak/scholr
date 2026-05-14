import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
config({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });
import express from "express";
import cors from "cors";
import multer from "multer";
import { randomBytes } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { sendOtpEmail } from "./email.js";

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`\n❌ Missing required env vars: ${missing.join(", ")}`);
  console.error("   Add them to server/.env and restart.\n");
  process.exit(1);
}

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
app.use(express.json());

// Attach authenticated user to req.user from Supabase JWT in Authorization header.
// Routes that need auth call this middleware explicitly.
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Missing auth token" });

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: "Invalid or expired token" });

  req.user = data.user;
  next();
}

// Verify the caller is a member of the given notebook.
async function requireMember(req, res, next) {
  const { data } = await supabase
    .from("notebook_members")
    .select("role")
    .eq("notebook_id", req.params.id)
    .eq("user_id", req.user.id)
    .maybeSingle();

  if (!data) return res.status(403).json({ error: "Not a member of this notebook" });
  req.membership = data; // { role: 'owner' | 'member' }
  next();
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /healthz — Railway healthcheck
app.get("/healthz", (_, res) => res.json({ ok: true }));

// GET /api/notebooks — list notebooks the user belongs to
app.get("/api/notebooks", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("notebook_members")
    .select(`
      role,
      notebooks (
        id, title, topic, created_by, created_at, invite_token,
        notes (count)
      )
    `)
    .eq("user_id", req.user.id)
    .order("joined_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const notebooks = data.map(({ role, notebooks: nb }) => ({
    ...nb,
    notes_count: nb.notes[0]?.count ?? 0,
    role,
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

// POST /api/invite/accept — join a notebook via invite token (called by client on /join/:token page)
app.post("/api/invite/accept", requireAuth, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token is required" });

  const { data: nb, error } = await supabase
    .from("notebooks")
    .select("id, title")
    .eq("invite_token", token)
    .maybeSingle();

  if (error || !nb) return res.status(404).json({ error: "Invalid invite link" });

  // Upsert so re-joining is idempotent
  await supabase.from("notebook_members").upsert(
    { notebook_id: nb.id, user_id: req.user.id, role: "member" },
    { onConflict: "notebook_id,user_id" }
  );

  res.json({ notebook_id: nb.id, title: nb.title });
});

// GET /api/notebooks/:id/notes — list notes in a notebook
app.get("/api/notebooks/:id/notes", requireAuth, requireMember, async (req, res) => {
  const { data, error } = await supabase
    .from("notes")
    .select("id, title, content, file_url, created_at")
    .eq("notebook_id", req.params.id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/notebooks/:id/notes — upload a note (text and/or file)
app.post(
  "/api/notebooks/:id/notes",
  requireAuth,
  requireMember,
  upload.single("file"),
  async (req, res) => {
    const { title, content } = req.body;
    let fileUrl = null;

    if (req.file) {
      const path = `${req.params.id}/${Date.now()}_${req.file.originalname}`;
      const { error: uploadError } = await supabase.storage
        .from("scholr")
        .upload(path, req.file.buffer, { contentType: req.file.mimetype });

      if (uploadError) return res.status(500).json({ error: uploadError.message });

      const { data: urlData } = supabase.storage.from("scholr").getPublicUrl(path);
      fileUrl = urlData.publicUrl;
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
  }
);

// POST /api/notebooks/:id/query — AI query against notebook notes (BYOK)
app.post("/api/notebooks/:id/query", requireAuth, requireMember, async (req, res) => {
  const { question } = req.body;
  const claudeKey = process.env.CLAUDE_API_KEY || req.headers["x-claude-key"];

  if (!question) return res.status(400).json({ error: "question is required" });
  if (!claudeKey) return res.status(400).json({ error: "Claude API key not configured on server" });

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
    .filter((n) => n.content)
    .map((n) => `### ${n.title || "Untitled"}\n${n.content}`)
    .join("\n\n");

  const anthropic = new Anthropic({ apiKey: claudeKey });

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are a study assistant for a collaborative notebook called "${nb?.title}" covering "${nb?.topic}". Answer questions based on the notes provided. Be clear, concise, and helpful.\n\nNOTEBOOK NOTES:\n${notesContext || "(no text notes yet)"}`,
      messages: [{ role: "user", content: question }],
    });

    const answer = message.content.find((b) => b.type === "text")?.text ?? "";
    res.json({ answer });
  } catch (err) {
    if (err.status === 401) return res.status(400).json({ error: "Invalid Claude API key" });
    res.status(500).json({ error: err.message });
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

// GET /api/test-email?to=you@example.com — smoke-test Resend delivery
// Remove or gate this route before going to production.
app.get("/api/test-email", async (req, res) => {
  const to = req.query.to;
  if (!to) return res.status(400).json({ error: "Pass ?to=your@email.com" });

  try {
    await sendOtpEmail(to, "123456", "signup");
    res.json({ ok: true, message: `Test OTP sent to ${to}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/delete-account — permanently delete the calling user's account
app.delete("/api/auth/delete-account", requireAuth, async (req, res) => {
  const userId = req.user.id;

  // Delete the Supabase auth user (cascades to notebooks/notes via DB foreign keys)
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) return res.status(500).json({ error: error.message });

  res.status(204).end();
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Scholr API running on http://localhost:${PORT}`));
