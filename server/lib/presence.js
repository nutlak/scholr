// Visit logging and the streak computation behind the heatmap.
// Mirrors src/lib/format.js's computeStreak — see the note there.
import { supabase } from "./supabase.js";
import { clientLocalDate } from "./date.js";

// ── Activity logging helper ───────────────────────────────────────────────
// Bumps the user's daily_activity counter for the user's own local date.
// Fire-and-forget — never blocks the request.
export async function logUserActivity(userId, req) {
  if (!userId) return;
  try {
    const today = clientLocalDate(req); // YYYY-MM-DD in the user's timezone
    const { data: existing } = await supabase
      .from("daily_activity")
      .select("id, activity_count")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("daily_activity")
        .update({ activity_count: (existing.activity_count ?? 0) + 1 })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("daily_activity")
        .insert({ user_id: userId, date: today, activity_count: 1 });
    }
  } catch (err) {
    console.error("logUserActivity error:", err.message);
  }
}

// Mirrors src/lib/format.js's computeStreak. Kept as a small duplicate here
// rather than importing across the client/server boundary — server/ deploys
// on its own (Railway), so it doesn't share a build with src/.
export function computeStreakServer(days) {
  const map = new Map(days.map(d => [d.date, d.count]));
  const fmtKey = dt => dt.toISOString().slice(0, 10);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if ((map.get(fmtKey(d)) ?? 0) > 0) streak++; else break;
  }
  return streak;
}
