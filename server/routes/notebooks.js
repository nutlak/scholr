// Notebooks: CRUD, membership, messages, notes, sharing and invites.
import { Router } from "express";
import { trackEvent } from "../lib/analytics.js";
import { requireAuth, requireMember } from "../lib/auth.js";
import { logUserActivity } from "../lib/presence.js";
import { supabase } from "../lib/supabase.js";
import { uploadSingleFile } from "../lib/upload.js";
import { checkNotebookLimit } from "../lib/usage.js";
import { blockedUserIds, isOnline, orderedPair, pushNotification, resolveUserBrief } from "../lib/users.js";
import { sendInviteEmail } from "../email.js";
import { removeNotebookImageFiles } from "../lib/notebooks.js";

export const router = Router();

// POST /api/notebooks/:id/invite-friend — add an existing friend directly as a
// notebook member (no email step). Requires: caller is a member of the notebook
// (requireMember) AND the two users are actually friends.
router.post("/api/notebooks/:id/invite-friend", requireAuth, requireMember, async (req, res) => {
  const { friendUserId } = req.body ?? {};
  if (!friendUserId || typeof friendUserId !== "string") {
    return res.status(400).json({ error: "friendUserId is required" });
  }
  if (friendUserId === req.user.id) {
    return res.status(400).json({ error: "You can't invite yourself" });
  }

  // Verify the two users are actually friends (friendships stores user_a < user_b).
  const [a, b] = orderedPair(req.user.id, friendUserId);
  const { data: friendship, error: friendErr } = await supabase
    .from("friendships")
    .select("id")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();
  if (friendErr) return res.status(500).json({ error: friendErr.message });
  if (!friendship) return res.status(403).json({ error: "You can only invite your friends" });

  // Add the friend as a member (idempotent — no-op if already a member).
  const { error: upsertError } = await supabase.from("notebook_members").upsert(
    { notebook_id: req.params.id, user_id: friendUserId, role: "member" },
    { onConflict: "notebook_id,user_id" }
  );
  if (upsertError) {
    console.error("inviteFriend: failed to add member:", upsertError);
    return res.status(500).json({ error: "Failed to add friend: " + upsertError.message });
  }

  res.status(201).json({ success: true });

  // Notify the invited friend — fire-and-forget after responding.
  (async () => {
    const [{ data: nb }, meBrief] = await Promise.all([
      supabase.from("notebooks").select("title").eq("id", req.params.id).maybeSingle(),
      resolveUserBrief(req.user.id),
    ]);
    pushNotification(friendUserId, "notebook_invite", {
      fromUserId:    req.user.id,
      fromUsername:  meBrief.username || meBrief.name,
      notebookId:    req.params.id,
      notebookTitle: nb?.title ?? "a notebook",
    });
  })();
});

// Who is in each notebook, for the cards' avatar stack and "N members".
// The client used to hardcode [you], so every shared notebook claimed
// "1 member". Two queries for the whole list, not one per notebook.
export async function attachMembers(notebooks) {
  const ids = notebooks.map(n => n.id).filter(Boolean);
  if (!ids.length) return notebooks;
  const { data: rows } = await supabase.from("notebook_members").select("notebook_id, user_id").in("notebook_id", ids);
  const userIds = [...new Set((rows ?? []).map(r => r.user_id))];
  const { data: profs } = userIds.length
    ? await supabase.from("profiles").select("user_id, username").in("user_id", userIds)
    : { data: [] };
  const name = new Map((profs ?? []).map(p => [p.user_id, p.username]));
  const byNotebook = {};
  for (const r of rows ?? []) (byNotebook[r.notebook_id] ??= []).push(name.get(r.user_id) || "Member");
  return notebooks.map(n => ({ ...n, member_names: byNotebook[n.id] ?? [] }));
}

// GET /api/notebooks — list notebooks the user belongs to
router.get("/api/notebooks", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("notebook_members")
    .select(`
      role,
      notebooks (
        id, title, topic, created_by, created_at, due_date, status, assessment_type, class_id,
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

  res.json(await attachMembers(notebooks));
});

// POST /api/notebooks — create a notebook
router.post("/api/notebooks", requireAuth, async (req, res) => {
  const { title, topic } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });

  const nbLimit = await checkNotebookLimit(req.user.id);
  if (!nbLimit.allowed) {
    return res.status(403).json({
      error: "notebook_limit_reached",
      message: "Free plan is limited to 3 notebooks. Upgrade to Pro for unlimited notebooks.",
    });
  }

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

  trackEvent(req.user.id, "notebook_created", { notebookId: nb.id });
  res.status(201).json(nb);
});

// GET /api/notebooks/:id/members — list all members with email and role
router.get("/api/notebooks/:id/members", requireAuth, requireMember, async (req, res) => {
  const { data: members, error } = await supabase
    .from("notebook_members")
    .select("user_id, role")
    .eq("notebook_id", req.params.id);

  if (error) return res.status(500).json({ error: error.message });

  // First name + presence from auth.users/profiles, so the notebook header
  // can show who else is in here right now — the whole point of studying
  // together. Email itself never leaves the server: other members (who may
  // just be classmates sharing one notebook, not friends) have no reason to
  // see each other's raw addresses, so we resolve it down to a display name
  // here instead.
  const results = await Promise.all(
    (members ?? []).map(async ({ user_id, role }) => {
      const [{ data }, { data: prof }] = await Promise.all([
        supabase.auth.admin.getUserById(user_id),
        supabase.from("profiles").select("last_active, username").eq("user_id", user_id).maybeSingle(),
      ]);
      const email = data?.user?.email ?? null;
      const first_name = data?.user?.user_metadata?.full_name?.split(" ")[0]?.trim() ?? null;
      const local = email?.split("@")[0];
      return {
        user_id,
        role,
        hasEmail:     !!email,
        first_name,
        display_name: first_name || (local ? local.charAt(0).toUpperCase() + local.slice(1) : "Member"),
        username:     prof?.username ?? null,
        lastActive:   prof?.last_active ?? null,
        isOnline:     isOnline(prof?.last_active ?? null),
      };
    })
  );

  res.json(results.filter(m => m.hasEmail).map(({ hasEmail: _hasEmail, ...m }) => m));
});

// GET /api/notebooks/:id/messages — fetch shared chat history
router.get("/api/notebooks/:id/messages", requireAuth, requireMember, async (req, res) => {
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, created_at, created_by")
    .eq("notebook_id", req.params.id)
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// POST /api/notebooks/:id/messages — save a message to shared chat history
router.post("/api/notebooks/:id/messages", requireAuth, requireMember, async (req, res) => {
  const { role, content } = req.body;
  if (!role || !content) return res.status(400).json({ error: "role and content are required" });
  // Derek's replies are saved server-side by the AI routes; a client may only
  // post its own messages, or anyone could forge a "Derek" answer.
  if (role !== "user") return res.status(403).json({ error: "Only your own messages can be posted here." });
  if (typeof content !== "string" || content.length > 8000) return res.status(400).json({ error: "Message too long (max 8000 characters)." });

  const notebookId = req.params.id;
  const userId = req.user.id;

  const { data, error } = await supabase
    .from("messages")
    .insert({
      notebook_id: notebookId,
      role,
      content,
      created_by: userId,
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
    logUserActivity(userId, req);

    // Shared-notebook activity log (powers Best Friends ranking) — only record
    // activity for notebooks with more than one member. Fire-and-forget.
    (async () => {
      try {
        const { count } = await supabase
          .from("notebook_members")
          .select("user_id", { count: "exact", head: true })
          .eq("notebook_id", notebookId);
        if ((count ?? 0) > 1) {
          await supabase
            .from("notebook_activity")
            .insert({ user_id: userId, notebook_id: notebookId });
        }
      } catch (err) {
        console.error("notebook_activity log error:", err);
      }
    })();

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

        // A shared notebook can't hide a blocked member's messages without
        // breaking the thread for everyone else, but a block should still
        // stop a direct @mention notification from reaching them.
        const blocked = await blockedUserIds(userId);
        const notifiable = matched.filter(m => !blocked.has(m.user_id));
        if (!notifiable.length) return;

        // Unified notification (social_notifications) — one per mentioned member.
        const { data: nb } = await supabase
          .from("notebooks").select("title").eq("id", notebookId).single();
        const meBrief = await resolveUserBrief(userId);
        const fromUsername = meBrief.username || meBrief.name;
        const snippet = content.slice(0, 140);

        await Promise.all(notifiable.map(m =>
          pushNotification(m.user_id, "mention", {
            fromUserId:    userId,
            fromUsername,
            notebookId,
            notebookTitle: nb?.title ?? "a notebook",
            snippet,
          })
        ));
      } catch (err) {
        console.error("mention notification error:", err);
      }
    })();
  }
});

// DELETE /api/notebooks/:id — owner-only hard delete
router.delete("/api/notebooks/:id", requireAuth, requireMember, async (req, res) => {
  if (req.membership.role !== "owner")
    return res.status(403).json({ error: "Only the owner can delete this notebook" });

  // Defense-in-depth: explicitly clear star rows for this notebook so none are
  // orphaned even if starred_notebooks.notebook_id lacks ON DELETE CASCADE.
  // (Postgres cascade also handles notes/members/etc. — see migration 030.)
  await supabase.from("starred_notebooks").delete().eq("notebook_id", req.params.id);

  // Purge generated-image files from the notebook-images bucket BEFORE the
  // delete cascades away the notebook_images rows (otherwise files orphan).
  await removeNotebookImageFiles([req.params.id]);

  const { error } = await supabase
    .from("notebooks")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// POST /api/notebooks/:id/invite — return (or regenerate) an invite link
router.post("/api/notebooks/:id/invite", requireAuth, requireMember, async (req, res) => {
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
router.get("/api/notebooks/:id/notes", requireAuth, requireMember, async (req, res) => {
  const { data, error } = await supabase
    .from("notes")
    .select("id, title, content, file_url, created_at, uploader_id")
    .eq("notebook_id", req.params.id)  // no user_id filter — members see every note
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`listNotes: query error for notebook=${req.params.id}:`, error);
    return res.status(500).json({ error: error.message });
  }
  console.log(`listNotes: notebook=${req.params.id} role=${req.membership.role} found=${data?.length ?? 0} notes`);
  res.json(data ?? []);
});

// DELETE /api/notebooks/:id/notes/:noteId — remove a source. The person who
// added it, or the unit's owner; anyone else in the group gets a 403.
router.delete("/api/notebooks/:id/notes/:noteId", requireAuth, requireMember, async (req, res) => {
  const { data: note } = await supabase
    .from("notes").select("id, uploader_id")
    .eq("id", req.params.noteId).eq("notebook_id", req.params.id)
    .maybeSingle();
  if (!note) return res.status(404).json({ error: "Source not found" });
  if (note.uploader_id !== req.user.id && req.membership.role !== "owner") {
    return res.status(403).json({ error: "Only whoever added this source, or the unit's owner, can remove it." });
  }
  const { error } = await supabase.from("notes").delete().eq("id", note.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// POST /api/notebooks/:id/notes — upload a note (text and/or file)
router.post(
  "/api/notebooks/:id/notes",
  requireAuth,
  requireMember,
  uploadSingleFile,
  async (req, res) => {
    const { title } = req.body;
    if (title != null && String(title).length > 200) {
      return res.status(400).json({ error: "Title too long (max 200 characters)." });
    }
    let fileUrl = null;
    let content = req.body.content ?? null;

    if (req.file) {
      // Sanitize the filename into the storage key; force contentType to the
      // allowlisted MIME (never the raw client value); give non-images a download
      // disposition so browsers never render an uploaded file inline (stored-XSS).
      const safeName = (req.file.originalname || "file").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 200) || "file";
      const safeMime = req.file.mimetype; // constrained to ALLOWED_UPLOAD_MIMES by uploadSingleFile
      const path = `${req.params.id}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("scholr")
        .upload(path, req.file.buffer, { contentType: safeMime });

      if (uploadError) return res.status(500).json({ error: uploadError.message });

      const isImage = safeMime.startsWith("image/");
      const { data: urlData } = supabase.storage
        .from("scholr")
        .getPublicUrl(path, isImage ? undefined : { download: safeName });
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

    if (typeof content === "string" && content.length > 300000) {
      return res.status(400).json({ error: "Note content too long (max 300,000 characters)." });
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
    trackEvent(req.user.id, fileUrl ? "file_uploaded" : "note_created", { notebookId: req.params.id });
    res.status(201).json(data);

    // Bump daily activity for streak/heatmap
    logUserActivity(req.user.id, req);

    // Fire-and-forget: notify other notebook members (unified notifications)
    (async () => {
      try {
        const noteTitle = title || req.file?.originalname || "note";
        const notebookId = req.params.id;
        const userId = req.user.id;

        const { data: otherMembers, error: membersError } = await supabase
          .from("notebook_members")
          .select("user_id")
          .eq("notebook_id", notebookId)
          .neq("user_id", userId);
        if (membersError) {
          console.error("note_uploaded notify error (members query):", membersError);
          return;
        }
        if (!otherMembers?.length) return;

        const { data: nb } = await supabase
          .from("notebooks").select("title").eq("id", notebookId).single();
        const meBrief = await resolveUserBrief(userId);
        const fromUsername = meBrief.username || meBrief.name;

        await Promise.all(otherMembers.map(m =>
          pushNotification(m.user_id, "note_uploaded", {
            fromUserId:    userId,
            fromUsername,
            notebookId,
            notebookTitle: nb?.title ?? "a notebook",
            noteTitle,
          })
        ));
      } catch (err) {
        console.error("note_uploaded notify error:", err);
      }
    })();
  }
);

// POST /api/notebooks/:id/invites — send an email invite to a collaborator
router.post("/api/notebooks/:id/invites", requireAuth, requireMember, async (req, res) => {
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
router.get("/api/invite/:token", async (req, res) => {
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
router.post("/api/invite/:token/accept", requireAuth, async (req, res) => {
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

// ── Due date and status on notebooks ──────────────────────────────────────
// PATCH /api/notebooks/:id/due-date — body: { due_date }
router.patch("/api/notebooks/:id/due-date", requireAuth, requireMember, async (req, res) => {
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

// PATCH /api/notebooks/:id/assessment-type — body: { assessment_type }
// Free text (max 40 chars), not an enum — vocabulary varies too much by
// course/teacher to lock down server-side; the client offers a fixed picker.
router.patch("/api/notebooks/:id/assessment-type", requireAuth, requireMember, async (req, res) => {
  const raw = req.body?.assessment_type;
  if (raw !== null && typeof raw !== "string") {
    return res.status(400).json({ error: "assessment_type must be a string or null" });
  }
  const assessment_type = raw === null ? null : (raw.trim().slice(0, 40) || null);
  const { data, error } = await supabase
    .from("notebooks")
    .update({ assessment_type })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

