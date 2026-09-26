import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "./mathExpr.js";
import {
  scaleLinear, niceStep, linearTicks, piTickStep, formatPiMultiple, piTicks,
  sampleSegments, segmentToPath,
} from "./graphGeometry.js";

test("scaleLinear maps the ends and the midpoint", () => {
  assert.equal(scaleLinear(0, 0, 10, 100, 200), 100);
  assert.equal(scaleLinear(10, 0, 10, 100, 200), 200);
  assert.equal(scaleLinear(5, 0, 10, 100, 200), 150);
});

test("scaleLinear flips correctly for a y-axis (pixels grow downward)", () => {
  // Data y=max should land at the TOP pixel (smaller number) when the caller
  // passes pxLow=bottom, pxHigh=top — this is how FunctionGraph calls it.
  assert.equal(scaleLinear(4, -4, 4, 260, 20), 20);
  assert.equal(scaleLinear(-4, -4, 4, 260, 20), 260);
});

test("niceStep never returns something that produces absurd tick counts", () => {
  for (const range of [0.01, 1, 4, 8, 100, 3.7]) {
    const step = niceStep(range, 6);
    const count = range / step;
    assert.ok(count >= 2 && count <= 15, `range ${range} -> step ${step} gives ${count} ticks`);
  }
});

test("linearTicks always lands exactly on 0 when 0 is in range", () => {
  const ticks = linearTicks(-4.3, 4.1);
  assert.ok(ticks.some(t => t === 0), `expected an exact 0 in ${ticks}`);
});

test("linearTicks stays within [min, max]", () => {
  const ticks = linearTicks(-2, 5);
  for (const t of ticks) assert.ok(t >= -2 - 1e-9 && t <= 5 + 1e-9);
});

test("linearTicks does not hang on a degenerate range", () => {
  const ticks = linearTicks(5, 5);
  assert.ok(ticks.length < 100);
});

test("piTickStep picks a coarser step as the domain widens", () => {
  assert.equal(piTickStep(0, 2 * Math.PI), 0.5);       // one full period -> halves
  assert.equal(piTickStep(0, Math.PI / 2), 0.25);       // a quarter period -> quarters
  assert.equal(piTickStep(-4 * Math.PI, 4 * Math.PI), 1); // 8 periods -> whole-π
});

test("formatPiMultiple matches how a student writes these", () => {
  assert.equal(formatPiMultiple(0, 4), "0");
  assert.equal(formatPiMultiple(1, 1), "π");
  assert.equal(formatPiMultiple(-1, 1), "−π");
  assert.equal(formatPiMultiple(2, 1), "2π");
  assert.equal(formatPiMultiple(0.5, 2), "π/2");
  assert.equal(formatPiMultiple(1.5, 2), "3π/2");
  assert.equal(formatPiMultiple(-0.5, 2), "−π/2");
  assert.equal(formatPiMultiple(0.25, 4), "π/4");
  assert.equal(formatPiMultiple(0.75, 4), "3π/4");
});

test("formatPiMultiple reduces fractions rather than trusting the caller's denominator", () => {
  // 2/4 should read as π/2, not "2π/4"
  assert.equal(formatPiMultiple(0.5, 4), "π/2");
});

test("piTicks covers a full period at half-π spacing with correct labels", () => {
  const ticks = piTicks(0, 2 * Math.PI);
  const labels = ticks.map(t => t.label);
  assert.deepEqual(labels, ["0", "π/2", "π", "3π/2", "2π"]);
});

test("piTicks handles a negative-to-positive domain", () => {
  const ticks = piTicks(-Math.PI, Math.PI);
  assert.deepEqual(ticks.map(t => t.label), ["−π", "−π/2", "0", "π/2", "π"]);
});

test("sampleSegments keeps a smooth function as one segment", () => {
  const segs = sampleSegments(compile("sin(x)"), 0, 2 * Math.PI, { steps: 100 });
  assert.equal(segs.length, 1);
  assert.ok(segs[0].length > 50);
});

test("sampleSegments breaks tan(x) at its asymptotes instead of drawing through them", () => {
  const fn = compile("tan(x)");
  const asymptotes = [-Math.PI / 2, Math.PI / 2, 3 * Math.PI / 2];
  const segs = sampleSegments(fn, -Math.PI, 2 * Math.PI, { breaks: asymptotes, autoBreakY: 50, steps: 400 });
  // Four branches: (-π,-π/2) (-π/2,π/2) (π/2,3π/2) (3π/2,2π)
  assert.equal(segs.length, 4);
  // No segment should contain a huge jump that crosses zero-to-huge in one step —
  // i.e. no point in any kept segment exceeds the auto-break magnitude.
  for (const seg of segs) {
    for (const { y } of seg) assert.ok(Math.abs(y) <= 50, `unbroken huge value ${y}`);
  }
});

test("sampleSegments auto-breaks on an unlisted asymptote (csc without explicit breaks)", () => {
  const fn = compile("csc(x)");
  // Deliberately give NO explicit breaks, to prove the auto-break catches it.
  const segs = sampleSegments(fn, 0.01, 2 * Math.PI - 0.01, { autoBreakY: 30, steps: 500 });
  assert.ok(segs.length >= 2, "csc(x) has an asymptote at pi and should split into at least 2 segments");
  for (const seg of segs) for (const { y } of seg) assert.ok(Math.abs(y) <= 30);
});

test("sampleSegments never lets a caught evaluator error crash the plot", () => {
  // sqrt(negative) is NaN, not a throw, but this proves the try/catch path
  // doesn't propagate for a genuinely throwing function either.
  const throws = () => { throw new Error("boom"); };
  const segs = sampleSegments(throws, 0, 1, { steps: 10 });
  assert.deepEqual(segs, []);
});

test("segmentToPath produces a well-formed M/L path and respects the y-flip", () => {
  const seg = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  const d = segmentToPath(seg, { xMin: 0, xMax: 1, yMin: -1, yMax: 1, pxLeft: 0, pxRight: 100, pxTop: 0, pxBottom: 100 });
  assert.match(d, /^M0\.00,50\.00L100\.00,0\.00$/);
});

test("segmentToPath clamps runaway values instead of drawing off to infinity", () => {
  const seg = [{ x: 0, y: 1e9 }, { x: 1, y: -1e9 }];
  const d = segmentToPath(seg, { xMin: 0, xMax: 1, yMin: -1, yMax: 1, pxLeft: 0, pxRight: 100, pxTop: 0, pxBottom: 100 });
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
  for (const n of nums) assert.ok(Math.abs(n) < 1e6, `expected a clamped coordinate, got ${n}`);
});
