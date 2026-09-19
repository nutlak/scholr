// Friend requests, the friend list, blocking and the leaderboard.
import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { computeStreakServer } from "../lib/presence.js";
import { supabase } from "../lib/supabase.js";
import { blockedUserIds, isBlockedBetween, isOnline, orderedPair, pushNotification, resolveUserBrief, visibleActiveNotebooks } from "../lib/users.js";
import { UUID_RE } from "../lib/validate.js";

export const router = Router();

// GET /api/friends/leaderboard — the caller + their friends, ranked by current
// study streak. Same daily_activity table as /api/user/activity-heatmap, just
// queried for the whole friend group at once instead of one profile at a time.
router.get("/api/friends/leaderboard", requireAuth, async (req, res) => {
  const me = req.user.id;
  const { data: friendships, error: fErr } = await supabase
    .from("friendships")
    .select("user_a, user_b")
    .or(`user_a.eq.${me},user_b.eq.${me}`);
  if (fErr) return res.status(500).json({ error: fErr.message });

  const ids = [me, ...(friendships ?? []).map(row => (row.user_a === me ? row.user_b : row.user_a))];

  const start = new Date();
  start.setDate(start.getDate() - 365);
  const startStr = start.toISOString().slice(0, 10);
  const { data: activity, error: aErr } = await supabase
    .from("daily_activity")
    .select("user_id, date, activity_count")
    .in("user_id", ids)
    .gte("date", startStr);
  if (aErr) return res.status(500).json({ error: aErr.message });

  const byUser = new Map(ids.map(id => [id, []]));
  for (const row of activity ?? []) {
    byUser.get(row.user_id)?.push({ date: row.date, count: row.activity_count ?? 0 });
  }

  const briefs = await Promise.all(ids.map(resolveUserBrief));
  const nameById = new Map(briefs.map(b => [b.userId, b.name]));

  const board = ids
    .map(id => ({ userId: id, name: nameById.get(id) || "User", streak: computeStreakServer(byUser.get(id) || []), isMe: id === me }))
    .filter(row => row.streak > 0)
    .sort((a, b) => b.streak - a.streak);

  res.json(board);
});

// POST /api/friends/request — { toUserId } → request or auto-accept
router.post("/api/friends/request", requireAuth, async (req, res) => {
  const { toUserId } = req.body ?? {};
  if (!toUserId || typeof toUserId !== "string") {
    return res.status(400).json({ error: "toUserId is required" });
  }
  if (toUserId === req.user.id) {
    return res.status(400).json({ error: "You can't friend yourself" });
  }

  // Verify the target user actually exists, otherwise FK insertion will 500.
  const { data: targetData } = await supabase.auth.admin.getUserById(toUserId);
  if (!targetData?.user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Block gate: neither party may friend the other if a block exists either way.
  if (await isBlockedBetween(req.user.id, toUserId)) {
    return res.status(403).json({ error: "Can't send a friend request to this user" });
  }

  // Already friends? Return current state.
  const [a, b] = orderedPair(req.user.id, toUserId);
  const { data: existingFriendship } = await supabase
    .from("friendships")
    .select("id")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();
  if (existingFriendship) {
    return res.json({ status: "already_friends" });
  }

  // Reciprocal pending request from the other side? Auto-accept both.
  const { data: reciprocal } = await supabase
    .from("friend_requests")
    .select("id, status")
    .eq("from_user", toUserId)
    .eq("to_user", req.user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (reciprocal) {
    const { error: friendshipErr } = await supabase
      .from("friendships")
      .insert({ user_a: a, user_b: b });
    if (friendshipErr) {
      console.error("friend auto-accept: friendship insert failed:", friendshipErr);
      return res.status(500).json({ error: friendshipErr.message });
    }
    await supabase
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("id", reciprocal.id);
    // The reciprocal sender (toUserId) just got their request accepted.
    const meBrief = await resolveUserBrief(req.user.id);
    pushNotification(toUserId, "friend_accepted", { fromUserId: req.user.id, fromUsername: meBrief.username || meBrief.name });
    return res.status(201).json({ status: "accepted" });
  }

  // Existing outbound request (pending or declined)? Make it pending and return.
  const { data: outbound } = await supabase
    .from("friend_requests")
    .select("id, status")
    .eq("from_user", req.user.id)
    .eq("to_user", toUserId)
    .maybeSingle();

  if (outbound) {
    if (outbound.status === "pending") {
      return res.json({ status: "pending", requestId: outbound.id });
    }
    // 'declined' or stale 'accepted' — flip back to pending so we can re-send.
    const { error: updErr } = await supabase
      .from("friend_requests")
      .update({ status: "pending", created_at: new Date().toISOString() })
      .eq("id", outbound.id);
    if (updErr) return res.status(500).json({ error: updErr.message });
    const meBrief = await resolveUserBrief(req.user.id);
    pushNotification(toUserId, "friend_request", { fromUserId: req.user.id, fromUsername: meBrief.username || meBrief.name, requestId: outbound.id });
    return res.status(201).json({ status: "pending", requestId: outbound.id });
  }

  // Fresh request.
  const { data: created, error: insertErr } = await supabase
    .from("friend_requests")
    .insert({ from_user: req.user.id, to_user: toUserId, status: "pending" })
    .select("id")
    .single();
  if (insertErr) {
    console.error("friend request insert failed:", insertErr);
    return res.status(500).json({ error: insertErr.message });
  }
  const meBrief = await resolveUserBrief(req.user.id);
  pushNotification(toUserId, "friend_request", { fromUserId: req.user.id, fromUsername: meBrief.username || meBrief.name, requestId: created.id });
  res.status(201).json({ status: "pending", requestId: created.id });
});

// POST /api/friends/respond — { requestId, action: 'accept' | 'decline' }
router.post("/api/friends/respond", requireAuth, async (req, res) => {
  const { requestId, action } = req.body ?? {};
  if (!requestId || typeof requestId !== "string") {
    return res.status(400).json({ error: "requestId is required" });
  }
  if (action !== "accept" && action !== "decline") {
    return res.status(400).json({ error: "action must be 'accept' or 'decline'" });
  }

  // Remove the friend_request notification row(s) for THIS recipient tied to
  // this request, so the Recent Activity feed / bell stop showing it after it's
  // actioned (marking-read alone wasn't enough — the feed lists read rows too).
  const clearRequestNotif = async () => {
    const { error } = await supabase
      .from("social_notifications")
      .delete()
      .eq("user_id", req.user.id)
      .eq("type", "friend_request")
      .eq("payload->>requestId", requestId);
    if (error) console.error("clear friend_request notif:", error.message);
  };

  const { data: request, error: lookupErr } = await supabase
    .from("friend_requests")
    .select("id, from_user, to_user, status")
    .eq("id", requestId)
    .maybeSingle();
  if (lookupErr) return res.status(500).json({ error: lookupErr.message });
  // Gone entirely → treat as already handled (and clear any stale notification).
  if (!request) {
    await clearRequestNotif();
    return res.status(409).json({ error: "already_actioned", message: "This request was already handled." });
  }

  // Only the recipient may respond.
  if (request.to_user !== req.user.id) {
    return res.status(403).json({ error: "Only the recipient can respond to this request" });
  }
  // Already accepted/declined → graceful 409 (not a 500/400), and clear the row.
  if (request.status !== "pending") {
    await clearRequestNotif();
    return res.status(409).json({ error: "already_actioned", message: "This request was already handled." });
  }

  if (action === "accept") {
    const [a, b] = orderedPair(request.from_user, request.to_user);
    const { error: friendshipErr } = await supabase
      .from("friendships")
      .insert({ user_a: a, user_b: b });
    // 23505 = unique_violation: already friends (e.g. accepted twice in a race).
    // Tolerate it so the request transitions to accepted regardless.
    if (friendshipErr && friendshipErr.code !== "23505") {
      console.error("friend accept: friendship insert failed:", friendshipErr);
      return res.status(500).json({ error: friendshipErr.message });
    }
  }

  const newStatus = action === "accept" ? "accepted" : "declined";
  const { error: updErr } = await supabase
    .from("friend_requests")
    .update({ status: newStatus })
    .eq("id", requestId);
  if (updErr) return res.status(500).json({ error: updErr.message });

  // The request is handled — remove its notification so the feed clears for good.
  await clearRequestNotif();

  // Notify the original sender that their request was accepted.
  if (action === "accept") {
    const meBrief = await resolveUserBrief(req.user.id);
    pushNotification(request.from_user, "friend_accepted", { fromUserId: req.user.id, fromUsername: meBrief.username || meBrief.name });
  }

  res.json({ status: newStatus });
});

// GET /api/friends — accepted friends as [{ userId, name, username, isOnline, lastActive }]
router.get("/api/friends", requireAuth, async (req, res) => {
  const me = req.user.id;
  const { data, error } = await supabase
    .from("friendships")
    .select("user_a, user_b, created_at")
    .or(`user_a.eq.${me},user_b.eq.${me}`)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const otherIds = (data ?? []).map(row => (row.user_a === me ? row.user_b : row.user_a));
  const friends = await Promise.all(otherIds.map(resolveUserBrief));
  const visible = await visibleActiveNotebooks(me, friends).catch(() => new Map());
  res.json(friends.map(f => {
    const online = isOnline(f.lastActive);
    const { lastNotebookId, ...rest } = f;
    return {
      ...rest,
      isOnline: online,
      // Only present when we share the notebook — see visibleActiveNotebooks.
      activeNotebook: online ? (visible.get(lastNotebookId) ?? null) : null,
    };
  }));
});

// GET /api/friends/:friendId/shared — notebooks the caller and this friend both
// belong to. Every notebook returned is one the caller is already a member of,
// so this reveals nothing new about the friend's other notebooks.
router.get("/api/friends/:friendId/shared", requireAuth, async (req, res) => {
  const me = req.user.id;
  const friendId = req.params.friendId;
  if (!UUID_RE.test(friendId)) return res.status(400).json({ error: "Invalid friend id" });

  const [a, b] = orderedPair(me, friendId);
  const { data: friendship } = await supabase
    .from("friendships").select("user_a").eq("user_a", a).eq("user_b", b).maybeSingle();
  if (!friendship) return res.status(403).json({ error: "Not your friend" });

  const [mine, theirs] = await Promise.all([
    supabase.from("notebook_members").select("notebook_id").eq("user_id", me),
    supabase.from("notebook_members").select("notebook_id").eq("user_id", friendId),
  ]);
  const theirIds = new Set((theirs.data ?? []).map(r => r.notebook_id));
  const shared = (mine.data ?? []).map(r => r.notebook_id).filter(id => theirIds.has(id));
  if (shared.length === 0) return res.json([]);

  const { data: nbs, error } = await supabase
    .from("notebooks")
    .select("id, title, topic, color, updated_at")
    .in("id", shared)
    .order("updated_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(nbs ?? []);
});

router.get("/api/friends/best", requireAuth, async (req, res) => {
  const me = req.user.id;

  // 1. My friends, with friendship recency for the fallback ordering.
  const { data: friendships, error: fErr } = await supabase
    .from("friendships")
    .select("user_a, user_b, created_at")
    .or(`user_a.eq.${me},user_b.eq.${me}`)
    .order("created_at", { ascending: false });
  if (fErr) return res.status(500).json({ error: fErr.message });

  // friendId → friendship created_at (preserves newest-first fallback order)
  const friendOrder = (friendships ?? []).map(row => row.user_a === me ? row.user_b : row.user_a);
  if (!friendOrder.length) return res.json([]);

  // 2. My notebook memberships.
  const { data: myMemberships } = await supabase
    .from("notebook_members")
    .select("notebook_id")
    .eq("user_id", me);
  const myNotebookIds = new Set((myMemberships ?? []).map(m => m.notebook_id));

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // 3. For each friend: shared notebooks → activity count (either user, 90d).
  const ranked = await Promise.all(friendOrder.map(async (friendId) => {
    let activityCount = 0;

    if (myNotebookIds.size) {
      const { data: friendMemberships } = await supabase
        .from("notebook_members")
        .select("notebook_id")
        .eq("user_id", friendId);
      const shared = (friendMemberships ?? [])
        .map(m => m.notebook_id)
        .filter(id => myNotebookIds.has(id));

      if (shared.length) {
        const { count } = await supabase
          .from("notebook_activity")
          .select("id", { count: "exact", head: true })
          .in("notebook_id", shared)
          .in("user_id", [me, friendId])
          .gte("created_at", since);
        activityCount = count ?? 0;
      }
    }

    return { friendId, activityCount };
  }));

  const totalActivity = ranked.reduce((sum, r) => sum + r.activityCount, 0);

  // Sort: by activity desc when we have data, otherwise keep newest-first order.
  const ordered = totalActivity > 0
    ? [...ranked].sort((x, y) => y.activityCount - x.activityCount)
    : ranked; // already newest-first from friendOrder

  const top = ordered.slice(0, 5);
  const result = await Promise.all(top.map(async (r) => {
    const brief = await resolveUserBrief(r.friendId);
    return { ...brief, activityCount: r.activityCount };
  }));

  res.json(result);
});

// GET /api/friends/requests — incoming pending requests
router.get("/api/friends/requests", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, from_user, created_at")
    .eq("to_user", req.user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const rows = await Promise.all((data ?? []).map(async (r) => {
    const brief = await resolveUserBrief(r.from_user);
    return {
      requestId:    r.id,
      fromUserId:   brief.userId,
      fromName:     brief.name,
      fromUsername: brief.username,
      created_at:   r.created_at,
    };
  }));
  res.json(rows);
});

// GET /api/friends/requests/outgoing — pending requests I've SENT
router.get("/api/friends/requests/outgoing", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, to_user, created_at")
    .eq("from_user", req.user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const rows = await Promise.all((data ?? []).map(async (r) => {
    const brief = await resolveUserBrief(r.to_user);
    return {
      requestId:  r.id,
      toUserId:   brief.userId,
      toName:     brief.name,
      toUsername: brief.username,
      created_at: r.created_at,
    };
  }));
  res.json(rows);
});

// DELETE /api/friends/request/:requestId — cancel an outgoing pending request.
// Only the sender (from_user) may cancel.
router.delete("/api/friends/request/:requestId", requireAuth, async (req, res) => {
  const { data: reqRow, error: lookupErr } = await supabase
    .from("friend_requests")
    .select("id, from_user, status")
    .eq("id", req.params.requestId)
    .maybeSingle();
  if (lookupErr) return res.status(500).json({ error: lookupErr.message });
  if (!reqRow) return res.status(204).end(); // already gone — idempotent
  if (reqRow.from_user !== req.user.id) {
    return res.status(403).json({ error: "Only the sender can cancel this request" });
  }

  const { error } = await supabase.from("friend_requests").delete().eq("id", req.params.requestId);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// GET /api/friends/blocked — users I've blocked
router.get("/api/friends/blocked", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("blocks")
    .select("blocked, created_at")
    .eq("blocker", req.user.id)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const rows = await Promise.all((data ?? []).map(async (r) => {
    const brief = await resolveUserBrief(r.blocked);
    return { userId: brief.userId, username: brief.username, name: brief.name };
  }));
  res.json(rows);
});

// POST /api/friends/block — { userId }: block a user, sever friendship + requests
router.post("/api/friends/block", requireAuth, async (req, res) => {
  const { userId } = req.body ?? {};
  if (!userId || typeof userId !== "string") return res.status(400).json({ error: "userId is required" });
  // Explicit UUID check so the .or() filter interpolation below can't depend on
  // column typing / insert ordering for its safety (defense in depth).
  if (!UUID_RE.test(userId)) return res.status(400).json({ error: "userId must be a valid id" });
  if (userId === req.user.id) return res.status(400).json({ error: "You can't block yourself" });

  // Insert the block (idempotent on the unique (blocker, blocked) pair).
  const { error: blockErr } = await supabase
    .from("blocks")
    .upsert({ blocker: req.user.id, blocked: userId }, { onConflict: "blocker,blocked" });
  if (blockErr) return res.status(500).json({ error: blockErr.message });

  // Sever any existing friendship (normalized pair).
  const [a, b] = orderedPair(req.user.id, userId);
  await supabase.from("friendships").delete().eq("user_a", a).eq("user_b", b);

  // Delete any pending/other requests in either direction.
  await supabase.from("friend_requests").delete()
    .or(`and(from_user.eq.${req.user.id},to_user.eq.${userId}),and(from_user.eq.${userId},to_user.eq.${req.user.id})`);

  res.json({ ok: true });
});

// POST /api/friends/unblock — { userId }: remove the block row
router.post("/api/friends/unblock", requireAuth, async (req, res) => {
  const { userId } = req.body ?? {};
  if (!userId || typeof userId !== "string") return res.status(400).json({ error: "userId is required" });

  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker", req.user.id)
    .eq("blocked", userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// DELETE /api/friends/:friendUserId — remove a friendship (idempotent)
router.delete("/api/friends/:friendUserId", requireAuth, async (req, res) => {
  const [a, b] = orderedPair(req.user.id, req.params.friendUserId);
  const { error } = await supabase.from("friendships").delete().eq("user_a", a).eq("user_b", b);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// GET /api/friends/search?q=... — search users by USERNAME prefix (limit 10).
// Returns [{ userId, username, name }] — never email. Querying the profiles
// table by username keeps emails fully private.
router.get("/api/friends/search", requireAuth, async (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  if (q.length < 2) return res.json([]); // require a real query

  // Escape LIKE wildcards so a literal % or _ in the query isn't a pattern.
  const esc = q.replace(/[%_\\]/g, m => `\\${m}`);

  // Pull a few extra so block-filtering still leaves up to 10 results.
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username")
    .ilike("username", `${esc}%`)
    .neq("user_id", req.user.id)
    .not("username", "is", null)
    .limit(25);
  if (error) return res.status(500).json({ error: error.message });

  // Exclude anyone I've blocked or who has blocked me.
  const blocked = await blockedUserIds(req.user.id);
  const visible = (data ?? []).filter(r => !blocked.has(r.user_id)).slice(0, 10);

  // Resolve display name from auth metadata; fall back to the username.
  const rows = await Promise.all(visible.map(async (r) => {
    const { data: authData } = await supabase.auth.admin.getUserById(r.user_id);
    return {
      userId:   r.user_id,
      username: r.username,
      name:     authData?.user?.user_metadata?.full_name?.trim() || r.username,
    };
  }));

  res.json(rows);
});
