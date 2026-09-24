import { test } from "node:test";
import assert from "node:assert/strict";
import { project, rubberband } from "./sheetDrag.js";

// The dismiss decision is `where the sheet is + project(release velocity)` vs a
// fraction of the sheet's height. Everything below is about that sum behaving
// the way a finger expects, because getting it wrong means either a sheet that
// will not go away or one that leaves when you meant to scroll it.

test("a standing release projects nowhere", () => {
  assert.equal(project(0), 0);
});

test("projection carries the sign of the gesture", () => {
  assert.ok(project(800) > 0, "a downward flick projects downward");
  assert.ok(project(-800) < 0, "an upward flick projects upward");
});

test("a flick from near the top still clears a 40% threshold", () => {
  // 600px sheet, finger only 20px down, but thrown at 900px/s.
  const sheetH = 600;
  assert.ok(20 + project(900) > sheetH * 0.4, "a real flick should dismiss");
});

test("a slow drag halfway down does not dismiss on its own", () => {
  // Same sheet, dragged to 200px and released without speed: 200 < 240.
  const sheetH = 600;
  assert.ok(200 + project(10) < sheetH * 0.4, "a slow half-drag should settle back");
});

test("projection is monotonic in velocity", () => {
  let prev = -Infinity;
  for (const v of [0, 100, 250, 500, 1000, 2000]) {
    const p = project(v);
    assert.ok(p > prev, `project(${v}) should exceed the slower case`);
    prev = p;
  }
});

// Rubber-banding is what the sheet does when you pull it UP past its open
// position. The requirement is that it never stops dead and never keeps up.
test("rubberband resists: output is always less than the pull", () => {
  for (const pull of [1, 10, 50, 200, 1000]) {
    const out = rubberband(pull, 600);
    assert.ok(out > 0, `${pull}px of pull should still move the sheet`);
    assert.ok(out < pull, `${pull}px of pull should move it less than ${pull}px`);
  }
});

test("rubberband resists harder the further you pull", () => {
  const ratio = pull => rubberband(pull, 600) / pull;
  assert.ok(ratio(200) < ratio(20), "resistance should increase with distance");
  assert.ok(ratio(1000) < ratio(200), "and keep increasing");
});

test("rubberband approaches a ceiling rather than a wall", () => {
  // It must never actually stop, and it must never run away either. As the
  // pull grows the c*|o| term dominates the denominator and the whole thing
  // tends to `dimension` — so the sheet can be pulled up by at most its own
  // height however hard you haul on it, and gets there asymptotically.
  const huge = rubberband(100000, 600);
  assert.ok(huge > rubberband(1000, 600), "still moving at extreme pull");
  assert.ok(huge < 600, "but never past the sheet's own height");
  assert.ok(huge > 590, "and genuinely approaching that ceiling");
});

test("rubberband at a realistic pull gives real resistance", () => {
  // The number that actually matters: hauling a 600px sheet up by 300px
  // should move it well under half that.
  assert.ok(rubberband(300, 600) < 150);
  assert.ok(rubberband(300, 600) > 100);
});
