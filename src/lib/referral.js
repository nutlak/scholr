// Referral capture.
//
// The server has always read `ref` off the signup body (profiles.referred_by,
// the referrals table) but the client never sent it, so attribution has never
// actually worked and "N signed up" could only ever read 0. This is the
// missing half.
//
// Two link shapes are accepted: `/@username`, which is what we hand out now
// because a person can say it out loud, and `?ref=<uuid>`, which every link
// shared before today uses and must keep working.
const KEY = "scholr:ref";

const isUuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function store(userId) {
  try { localStorage.setItem(KEY, userId); } catch { /* private mode */ }
}

// Read a referral out of the current URL and remember it, then strip it so a
// refresh or a shared screenshot of the address bar doesn't re-apply it.
// Returns the referrer's first name when the link was a /@username we could
// resolve, so the sign-up screen can say who invited you.
export async function captureReferral(apiUrl) {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref && isUuid(ref)) {
    store(ref);
    params.delete("ref");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    return null;
  }

  const m = window.location.pathname.match(/^\/@([a-z0-9_]{3,20})$/i);
  if (!m) return null;
  try {
    const res = await fetch(`${apiUrl}/api/u/${m[1].toLowerCase()}`);
    if (!res.ok) return null;
    const { userId, name } = await res.json();
    if (!isUuid(userId)) return null;
    store(userId);
    // Send them to the app root; /@name is an invite link, not a page.
    window.history.replaceState({}, "", "/");
    return name ?? null;
  } catch {
    return null;
  }
}

// Consumed at sign-up. Cleared either way so a later account on the same
// browser isn't credited to the same person.
export function takeReferral() {
  try {
    const v = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return v && isUuid(v) ? v : null;
  } catch {
    return null;
  }
}
