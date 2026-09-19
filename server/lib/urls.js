// Public URL builders: share slugs, referral links, unsubscribe pages.
import { randomBytes } from "crypto";

// ── Public notebook sharing ───────────────────────────────────────────────────
export function genSlug(n = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(n);
  let s = "";
  for (let i = 0; i < n; i++) s += chars[bytes[i] % chars.length];
  return s;
}

export function shareBase() {
  const o = process.env.CLIENT_ORIGIN;
  return o && !o.startsWith("http://localhost") ? o : "https://scholr.dev";
}

// ── Referrals ─────────────────────────────────────────────────────────────────
export function appOriginForRef() {
  const o = process.env.CLIENT_ORIGIN;
  return o && !o.startsWith("http://localhost") ? o : "https://scholr.dev";
}

// ── Email unsubscribe — GET confirm page (scanner-safe), POST sets the flag ────
export const unsubPage = (body) => `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:-apple-system,sans-serif;background:#08080C;color:#E8E8F0;text-align:center;padding:60px 20px;"><div style="font-size:24px;font-weight:800;margin-bottom:12px;">schol<span style="color:#A78BFA;">r</span></div>${body}</body></html>`;
