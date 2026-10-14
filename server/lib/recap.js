// The weekly recap email: how your week went, what's due, who studied with
// you, what's planned. Sunday evening, once a week, only to people who have
// something in it, and never to anyone who unsubscribed.
//
// planRecaps() only reads; sendWeeklyRecaps() is the one that emails. Local
// runs have DISABLE_WORKERS=1 and production credentials, so nothing here is
// ever started from a script or a test: `npm run recap` is dry-run only.
import { supabase } from "./supabase.js";
import { recapEmailHtml, sendRecapEmail } from "../email.js";
import { SESSION_TYPE, isUpcoming, readSession } from "./sessions.js";

const DAY = 864e5;
export const RECAP_EVENT = "weekly_recap_sent";
const MIN_GAP_MS = 6 * DAY;          // at most one a week
const ACTIVE_WITHIN_MS = 14 * DAY;   // don't write to people who've left

const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);

// Is there anything worth an email? A recap that says "0 days, nothing due"
// is just noise.
export function worthSending(d) {
  return d.daysStudied > 0 || d.due.length > 0 || d.sessions.length > 0;
}

// Sunday between 22:00 and 23:59 UTC (early evening in the US). The worker
// runs hourly; the once-a-week dedupe keeps the second hour from re-sending.
export function inRecapWindow(now = new Date()) {
  return now.getUTCDay() === 0 && now.getUTCHours() >= 22;
}

async function dataFor(userId, now) {
  const weekAgo = ymd(now - 7 * DAY);
  const [{ data: days }, { data: members }, { data: friendships }] = await Promise.all([
    supabase.from("daily_activity").select("date").eq("user_id", userId).gte("date", weekAgo),
    supabase.from("notebook_members").select("notebook_id").eq("user_id", userId),
    supabase.from("friendships").select("user_a, user_b").or(`user_a.eq.${userId},user_b.eq.${userId}`),
  ]);
  const nbIds = (members ?? []).map(m => m.notebook_id);
  const friendIds = (friendships ?? []).map(f => (f.user_a === userId ? f.user_b : f.user_a));

  const [{ data: nbs }, { data: sessRows }, { data: friendDays }] = await Promise.all([
    nbIds.length ? supabase.from("notebooks").select("id, title, due_date, class_id").in("id", nbIds) : { data: [] },
    nbIds.length ? supabase.from("forge_outputs").select("id, notebook_id, user_id, content").eq("type", SESSION_TYPE).in("notebook_id", nbIds) : { data: [] },
    friendIds.length ? supabase.from("daily_activity").select("user_id").in("user_id", friendIds).gte("date", weekAgo) : { data: [] },
  ]);

  const today = ymd(now), nextWeek = ymd(now + 7 * DAY);
  const titleOf = new Map((nbs ?? []).map(n => [n.id, n.title]));
  const due = (nbs ?? []).filter(n => n.due_date && n.due_date >= today && n.due_date <= nextWeek)
    .sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 5)
    .map(n => ({ title: n.title, dueDate: n.due_date }));
  const sessions = (sessRows ?? []).map(readSession)
    .filter(s => isUpcoming(s, now) && Date.parse(s.startsAt) <= now + 7 * DAY)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).slice(0, 3)
    .map(s => ({ title: titleOf.get(s.notebookId) ?? "a unit", startsAt: s.startsAt, note: s.note }));

  return {
    daysStudied: new Set((days ?? []).map(d => d.date)).size,
    friendsStudied: new Set((friendDays ?? []).map(d => d.user_id)).size,
    due, sessions,
  };
}

// Who would get a recap right now, and what it would say. Read-only.
// ponytail: one candidate at a time, about seven queries each. Fine for a weekly
// job into the low thousands of people; past that, batch the reads with
// `.in('user_id', chunk)` in chunks of ~50 (PostgREST caps a response at 1000
// rows, so don't fetch everyone in one query).
export async function planRecaps(now = Date.now()) {
  const { data: profs } = await supabase.from("profiles")
    .select("user_id, username, last_active, email_unsubscribed")
    .gte("last_active", new Date(now - ACTIVE_WITHIN_MS).toISOString());
  const candidates = (profs ?? []).filter(p => !p.email_unsubscribed);
  if (!candidates.length) return [];

  const { data: recent } = await supabase.from("user_events").select("user_id")
    .eq("event_type", RECAP_EVENT).gte("created_at", new Date(now - MIN_GAP_MS).toISOString())
    .in("user_id", candidates.map(p => p.user_id));
  const already = new Set((recent ?? []).map(r => r.user_id));

  const plan = [];
  for (const p of candidates) {
    if (already.has(p.user_id)) continue;
    const { data: u } = await supabase.auth.admin.getUserById(p.user_id);
    const email = u?.user?.email;
    if (!email) continue;
    const data = await dataFor(p.user_id, now);
    if (!worthSending(data)) continue;
    plan.push({ userId: p.user_id, email, name: u.user.user_metadata?.first_name || p.username || "", data });
  }
  return plan;
}

// The worker entry point. Returns how many it sent.
export async function sendWeeklyRecaps(now = Date.now()) {
  if (process.env.WEEKLY_RECAP_DISABLED === "1") return 0;
  let sent = 0;
  for (const r of await planRecaps(now)) {
    try {
      await sendRecapEmail(r.email, r.name, r.userId, r.data);
      // Awaited: this row is the "already sent this week" record.
      await supabase.from("user_events").insert({ user_id: r.userId, event_type: RECAP_EVENT, metadata: { daysStudied: r.data.daysStudied } });
      sent++;
    } catch (e) { console.error(`[weekly recap ${r.userId}]`, e.message); }
  }
  if (sent) console.log(`[weekly recap] sent ${sent}`);
  return sent;
}

export { recapEmailHtml };
