import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = ["index.css", "App.css"].map(f => readFileSync(join(src, f), "utf8")).join("\n");

// App.css once split mobile/desktop at 767/768 while index.css split at
// 768/769. At exactly 768px both .desktop-only and .mobile-only were hidden,
// so the dashboard showed neither "+ New Class" nor its mobile FAB and a class
// could not be created at all. Keep the two files agreeing.
const widths = [...css.matchAll(/@media \((max|min)-width:\s*(\d+)px\)/g)]
  .map(m => ({ kind: m[1], px: Number(m[2]) }));

test("every mobile/desktop split uses the same 768/769 boundary", () => {
  const splits = widths.filter(w => w.px >= 700 && w.px <= 900);
  assert.ok(splits.length > 0, "no breakpoints found — did the files move?");
  for (const w of splits) {
    const expected = w.kind === "max" ? 768 : 769;
    assert.equal(w.px, expected,
      `@media (${w.kind}-width: ${w.px}px) leaves a gap; ${w.kind} must be ${expected}`);
  }
});

test("no width falls through both .desktop-only and .mobile-only", () => {
  // .desktop-only hides at <= maxPx; .mobile-only hides at >= minPx.
  // A gap exists iff minPx <= maxPx.
  const maxPx = Math.min(...widths.filter(w => w.kind === "max" && w.px > 700).map(w => w.px));
  const minPx = Math.min(...widths.filter(w => w.kind === "min" && w.px > 700).map(w => w.px));
  assert.ok(minPx > maxPx,
    `widths ${maxPx}..${minPx} are hidden by both rules — nothing renders there`);
});
