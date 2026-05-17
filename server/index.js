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
import { sendOtpEmail, sendInviteEmail } from "./email.js";

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
  },
}));

// GET /api/notebooks — list notebooks the user belongs to
app.get("/api/notebooks", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("notebook_members")
    .select(`
      role,
      notebooks (
        id, title, topic, created_by, created_at,
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
        id, title, topic, created_by, created_at,
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
    .select("id, title, topic, created_by, created_at, notes(count)")
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
        id, title, topic, created_by, created_at,
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
    .select("id, title, topic, created_at, notes(count)")
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
    .map((n) => {
      const body = n.content ? n.content : "[file attachment — no text content]";
      return `Note: ${n.title || "Untitled"}\n${body}`;
    })
    .join("\n\n---\n\n");

  const anthropic = new Anthropic({ apiKey: claudeKey });

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are a friendly study assistant for a notebook called "${nb?.title}" on the topic "${nb?.topic}". Answer the student's questions using the notes below as your source of truth. Write in plain conversational text like a helpful human tutor — no markdown, no asterisks, no pound signs, no bullet dashes, no headers, no bold. Just natural sentences and paragraphs. Keep answers concise.\n\nNOTEBOOK NOTES:\n${notesContext || "(no notes uploaded yet)"}`,
      messages: [{ role: "user", content: question }],
    });

    const answer = message.content.find((b) => b.type === "text")?.text ?? "";
    res.json({ answer });
  } catch (err) {
    if (err.status === 401) return res.status(400).json({ error: "Invalid Claude API key" });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notebooks/:id/forge — generate study materials with streaming SSE
app.post("/api/notebooks/:id/forge", requireAuth, requireMember, async (req, res) => {
  const { action, topic } = req.body;
  const claudeKey = process.env.CLAUDE_API_KEY || req.headers["x-claude-key"];

  const VALID_ACTIONS = ["study_guide", "questions", "flashcards", "summary"];
  if (!action || !VALID_ACTIONS.includes(action))
    return res.status(400).json({ error: "action must be one of: " + VALID_ACTIONS.join(", ") });
  if (!claudeKey)
    return res.status(400).json({ error: "Claude API key not configured on server" });

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
      model: "claude-sonnet-4-6",
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

  res.json((rows ?? []).map(r => ({
    ...r,
    email: userInfo[r.user_id]?.email ?? null,
    first_name: userInfo[r.user_id]?.first_name ?? null,
    full_name: userInfo[r.user_id]?.full_name ?? null,
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
  });
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
    res.status(500).json({ error: err.message ?? "Failed to send invite email." });
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
app.listen(PORT, () => {
  console.log(`Scholr API running on http://localhost:${PORT}`);
  console.log(`CORS allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`CLIENT_ORIGIN env: ${process.env.CLIENT_ORIGIN ?? "(not set — using fallback)"}`);
});
