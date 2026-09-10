// Pure formatting and derivation helpers. No React, no DOM.

export function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function formatDueDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function dueDateTone(iso) {
  if (!iso) return null;
  const now = Date.now();
  const due = new Date(iso).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (due < now) return { color: "#F87171", label: "Overdue", tone: "red" };
  if (due - now <= 3 * dayMs) return { color: "#FBBF24", label: "Due soon", tone: "amber" };
  return { color: "#34D399", label: "Upcoming", tone: "green" };
}

export function formatPodcastTime(secs) {
  if (!Number.isFinite(secs) || secs < 0) return "0:00";
  const s = Math.floor(secs);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function memberLabel(m) {
  const first = m.first_name?.trim();
  if (first) return first;
  const local = m.email?.split("@")[0] ?? "Member";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function getDisplayName(user) {
  return user?.user_metadata?.full_name
    || user?.email?.split("@")[0]
    || "Student";
}

export function getGreeting(name) {
  const h = new Date().getHours();
  const first = name.split(" ")[0];
  if (h >= 6 && h < 12)  return { text: `Good morning, ${first}` };
  if (h >= 12 && h < 17) return { text: `Good afternoon, ${first}` };
  if (h >= 17 && h < 21) return { text: `Good evening, ${first}` };
  return { text: `Burning the midnight oil, ${first}` };
}

export function feynmanScoreColor(score) {
  if (score >= 80) return "var(--success)";
  if (score >= 55) return "var(--acc)";
  return "var(--danger)";
}

export function computeStreak(heatmap) {
  const map = new Map((heatmap || []).map(d => [d.date, d.count]));
  const fmtKey = dt => dt.toISOString().slice(0, 10);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if ((map.get(fmtKey(d)) ?? 0) > 0) streak++; else break;
  }
  return streak;
}

export function streakAtRiskFromHeatmap(heatmap) {
  if (!heatmap || !heatmap.length) return false;
  const map = new Map(heatmap.map(d => [d.date, d.count]));
  const fmtKey = dt => dt.toISOString().slice(0, 10);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  return (map.get(fmtKey(yest)) ?? 0) > 0 && (map.get(fmtKey(today)) ?? 0) === 0;
}

export function notifLine(n) {
  const who = n.payload?.fromUsername ? `@${n.payload.fromUsername}` : "Someone";
  const book = n.payload?.notebookTitle ?? "a notebook";
  switch (n.type) {
    case "friend_request":  return `${who} sent you a friend request`;
    case "friend_accepted": return `${who} accepted your friend request`;
    case "notebook_invite": return `${who} added you to ${book}`;
    case "mention":         return `${who} mentioned you in ${book}`;
    case "note_uploaded":   return `${who} added ${n.payload?.noteTitle ?? "a note"} to ${book}`;
    case "payment_failed":  return "Your payment didn't go through — tap to update your card and keep Pro";
    case "renewal_reminder": {
      const d = n.payload?.days;
      const when = d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d ?? "a few"} days`;
      return `Your scholr Pro renews ${when} — tap to manage`;
    }
    default:                return "New notification";
  }
}

export const NOTIF_OPENS_NOTEBOOK = new Set(["notebook_invite", "mention", "note_uploaded"]);

export const NOTIF_OPENS_BILLING = new Set(["payment_failed", "renewal_reminder"]);
