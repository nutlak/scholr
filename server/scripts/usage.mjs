// What students actually use. Run: npm run usage   (reads server/.env, read-only)
// Counts each tracked event over the last 7 and 30 days, with how many
// different students did it — so one heavy user doesn't look like a trend.
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: new URL("../.env", import.meta.url) });
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DAY = 864e5;
const since = new Date(Date.now() - 30 * DAY).toISOString();

const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("user_events").select("user_id, event_type, created_at")
    .gte("created_at", since).order("created_at").range(from, from + 999);
  if (error) throw new Error(error.message);
  rows.push(...data);
  if (data.length < 1000) break;
}

const week = Date.now() - 7 * DAY;
const stats = {};
for (const r of rows) {
  const s = (stats[r.event_type] ??= { n7: 0, n30: 0, u7: new Set(), u30: new Set() });
  s.n30++; s.u30.add(r.user_id);
  if (Date.parse(r.created_at) >= week) { s.n7++; s.u7.add(r.user_id); }
}

const { count: users } = await db.from("profiles").select("user_id", { count: "exact", head: true });
const { count: active7 } = await db.from("profiles").select("user_id", { count: "exact", head: true })
  .gte("last_active", new Date(week).toISOString());

console.log(`\nscholr usage — ${users} accounts, ${active7} active in the last 7 days\n`);
console.log("event".padEnd(26) + "7d".padStart(7) + "students".padStart(10) + "30d".padStart(8) + "students".padStart(10));
for (const [type, s] of Object.entries(stats).sort((a, b) => b[1].n30 - a[1].n30)) {
  console.log(type.padEnd(26) + String(s.n7).padStart(7) + String(s.u7.size).padStart(10) + String(s.n30).padStart(8) + String(s.u30.size).padStart(10));
}
console.log("");
