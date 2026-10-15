import { createBatcher, createTtlCache } from "./batch.js";
import { supabase } from "./supabase.js";

export function orderedPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

// ── Who is this user? (names and presence, for friend surfaces) ──────────────
// These lookups sit under every friends list, which the app re-fetches every
// minute per open browser, and under the member list of every open unit. They
// used to cost two requests per person (a profile query plus an auth-service
// call), so a list of N people was 2N requests, a classic N+1. Now:
//   - profile reads made in the same moment are one `IN (...)` query (batch.js),
//     so `Promise.all(ids.map(resolveUserBrief))` is one query for all of them;
//   - auth-side details (email, full name) are cached for ten minutes, since
//     they change rarely and the auth service has no batch call.

// Migration 033 adds profiles.last_notebook_id. Until it runs, selecting the
// column errors and would blank out every name and presence dot with it — so
// fall back to the pre-033 shape rather than losing the whole row.
export let profileHasNotebookColumn = true;
const loadProfiles = createBatcher(async (uids) => {
  const run = (cols) => supabase.from("profiles").select(cols).in("user_id", uids);
  let res = await run(profileHasNotebookColumn ? "user_id, username, last_active, last_notebook_id" : "user_id, username, last_active");
  if (res.error && profileHasNotebookColumn && res.error.message?.includes("last_notebook_id")) {
    profileHasNotebookColumn = false;
    console.warn("[presence] profiles.last_notebook_id missing — run migrations/033_presence_notebook.sql");
    res = await run("user_id, username, last_active");
  }
  if (res.error) throw res.error;
  return new Map((res.data ?? []).map(row => [row.user_id, row]));
});

// Same shape as a single-row Supabase read: { data: row | null, error }.
export async function profileBrief(uid) {
  try { return { data: await loadProfiles(uid), error: null }; }
  catch (error) { return { data: null, error }; }
}

// The auth service's view of a user: { email, fullName }. Failures aren't cached,
// and simultaneous lookups of one person share a single request.
const AUTH_TTL_MS = 10 * 60 * 1000;
const authCache = createTtlCache({ ttlMs: AUTH_TTL_MS, max: 5000 });
const authInflight = new Map();
export async function authIdentity(uid) {
  const hit = authCache.get(uid);
  if (hit) return hit;
  if (!authInflight.has(uid)) {
    authInflight.set(uid, (async () => {
      const { data, error } = await supabase.auth.admin.getUserById(uid);
      const u = data?.user;
      if (error || !u) return { email: null, fullName: null };
      const v = { email: u.email ?? null, fullName: u.user_metadata?.full_name ?? null };
      authCache.set(uid, v);
      return v;
    })().finally(() => authInflight.delete(uid)));
  }
  return authInflight.get(uid);
}

// Resolve a user id → { userId, name, username }. Never returns email — friend
// surfaces are username-based and must not leak email addresses.
export async function resolveUserBrief(uid) {
  const [ident, profRes] = await Promise.all([authIdentity(uid), profileBrief(uid)]);
  const username = profRes.data?.username ?? null;
  return {
    userId:     uid,
    name:       ident.fullName?.trim() || username || "User",
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
