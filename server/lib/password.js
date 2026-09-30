import { createHash } from "node:crypto";

/* Password policy, shared by signup and reset.
 *
 * Before this existed the two paths disagreed: reset enforced a 6-character
 * minimum and signup enforced nothing at all beyond "not empty", so the
 * weakest possible password could be set at account creation and only a
 * Supabase-side default stood behind it. One module, both callers, same rules.
 *
 * The rules follow NIST SP 800-63B rather than the older
 * one-uppercase-one-symbol convention: length is what actually buys entropy,
 * composition rules mostly buy "Password1!". So this checks length, rejects
 * passwords built out of the account's own email, screens a small list of the
 * passwords attackers try first, and — the part that matters most — checks the
 * password against known breach corpora.
 */

export const MIN_PASSWORD_LENGTH = 8;
// Long inputs cost real CPU to hash downstream; this is far above any genuine
// passphrase and well under anything that would stall a request.
export const MAX_PASSWORD_LENGTH = 200;

// The head of every credential-stuffing list. Not a substitute for the breach
// check below — this runs offline and instantly, so a password this obvious
// never even reaches the network call.
const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "12345678", "123456789",
  "1234567890", "qwerty123", "qwertyuiop", "letmein1", "welcome1", "iloveyou",
  "admin123", "football", "baseball", "sunshine", "princess", "trustno1",
  "dragon123", "monkey123", "starwars", "whatever", "zaq12wsx", "changeme",
  "scholr123", "scholrapp", "studysmart",
]);

/**
 * Synchronous, offline rules. Returns null when the password is acceptable, or
 * a message written for the person reading it — what's wrong and what to do,
 * never just "invalid password".
 */
export function validatePassword(password, { email } = {}) {
  if (typeof password !== "string" || !password) {
    return "Enter a password.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters — length matters more than symbols.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Keep it under ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (!password.trim()) {
    return "A password can't be only spaces.";
  }

  const lower = password.toLowerCase();
  if (COMMON.has(lower)) {
    return "That's one of the most common passwords in use. Pick something else.";
  }

  // A single repeated character, however long ("aaaaaaaa"), has almost no
  // entropy no matter how many of them there are.
  if (new Set(lower).size < 4) {
    return "That's too repetitive — mix in some more characters.";
  }

  // Passwords built from the account's own email are the first thing tried
  // after the common list.
  const local = typeof email === "string" ? email.split("@")[0]?.toLowerCase() : "";
  if (local && local.length >= 4 && lower.includes(local)) {
    return "Don't build your password out of your email address.";
  }

  return null;
}

/**
 * Check the password against Have I Been Pwned's breach corpus using
 * k-anonymity: only the first five characters of the SHA-1 hash are sent, and
 * the response is a list of hash suffixes matched locally. The password itself
 * never leaves this process, and HIBP cannot tell which of the ~800 returned
 * hashes was being asked about.
 *
 * Returns the number of times the password appears in a breach (0 = clean).
 *
 * FAILS OPEN. If HIBP is slow or down, this returns 0 rather than blocking
 * someone from creating an account — availability of signup beats this one
 * check, and the offline rules above still applied.
 */
export async function breachCount(password, { timeoutMs = 2500, fetchImpl = fetch } = {}) {
  if (typeof password !== "string" || !password) return 0;

  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: controller.signal,
      // Pads the response with random hashes so its SIZE leaks nothing either.
      headers: { "Add-Padding": "true", "User-Agent": "scholr-password-check" },
    });
    if (!res.ok) return 0;
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [hashSuffix, count] = line.trim().split(":");
      if (hashSuffix === suffix) return Number(count) || 0;
    }
    return 0;
  } catch {
    return 0; // fail open — see above
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The whole policy: offline rules first (free), then the breach check (one
 * network call). Returns null when acceptable, otherwise the message to show.
 */
export async function checkPassword(password, { email, fetchImpl } = {}) {
  const offline = validatePassword(password, { email });
  if (offline) return offline;

  const seen = await breachCount(password, fetchImpl ? { fetchImpl } : {});
  if (seen > 0) {
    return seen > 100_000
      ? "This password appears in a known data breach — it's one attackers try first. Please choose another."
      : "This password has shown up in a known data breach. Please choose another.";
  }
  return null;
}
