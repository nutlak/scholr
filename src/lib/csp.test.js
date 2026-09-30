import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* The Content-Security-Policy is the app's main defence against XSS, and an
 * XSS is what turns "the Supabase session lives in localStorage" from a
 * footnote into a stolen account. It shipped in Report-Only mode with no
 * reporting endpoint, which means it was enforcing nothing and reporting to
 * nobody for as long as it existed. These tests exist so it can't quietly go
 * back to that, and so a new external origin can't be added to the app without
 * someone also adding it here.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));

const headers = vercel.headers[0].headers;
const byKey = Object.fromEntries(headers.map(h => [h.key, h.value]));

function directive(name) {
  const policy = byKey["Content-Security-Policy"] ?? "";
  const found = policy.split(";").map(s => s.trim()).find(s => s.startsWith(name + " "));
  return found ? found.slice(name.length).trim() : null;
}

const SUPABASE = "https://dbgdzgxrwelppotfvyym.supabase.co";

test("the CSP is enforcing, not Report-Only", () => {
  assert.ok(byKey["Content-Security-Policy"], "a Content-Security-Policy header must be set");
  assert.equal(
    byKey["Content-Security-Policy-Report-Only"], undefined,
    "report-only enforces nothing — it should not be the only policy present",
  );
});

test("scripts are same-origin only — no inline, no CDN", () => {
  const src = directive("script-src");
  assert.equal(src, "'self'");
  assert.ok(!src.includes("unsafe-inline"), "inline scripts would defeat the whole policy");
  assert.ok(!src.includes("unsafe-eval"));
});

test("inline styles stay allowed — the app's styling convention depends on it", () => {
  // CLAUDE.md: inline styles driven by CSS custom properties are the house
  // pattern, so style-src must permit them or every screen loses its styling.
  assert.match(directive("style-src"), /'unsafe-inline'/);
});

test("every origin the app actually talks to is in connect-src", () => {
  const connect = directive("connect-src");
  for (const origin of [
    "'self'",
    SUPABASE,                                          // REST + auth
    `wss://dbgdzgxrwelppotfvyym.supabase.co`,          // realtime presence
    "https://scholr-production-612b.up.railway.app",   // the API
  ]) {
    assert.ok(connect.includes(origin), `connect-src is missing ${origin}`);
  }
});

test("media-src covers Supabase storage — podcast audio is served from there", () => {
  // The bug this test was written for: media-src was absent entirely, so
  // <audio src="https://…supabase.co/storage/…"> fell back to default-src
  // 'self' and would have been blocked the moment the policy enforced.
  const media = directive("media-src");
  assert.ok(media, "media-src must be declared, not left to default-src");
  assert.ok(media.includes(SUPABASE), "podcast audio is a Supabase storage URL");
});

test("img-src covers Supabase storage — uploaded and generated images live there", () => {
  const img = directive("img-src");
  assert.ok(img.includes(SUPABASE));
  assert.ok(img.includes("data:"), "inline SVG/data-URI images are used");
});

test("fonts resolve to Google Fonts, which the stylesheet link needs", () => {
  assert.match(directive("font-src"), /fonts\.gstatic\.com/);
  assert.match(directive("style-src"), /fonts\.googleapis\.com/);
});

test("Stripe checkout can still be posted to", () => {
  assert.match(directive("form-action"), /checkout\.stripe\.com/);
});

test("the anti-clickjacking and injection directives are present", () => {
  assert.equal(directive("frame-ancestors"), "'none'");
  assert.equal(directive("base-uri"), "'self'");
  assert.equal(directive("object-src"), "'none'");
  assert.equal(directive("default-src"), "'self'");
});

test("the other security headers are still set", () => {
  assert.equal(byKey["X-Content-Type-Options"], "nosniff");
  assert.equal(byKey["X-Frame-Options"], "DENY");
  assert.match(byKey["Strict-Transport-Security"], /max-age=\d+/);
  assert.ok(byKey["Referrer-Policy"]);
  assert.ok(byKey["Permissions-Policy"]);
});
