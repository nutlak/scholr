import "./env.js";
import webpush from "web-push";
import { supabase } from "./supabase.js";
import { isOnline, resolveUserBrief } from "./users.js";

// ── Web push (friends-studying-now notification) ──────────────────────────────
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || null;
export const pushEnabled = !!(VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (pushEnabled) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@scholr.dev",
    VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

// A push subscription's `endpoint` is a URL the *client* supplies, and the
// server later makes an outbound request to it (webpush.sendNotification)
// whenever a friend's presence triggers a notification — unvalidated, that's
// an SSRF primitive fully triggerable with two attacker-controlled accounts
// (no victim needed): register a malicious endpoint, friend a second
// account, trigger that account's heartbeat. Real push endpoints only ever
// come from a small set of known browser-vendor push services, so allowlist
// by host rather than trying to block-list "internal-looking" URLs.
export const ALLOWED_PUSH_ENDPOINT_HOSTS = [
  /(^|\.)fcm\.googleapis\.com$/,       // Chrome, Edge, other Chromium browsers
  /(^|\.)android\.googleapis\.com$/,   // older Chrome/Android
  /(^|\.)push\.apple\.com$/,           // Safari
  /(^|\.)mozilla\.com$/,               // Firefox
  /(^|\.)notify\.windows\.com$/,       // legacy Edge
];
export function isAllowedPushEndpoint(urlStr) {
  let url;
  try { url = new URL(urlStr); } catch { return false; }
  if (url.protocol !== "https:") return false;
  return ALLOWED_PUSH_ENDPOINT_HOSTS.some(re => re.test(url.hostname));
}

export const PUSH_THROTTLE_MS = 60 * 60 * 1000;
export async function notifyFriendsSomeoneCameOnline(userId) {
  if (!pushEnabled) return;

  const { data: friendships } = await supabase
    .from("friendships")
    .select("user_a, user_b")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);
  const friendIds = (friendships ?? []).map(row => (row.user_a === userId ? row.user_b : row.user_a));
  if (friendIds.length === 0) return;

  const [{ data: profiles }, { data: subs }, { data: throttle }] = await Promise.all([
    supabase.from("profiles").select("user_id, last_active").in("user_id", friendIds),
    supabase.from("push_subscriptions").select("user_id, endpoint, p256dh, auth").in("user_id", friendIds),
    supabase.from("push_notify_log").select("to_user_id, last_sent_at").eq("from_user_id", userId).in("to_user_id", friendIds),
  ]);

  const lastActiveById = new Map((profiles ?? []).map(p => [p.user_id, p.last_active]));
  const throttledUntil = new Map((throttle ?? [])
    .filter(t => Date.now() - new Date(t.last_sent_at).getTime() < PUSH_THROTTLE_MS)
    .map(t => [t.to_user_id, true]));

  const targets = friendIds.filter(id => !isOnline(lastActiveById.get(id)) && !throttledUntil.has(id));
  if (targets.length === 0) return;

  const me = await resolveUserBrief(userId);
  const payload = JSON.stringify({
    title: "Scholr",
    body: `${me.name} is studying right now — join them?`,
  });

  const subsByUser = new Map();
  for (const s of subs ?? []) {
    if (!targets.includes(s.user_id)) continue;
    if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, []);
    subsByUser.get(s.user_id).push(s);
  }

  await Promise.all([...subsByUser.entries()].map(async ([friendId, friendSubs]) => {
    await Promise.all(friendSubs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
      } catch (err) {
        // 404/410 = the subscription is dead (uninstalled, permission revoked); clean it up.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("user_id", friendId).eq("endpoint", s.endpoint);
        } else {
          console.error("push send error:", err?.message || err);
        }
      }
    }));
    await supabase.from("push_notify_log")
      .upsert({ from_user_id: userId, to_user_id: friendId, last_sent_at: new Date().toISOString() });
  }));
}
