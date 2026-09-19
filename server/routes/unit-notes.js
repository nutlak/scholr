// Unit notes plus their reactions and comments.
import { Router } from "express";
import { requireAuth, requireMember } from "../lib/auth.js";
import { logUserActivity } from "../lib/presence.js";
import { supabase } from "../lib/supabase.js";
import { resolveUserBrief } from "../lib/users.js";

export const router = Router();

// GET /api/notebooks/:id/unit-notes — list all member-authored notes on a unit
router.get("/api/notebooks/:id/unit-notes", requireAuth, requireMember, async (req, res) => {
  const { data: rows, error } = await supabase
    .from("unit_notes")
    .select("id, user_id, content, created_at, updated_at")
    .eq("notebook_id", req.params.id)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  // Resolve a display name per row via auth.admin — never the raw email,
  // since other notebook members may just be classmates, not friends.
  const userIds = [...new Set((rows ?? []).map(r => r.user_id))];
  const userInfo = {};
  await Promise.all(userIds.map(async (uid) => {
    const { data } = await supabase.auth.admin.getUserById(uid);
    const email = data?.user?.email ?? null;
    const first_name = data?.user?.user_metadata?.full_name?.split(" ")[0]?.trim() ?? null;
    const local = email?.split("@")[0];
    userInfo[uid] = {
      first_name,
      full_name: data?.user?.user_metadata?.full_name ?? null,
      display_name: first_name || (local ? local.charAt(0).toUpperCase() + local.slice(1) : "Member"),
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
    first_name: userInfo[r.user_id]?.first_name ?? null,
    full_name: userInfo[r.user_id]?.full_name ?? null,
    display_name: userInfo[r.user_id]?.display_name ?? "Member",
    reactions: reactionsByNote[r.id] ?? [],
    comment_count: commentCountByNote[r.id] ?? 0,
  })));
});

// POST /api/notebooks/:id/unit-notes — add a note to this unit
router.post("/api/notebooks/:id/unit-notes", requireAuth, requireMember, async (req, res) => {
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
  logUserActivity(req.user.id, req);
});

// DELETE /api/unit-notes/:id — delete a unit note (author only)
router.delete("/api/unit-notes/:id", requireAuth, async (req, res) => {
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

// ── Reactions on unit notes ───────────────────────────────────────────────
// POST /api/unit-notes/:id/react — body: { emoji }
router.post("/api/unit-notes/:id/react", requireAuth, async (req, res) => {
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
router.delete("/api/unit-notes/:id/react/:emoji", requireAuth, async (req, res) => {
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
router.get("/api/unit-notes/:id/reactions", requireAuth, async (req, res) => {
  // Membership check: resolve the note's notebook, confirm the caller is a member.
  const { data: note } = await supabase
    .from("unit_notes").select("id, notebook_id").eq("id", req.params.id).maybeSingle();
  if (!note) return res.status(404).json({ error: "Note not found" });
  const { data: mem } = await supabase
    .from("notebook_members").select("role")
    .eq("notebook_id", note.notebook_id).eq("user_id", req.user.id).maybeSingle();
  if (!mem) return res.status(403).json({ error: "Not a member" });

  const { data, error } = await supabase
    .from("note_reactions")
    .select("id, emoji, user_id, created_at")
    .eq("unit_note_id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  // Identity is username + name only — never raw emails.
  const userIds = [...new Set((data ?? []).map(r => r.user_id))];
  const info = {};
  await Promise.all(userIds.map(async (uid) => {
    const b = await resolveUserBrief(uid);
    info[uid] = { first_name: b.name?.split(" ")[0] ?? null, full_name: b.name ?? null, username: b.username ?? null };
  }));
  res.json((data ?? []).map(r => ({
    ...r,
    first_name: info[r.user_id]?.first_name ?? null,
    full_name: info[r.user_id]?.full_name ?? null,
    username: info[r.user_id]?.username ?? null,
  })));
});

// ── Comments on unit notes ────────────────────────────────────────────────
// POST /api/unit-notes/:id/comments — body: { content }
router.post("/api/unit-notes/:id/comments", requireAuth, async (req, res) => {
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
router.get("/api/unit-notes/:id/comments", requireAuth, async (req, res) => {
  // Membership check: resolve the note's notebook, confirm the caller is a member.
  const { data: note } = await supabase
    .from("unit_notes").select("id, notebook_id").eq("id", req.params.id).maybeSingle();
  if (!note) return res.status(404).json({ error: "Note not found" });
  const { data: mem } = await supabase
    .from("notebook_members").select("role")
    .eq("notebook_id", note.notebook_id).eq("user_id", req.user.id).maybeSingle();
  if (!mem) return res.status(403).json({ error: "Not a member" });

  const { data, error } = await supabase
    .from("note_comments")
    .select("id, user_id, content, created_at")
    .eq("unit_note_id", req.params.id)
    .order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  // Identity is username + name only — never raw emails.
  const userIds = [...new Set((data ?? []).map(r => r.user_id))];
  const info = {};
  await Promise.all(userIds.map(async (uid) => {
    const b = await resolveUserBrief(uid);
    info[uid] = { first_name: b.name?.split(" ")[0] ?? null, full_name: b.name ?? null, username: b.username ?? null };
  }));
  res.json((data ?? []).map(r => ({
    ...r,
    first_name: info[r.user_id]?.first_name ?? null,
    full_name: info[r.user_id]?.full_name ?? null,
    username: info[r.user_id]?.username ?? null,
  })));
});

// DELETE /api/note-comments/:id — delete a comment (author only)
router.delete("/api/note-comments/:id", requireAuth, async (req, res) => {
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
