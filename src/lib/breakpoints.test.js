import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MOBILE_QUERY } from "./breakpoints.js";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = ["index.css", "App.css", "hud.css"]
  .map(f => readFileSync(join(src, f), "utf8"))
  .join("\n");

// The boundary lives in exactly one place: MOBILE_QUERY. Everything else has to
// agree with it. App.css once split mobile/desktop at 767/768 while index.css
// split at 768/769; at exactly 768px both .desktop-only and .mobile-only were
// hidden, so the dashboard showed neither "+ New Class" nor its mobile FAB and
// a class could not be created at all. Three hardcoded copies of the number is
// what let that happen, so the test reads the real one rather than repeating it.
const MOBILE_MAX = Number(MOBILE_QUERY.match(/max-width:\s*(\d+)px/)[1]);
const DESKTOP_MIN = MOBILE_MAX + 1;

const widths = [...css.matchAll(/@media \((max|min)-width:\s*(\d+)px\)/g)]
  .map(m => ({ kind: m[1], px: Number(m[2]) }));

// Only the mobile/desktop split matters here. App.css's 640px small-phone block
// is its own thing and has to stay outside this band, so keep it tight enough
// to exclude it if the boundary ever moves down again.
const SPLIT_BAND = 40;

test("every mobile/desktop split uses the MOBILE_QUERY boundary", () => {
  const splits = widths.filter(w => Math.abs(w.px - MOBILE_MAX) <= SPLIT_BAND);
  assert.ok(splits.length > 0, "no breakpoints found — did the files move?");
  for (const w of splits) {
    const expected = w.kind === "max" ? MOBILE_MAX : DESKTOP_MIN;
    assert.equal(w.px, expected,
      `@media (${w.kind}-width: ${w.px}px) leaves a gap; ${w.kind} must be ${expected}`);
  }
});

test("no width falls through both .desktop-only and .mobile-only", () => {
  // .desktop-only hides at <= maxPx; .mobile-only hides at >= minPx.
  // A gap exists iff minPx <= maxPx.
  const near = w => Math.abs(w.px - MOBILE_MAX) <= SPLIT_BAND;
  const maxPx = Math.min(...widths.filter(w => w.kind === "max" && near(w)).map(w => w.px));
  const minPx = Math.min(...widths.filter(w => w.kind === "min" && near(w)).map(w => w.px));
  assert.ok(minPx > maxPx,
    `widths ${maxPx}..${minPx} are hidden by both rules — nothing renders there`);
});

// Every iPad in portrait must land on the desktop/sidebar layout: iPad mini is
// 744pt, and at the old 768px boundary it was the one iPad that got the phone
// layout, where class rows wrapped and the FAB sat on top of them. Split View
// panes stay below the boundary and keep the phone layout on purpose.
test("iPad portrait widths get the desktop layout, Split View panes do not", () => {
  for (const px of [744, 820, 834, 1024]) {
    assert.ok(px >= DESKTOP_MIN, `iPad portrait ${px}px falls under the phone layout`);
  }
  for (const px of [320, 507, 639]) {
    assert.ok(px <= MOBILE_MAX, `Split View pane ${px}px falls into the desktop layout`);
  }
});
