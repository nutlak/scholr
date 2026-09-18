import { supabase } from "./supabase.js";

export function orderedPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

// Resolve a user id → { userId, name, username }. Never returns email — friend
// surfaces are username-based and must not leak email addresses.
// Migration 033 adds profiles.last_notebook_id. Until it runs, selecting the
// column errors and would blank out every name and presence dot with it — so
// fall back to the pre-033 shape rather than losing the whole row.
export let profileHasNotebookColumn = true;
export async function profileBrief(uid) {
  if (profileHasNotebookColumn) {
    const res = await supabase
      .from("profiles").select("username, last_active, last_notebook_id")
      .eq("user_id", uid).maybeSingle();
    if (!res.error) return res;
    if (!res.error.message?.includes("last_notebook_id")) return res;
    profileHasNotebookColumn = false;
    console.warn("[presence] profiles.last_notebook_id missing — run migration 033");
  }
  return supabase
    .from("profiles").select("username, last_active")
    .eq("user_id", uid).maybeSingle();
}

export async function resolveUserBrief(uid) {
  const [authRes, profRes] = await Promise.all([
    supabase.auth.admin.getUserById(uid),
    profileBrief(uid),
  ]);
  const u = authRes.data?.user;
  const username = profRes.data?.username ?? null;
  return {
    userId:     uid,
    name:       u?.user_metadata?.full_name?.trim() || username || "User",
    username,
    lastActive: profRes.data?.last_active ?? null,
    lastNotebookId: profRes.data?.last_notebook_id ?? null,
  };
}

// Presence context, filtered by what the *viewer* is allowed to know. A friend
// studying in a notebook you don't share shows as plain "online" — the title of
// a notebook you can't open must never leak through a friends list.
export async function visibleActiveNotebooks(viewerId, friends) {
  const wanted = [...new Set(
    friends.filter(f => f.lastNotebookId && isOnline(f.lastActive)).map(f => f.lastNotebookId)
  )];
  if (wanted.length === 0) return new Map();

  const { data: shared } = await supabase
    .from("notebook_members")
    .select("notebook_id")
    .eq("user_id", viewerId)
    .in("notebook_id", wanted);
  const allowed = new Set((shared ?? []).map(r => r.notebook_id));
  if (allowed.size === 0) return new Map();

  const { data: nbs } = await supabase
    .from("notebooks")
    .select("id, title")
    .in("id", [...allowed]);
  return new Map((nbs ?? []).map(n => [n.id, { id: n.id, title: n.title }]));
}

// Insert a social notification (friend_request | notebook_invite | friend_accepted).
// Fire-and-forget — a failed notification must never break the triggering action.
// Returns true on success, false if the insert failed (callers that need to
// know — e.g. the renewal worker — can react; existing callers ignore it).
export async function pushNotification(userId, type, payload = {}) {
  const { error } = await supabase
    .from("social_notifications")
    .insert({ user_id: userId, type, payload });
  if (error) { console.error(`pushNotification(${type}) failed:`, error); return false; }
  return true;
}

export const ONLINE_WINDOW_MS = 5 * 60 * 1000;
export const isOnline = (lastActive) =>
  !!lastActive && (Date.now() - new Date(lastActive).getTime() <= ONLINE_WINDOW_MS);

// True if either user has blocked the other (in either direction).
export async function isBlockedBetween(u1, u2) {
  const { data } = await supabase
    .from("blocks")
    .select("id")
    .or(`and(blocker.eq.${u1},blocked.eq.${u2}),and(blocker.eq.${u2},blocked.eq.${u1})`)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

// Set of user ids involved in a block edge with `me` (either direction).
export async function blockedUserIds(me) {
  const { data } = await supabase
    .from("blocks")
    .select("blocker, blocked")
    .or(`blocker.eq.${me},blocked.eq.${me}`);
  const set = new Set();
  for (const r of data ?? []) set.add(r.blocker === me ? r.blocked : r.blocker);
  return set;
}
