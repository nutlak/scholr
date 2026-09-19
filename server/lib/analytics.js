// Behaviour events, the JARVIS relay, and the consent record written on
// signup and at the terms wall.
import { supabase } from "./supabase.js";

// Current policy versions recorded on signup (match the legal pages' dates).
export const TERMS_VERSION = "2026-06-02";

export const PRIVACY_VERSION = "2026-06-02";

// Records a consent acceptance for a user: writes the latest snapshot to
// profiles AND appends to the immutable terms_acceptances log. Shared by the
// signup flow and the existing-user "terms wall" so both behave identically.
// Resilient: the profiles write falls back to a timestamp-only shape if the
// version columns aren't present (migration 021 not run), and the log insert is
// non-fatal if that table is absent (migration 022 not run).
// ── Analytics: behavior events + JARVIS relay (fire-and-forget, never block) ──
export function trackEvent(userId, type, metadata = {}) {
  if (!userId) return;
  supabase.from("user_events").insert({ user_id: userId, event_type: type, metadata })
    .then(({ error }) => { if (error) console.error(`[trackEvent ${type}]`, error.message); })
    .catch(() => {});
}

export function relayJarvis(type, payload = {}) {
  supabase.from("jarvis_events").insert({ event_type: type, payload })
    .then(({ error }) => { if (error) console.error(`[relayJarvis ${type}]`, error.message); })
    .catch(() => {});
}

export async function recordConsent(userId) {
  if (!userId) return;
  const acceptedAt = new Date().toISOString();
  const { error: profErr } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      terms_accepted_at: acceptedAt,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
    },
    { onConflict: "user_id" },
  );
  if (profErr) {
    await supabase.from("profiles").upsert(
      { user_id: userId, terms_accepted_at: acceptedAt },
      { onConflict: "user_id" },
    ).catch(() => {});
  }
  await supabase.from("terms_acceptances").insert({
    user_id: userId,
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
    accepted_at: acceptedAt,
  });
}
