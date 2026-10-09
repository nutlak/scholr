// What every new account goes through, however it was created: the age gate,
// the consent record, and the welcome. Email sign-ups reach this from
// verify-otp; Google sign-ins (created inside Supabase, never touching
// verify-otp) reach it from complete-signup.
import { recordConsent, relayJarvis, trackEvent } from "./analytics.js";
import { supabase } from "./supabase.js";
import { sendOnboardingEmail } from "../email.js";

export const MIN_AGE = 13;

// Whole years from a YYYY-MM-DD birthdate to now; NaN when it isn't a real
// past date.
export function ageFromDob(dateOfBirth, now = new Date()) {
  const match = typeof dateOfBirth === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth.trim());
  if (!match) return NaN;
  // Compare plain year/month/day numbers. Going through new Date("YYYY-MM-DD")
  // means UTC midnight, which local-time getters read as the day before, so a
  // birthday counted a year short west of UTC.
  const [y, m, d] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d || check > now) return NaN;
  let age = now.getUTCFullYear() - y;
  const dm = now.getUTCMonth() + 1 - m;
  if (dm < 0 || (dm === 0 && now.getUTCDate() < d)) age--;
  return age;
}

// Google (and, later, Apple) accounts are created by Supabase directly, so
// they skip the signup age gate. Until they finish it, requireAuth keeps them
// out of everything else. Email accounts are created by verify-otp, which has
// already checked.
export function needsSignupCompletion(user) {
  const meta = user?.app_metadata ?? {};
  return meta.provider !== "email" && !meta.age_verified;
}

// Consent, birthdate, welcome email, follow-up emails.
// All best-effort past the consent record: a Resend hiccup or a missing
// migration must never fail a signup that already exists.
export async function welcomeNewAccount({ uid, email, name, dateOfBirth }) {
  await recordConsent(uid);
  await supabase.from("profiles").upsert(
    { user_id: uid, date_of_birth: dateOfBirth, age_verified_at: new Date().toISOString() },
    { onConflict: "user_id" },
  ).then(({ error }) => { if (error) console.error("[signup] DOB save error:", error.message); });

  const first = name?.trim()?.split(" ")[0] || "";
  sendOnboardingEmail("welcome", email, first, uid).catch(e => console.error("[onboarding welcome]", e.message));
  trackEvent(uid, "user_signed_up");
  relayJarvis("new_user", { email });
  try {
    const now = Date.now();
    await supabase.from("pending_emails").insert([
      { user_id: uid, email, email_type: "feynman",       send_at: new Date(now + 3 * 86400000).toISOString() },
      { user_id: uid, email, email_type: "invite_friend", send_at: new Date(now + 7 * 86400000).toISOString() },
    ]);
  } catch (e) { console.error("[onboarding enqueue]", e.message); }

}
