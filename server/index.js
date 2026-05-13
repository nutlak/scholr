import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

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
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
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
        .from("scholr-files")
        .upload(path, req.file.buffer, { contentType: req.file.mimetype });

      if (uploadError) return res.status(500).json({ error: uploadError.message });

      const { data: urlData } = supabase.storage.from("scholr-files").getPublicUrl(path);
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
  const claudeKey = req.headers["x-claude-key"];

  if (!question) return res.status(400).json({ error: "question is required" });
  if (!claudeKey) return res.status(400).json({ error: "x-claude-key header is required" });

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

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Scholr API running on http://localhost:${PORT}`));
