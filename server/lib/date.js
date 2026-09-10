// The date the *user* is living in, not the server.
//
// Activity used to be stamped with the UTC date while the dashboard computes
// streaks from local dates, so a student working after ~8pm US Eastern had it
// filed under tomorrow and their streak broke. The API client sends its local
// date on every request via X-Client-Date.
//
// Clamped to ±1 day of UTC: the honest spread of real timezones is only ever
// ±1, so a crafted header cannot backfill or pre-fill a streak.
export function clientLocalDate(req, now = new Date()) {
  const utcDay = now.toISOString().slice(0, 10);
  const sent = req?.headers?.["x-client-date"];
  if (typeof sent !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(sent)) return utcDay;
  const sentMs = Date.parse(`${sent}T00:00:00Z`);
  const utcMs = Date.parse(`${utcDay}T00:00:00Z`);
  if (!Number.isFinite(sentMs)) return utcDay;
  return Math.abs(sentMs - utcMs) <= 86400000 ? sent : utcDay;
}
