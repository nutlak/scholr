// Planned study sessions: "Study for Unit 3, tonight at 8" — a time the whole
// unit can see, say "I'm in" to, and get reminded about.
//
// Storage, with no new tables (this server can't run DDL): rows in
// `forge_outputs`, a generic table whose `type` is free-form.
//   type "study_session"     content = JSON { startsAt, note, remindedAt? }
//   type "study_session_in"  title = the session's id, user_id = who's going
// ponytail: forge_outputs is a stand-in. Give sessions their own tables
// (sessions, session_rsvps) once there's a reason to query by time in SQL; the
// reminder scan below reads every recent session row.
import { supabase } from "./supabase.js";
import { pushToUsers } from "./push.js";

export const SESSION_TYPE = "study_session";
export const RSVP_TYPE = "study_session_in";

export const MIN_LEAD_MS = 5 * 60 * 1000;            // can't plan one that starts in under 5 minutes
export const MAX_LEAD_MS = 30 * 24 * 60 * 60 * 1000; // or more than 30 days out
export const MAX_UPCOMING_PER_UNIT = 5;
export const REMIND_WINDOW_MS = 10 * 60 * 1000;      // reminder goes out in the last 10 minutes
const STILL_UPCOMING_MS = 60 * 60 * 1000;            // a session stays listed for an hour after it starts

// Validates a create request. Returns { startsAt: ISO string, note } or { error }.
export function parseSessionInput(body, now = Date.now()) {
  const t = Date.parse(body?.startsAt);
  if (!Number.isFinite(t)) return { error: "Pick a date and time." };
  if (t < now + MIN_LEAD_MS) return { error: "Pick a time at least 5 minutes from now." };
  if (t > now + MAX_LEAD_MS) return { error: "Sessions can be planned up to 30 days ahead." };
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 80) : "";
  return { startsAt: new Date(t).toISOString(), note };
}

export function readSession(row) {
  let c = {};
  try { c = JSON.parse(row.content || "{}"); } catch { /* corrupt row: treated as a session that never starts */ }
  return { id: row.id, notebookId: row.notebook_id, createdBy: row.user_id, startsAt: c.startsAt ?? null, note: c.note ?? "", remindedAt: c.remindedAt ?? null };
}

export const isUpcoming = (s, now = Date.now()) => !!s.startsAt && Date.parse(s.startsAt) > now - STILL_UPCOMING_MS;

// Sessions whose reminder is due: starting within the window, not yet sent.
export function dueForReminder(sessions, now = Date.now()) {
  return sessions.filter(s => {
    const t = Date.parse(s.startsAt);
    return Number.isFinite(t) && !s.remindedAt && t > now && t - now <= REMIND_WINDOW_MS;
  });
}

async function namesFor(userIds) {
  if (!userIds.length) return new Map();
  const { data } = await supabase.from("profiles").select("user_id, username").in("user_id", userIds);
  return new Map((data ?? []).map(p => [p.user_id, p.username || "Member"]));
}

// Upcoming sessions for a unit, each with who's going.
export async function listSessions(notebookId, myId, now = Date.now()) {
  const { data: rows } = await supabase.from("forge_outputs")
    .select("id, notebook_id, user_id, content").eq("notebook_id", notebookId).eq("type", SESSION_TYPE);
  const sessions = (rows ?? []).map(readSession).filter(s => isUpcoming(s, now))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).slice(0, MAX_UPCOMING_PER_UNIT);
  if (!sessions.length) return [];
  const { data: rsvps } = await supabase.from("forge_outputs")
    .select("user_id, title").eq("notebook_id", notebookId).eq("type", RSVP_TYPE).in("title", sessions.map(s => s.id));
  const names = await namesFor([...new Set((rsvps ?? []).map(r => r.user_id))]);
  return sessions.map(s => {
    const going = (rsvps ?? []).filter(r => r.title === s.id).map(r => ({ userId: r.user_id, name: names.get(r.user_id) || "Member" }));
    return { id: s.id, startsAt: s.startsAt, note: s.note, createdBy: s.createdBy, going, mine: going.some(g => g.userId === myId) };
  });
}

// Tell some people about a session: an in-app notice (bell) plus web push.
// `social_notifications.type` is CHECK-constrained and can't gain a value
// without DDL, so this rides on "notebook_invite" (which already opens the
// unit when tapped) with payload.kind saying what it really is.
export async function notifyAboutSession({ userIds, kind, notebookId, notebookTitle, startsAt, fromUserId, pushBody }) {
  if (!userIds.length) return;
  const from = fromUserId ? (await namesFor([fromUserId])).get(fromUserId) : null;
  await supabase.from("social_notifications").insert(userIds.map(user_id => ({
    user_id, type: "notebook_invite",
    payload: { kind, notebookId, notebookTitle, startsAt, ...(from ? { fromUsername: from } : {}) },
  })));
  await pushToUsers(userIds, { title: notebookTitle || "Scholr", body: pushBody(from) }).catch(() => {});
}

// Worker entry point (hourly cadence is too coarse; index.js runs this every
// minute). Reminds the people who said "I'm in" that a session starts soon.
export async function sendDueSessionReminders(now = Date.now()) {
  const { data: rows } = await supabase.from("forge_outputs")
    .select("id, notebook_id, user_id, content").eq("type", SESSION_TYPE).gte("created_at", new Date(now - MAX_LEAD_MS - STILL_UPCOMING_MS).toISOString());
  const due = dueForReminder((rows ?? []).map(readSession), now);
  let sent = 0;
  for (const s of due) {
    // Claim it first: if two instances race, only the one whose update matches
    // the unreminded content proceeds.
    const row = rows.find(r => r.id === s.id);
    const next = JSON.stringify({ ...JSON.parse(row.content), remindedAt: new Date(now).toISOString() });
    const { data: claimed } = await supabase.from("forge_outputs")
      .update({ content: next }).eq("id", s.id).eq("content", row.content).select("id");
    if (!claimed?.length) continue;
    const { data: rsvps } = await supabase.from("forge_outputs").select("user_id").eq("type", RSVP_TYPE).eq("title", s.id);
    const { data: nb } = await supabase.from("notebooks").select("title").eq("id", s.notebookId).maybeSingle();
    await notifyAboutSession({
      userIds: [...new Set((rsvps ?? []).map(r => r.user_id))], kind: "session_reminder",
      notebookId: s.notebookId, notebookTitle: nb?.title, startsAt: s.startsAt,
      pushBody: () => "Your study session starts in a few minutes.",
    });
    sent++;
  }
  return sent;
}
