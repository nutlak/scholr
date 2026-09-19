// Presence, push subscriptions, usernames and notifications.
import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { VAPID_PUBLIC_KEY, isAllowedPushEndpoint, notifyFriendsSomeoneCameOnline, pushEnabled } from "../lib/push.js";
import { supabase } from "../lib/supabase.js";
import { isOnline } from "../lib/users.js";
import { RESERVED_USERNAMES, UUID_RE } from "../lib/validate.js";

export const router = Router();

// GET /api/push/vapid-public-key — public key the client needs for PushManager.subscribe()
router.get("/api/push/vapid-public-key", requireAuth, (req, res) => {
  if (!pushEnabled) {
    return res.status(503).json({
      error: "push_unavailable",
      message: "Push notifications aren't set up yet — check back soon.",
    });
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe — body: a PushSubscription (from subscription.toJSON())
router.post("/api/push/subscribe", requireAuth, async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "endpoint and keys.{p256dh,auth} are required" });
  }
  if (!isAllowedPushEndpoint(endpoint)) {
    return res.status(400).json({ error: "Unrecognized push endpoint." });
  }
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: req.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    { onConflict: "user_id,endpoint" },
  );
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// POST /api/push/unsubscribe — body: { endpoint }
router.post("/api/push/unsubscribe", requireAuth, async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: "endpoint is required" });
  const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", req.user.id).eq("endpoint", endpoint);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// POST /api/me/heartbeat — mark the current user active now (drives online status)
router.post("/api/me/heartbeat", requireAuth, async (req, res) => {
  const now = new Date().toISOString();
  // Optional: which notebook the user is looking at, so friends can see what
  // they're studying rather than just that they're around. Membership is
  // checked here so a caller can't advertise presence in a notebook they
  // aren't in — the friends list trusts this value.
  const raw = req.body?.notebookId;
  let notebookId = null;
  if (typeof raw === "string" && UUID_RE.test(raw)) {
    const { data: member } = await supabase
      .from("notebook_members")
      .select("user_id")
      .eq("notebook_id", raw)
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (member) notebookId = raw;
  }

  // Read the prior value before overwriting, so we can tell "just came
  // online" (drives the push in notifyFriendsSomeoneCameOnline) apart from
  // "still here" (fired every 60s while the app stays open).
  const { data: prior } = await supabase.from("profiles").select("last_active").eq("user_id", req.user.id).maybeSingle();
  const wasOffline = !isOnline(prior?.last_active ?? null);

  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: req.user.id, last_active: now, last_notebook_id: notebookId }, { onConflict: "user_id" });

  if (wasOffline) notifyFriendsSomeoneCameOnline(req.user.id).catch(err => console.error("notifyFriendsSomeoneCameOnline error:", err));

  // Migration 033 may not have run yet — fall back to presence without context.
  if (error?.message?.includes("last_notebook_id")) {
    const { error: retryErr } = await supabase
      .from("profiles")
      .upsert({ user_id: req.user.id, last_active: now }, { onConflict: "user_id" });
    if (retryErr) return res.status(500).json({ error: retryErr.message });
    return res.json({ ok: true });
  }
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// GET /api/me/username — current user's username (null if not set yet)
// GET /api/u/:username — PUBLIC. Resolves a username to the user id a
// referral link needs, so invites can be `scholr.dev/@noah` instead of
// `scholr.dev?ref=<uuid>`. A link nobody can say out loud is a link nobody
// shares, and word of mouth is how this app spreads.
//
// Returns only the display name — the same thing any friend list already
// shows — and nothing that isn't needed to render "Noah invited you".
router.get("/api/u/:username", async (req, res) => {
  const username = String(req.params.username ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return res.status(404).json({ error: "not_found" });
  }
  const { data } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();
  if (!data) return res.status(404).json({ error: "not_found" });

  const { data: u } = await supabase.auth.admin.getUserById(data.user_id);
  res.json({
    userId: data.user_id,
    name: u?.user?.user_metadata?.full_name?.split(" ")[0]?.trim() ?? null,
  });
});

router.get("/api/me/username", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ username: data?.username ?? null });
});

router.post("/api/me/username", requireAuth, async (req, res) => {
  let { username } = req.body ?? {};
  if (typeof username !== "string") {
    return res.status(400).json({ error: "username is required" });
  }
  username = username.trim().toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: "Username must be 3–20 characters: letters, numbers, or underscores only" });
  }
  if (RESERVED_USERNAMES.has(username)) {
    return res.status(400).json({ error: "That username is reserved" });
  }

  // Reject if taken by another user (stored lowercase, so eq is case-insensitive).
  const { data: existing, error: lookupErr } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();
  if (lookupErr) return res.status(500).json({ error: lookupErr.message });
  if (existing && existing.user_id !== req.user.id) {
    return res.status(409).json({ error: "Username already taken" });
  }

  const { error: upsertErr } = await supabase
    .from("profiles")
    .upsert({ user_id: req.user.id, username }, { onConflict: "user_id" });
  if (upsertErr) {
    // 23505 = unique_violation from the lower(username) index (lost a race).
    if (upsertErr.code === "23505") {
      return res.status(409).json({ error: "Username already taken" });
    }
    return res.status(500).json({ error: upsertErr.message });
  }

  res.json({ username });
});

// GET /api/social/notifications — recent notifications, unread first
router.get("/api/social/notifications", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("social_notifications")
    .select("id, type, payload, read, created_at")
    .eq("user_id", req.user.id)
    .order("read", { ascending: true })        // false (unread) sorts before true
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return res.status(500).json({ error: error.message });

  const notifications = data ?? [];
  const unreadCount = notifications.filter(n => !n.read).length;
  res.json({ notifications, unreadCount });
});

// POST /api/social/notifications/read — { ids } marks those read; omit/empty = all
router.post("/api/social/notifications/read", requireAuth, async (req, res) => {
  const { ids } = req.body ?? {};
  let q = supabase
    .from("social_notifications")
    .update({ read: true })
    .eq("user_id", req.user.id);
  if (Array.isArray(ids) && ids.length) q = q.in("id", ids);
  else q = q.eq("read", false); // mark all unread as read
  const { error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// DELETE /api/social/notifications — clear inbox: delete ALL of the current
// user's notifications (actually deletes, so nothing resurrects on refresh).
router.delete("/api/social/notifications", requireAuth, async (req, res) => {
  const { error } = await supabase
    .from("social_notifications")
    .delete()
    .eq("user_id", req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});
