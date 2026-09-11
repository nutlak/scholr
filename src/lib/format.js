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

// Greeting openers by time of day. Plain copy on purpose — the bar is legible
// to a 3-year-old or an 83-year-old, so no in-jokes and no slang.
export const GREETINGS = {
  morning: ["Good morning", "Morning", "Early start", "Fresh page", "New day", "First light"],
  afternoon: ["Good afternoon", "Afternoon", "Back at it", "Halfway there", "Afternoon session"],
  evening: ["Good evening", "Evening", "Winding down", "Evening session", "Golden hour"],
  night: ["Burning the midnight oil", "Late one", "Still up", "The quiet hours", "Night shift"],
};

// Real quotes only, attributed honestly. Where an attribution is popular but
// genuinely disputed by sources, it says "Attributed to" rather than asserting
// it — and sayings with no single author are credited to the tradition instead.
export const QUOTES = [
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "Genius is one percent inspiration and ninety-nine percent perspiration.", author: "Thomas Edison" },
  { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison" },
  { text: "Nothing in life is to be feared, it is only to be understood.", author: "Marie Curie" },
  { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
  { text: "Study without desire spoils the memory, and it retains nothing that it takes in.", author: "Leonardo da Vinci" },
  { text: "Doubt is the origin of wisdom.", author: "René Descartes" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "The beautiful thing about learning is that nobody can take it away from you.", author: "B.B. King" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Will Durant" },
  { text: "Perseverance is not a long race; it is many short races one after the other.", author: "Walter Elliot" },
  { text: "A journey of a thousand miles begins with a single step.", author: "Laozi, Tao Te Ching" },
  { text: "Fall seven times, stand up eight.", author: "Japanese proverb" },
  { text: "Little by little, one travels far.", author: "Spanish proverb" },
  { text: "The best time to plant a tree was twenty years ago. The second best time is now.", author: "Chinese proverb" },
  { text: "Smooth seas never made a skilled sailor.", author: "English proverb" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Attributed to Confucius" },
  { text: "If you can't explain it simply, you don't understand it well enough.", author: "Attributed to Albert Einstein" },
  { text: "The secret of getting ahead is getting started.", author: "Attributed to Mark Twain" },
];

export function greetingBand(hour) {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

// `pick` is injectable so tests can walk the pools deterministically. Callers
// should memoise the result — re-rolling on every render would make the
// greeting flicker on unrelated state changes.
export function getGreeting(name, now = new Date(), pick = arr => arr[Math.floor(Math.random() * arr.length)]) {
  const first = String(name ?? "").trim().split(" ")[0] || "there";
  const openers = GREETINGS[greetingBand(now.getHours())];
  return { text: `${pick(openers)}, ${first}`, quote: pick(QUOTES) };
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

// A dropdown that hangs right-aligned off its trigger runs off the left edge
// when the trigger sits near it — the notifications bell in the sidebar is only
// ~220px in, so its 300px panel overflowed. Returns how far right to nudge it.
export function dropdownShiftX(triggerRight, viewportW, panelW, viewportMargin = 32, edgeGap = 8) {
  const w = Math.min(panelW, viewportW - viewportMargin);
  return Math.max(0, edgeGap - (triggerRight - w));
}

export const NOTIF_OPENS_NOTEBOOK = new Set(["notebook_invite", "mention", "note_uploaded"]);

export const NOTIF_OPENS_BILLING = new Set(["payment_failed", "renewal_reminder"]);
