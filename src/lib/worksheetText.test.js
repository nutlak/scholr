import { test } from "node:test";
import assert from "node:assert/strict";
import { worksheetToText, looksLikeReadout } from "./worksheetText.js";

test("renders title, numbered problems, steps, and answer", () => {
  const text = worksheetToText({
    title: "Sinusoids",
    problems: [
      { statement: "Graph y = sin x.", steps: [{ label: "Amplitude", value: "1" }], answer: "Amplitude 1, period 2π." },
    ],
  });
  // Exact string, not a regex: matching literal runs of spaces in a regex
  // trips no-regex-spaces, and the precise text is clearer this way anyway.
  assert.equal(text, "Sinusoids\n\n1. Graph y = sin x.\n   Amplitude: 1\n   Answer: Amplitude 1, period 2π.\n");
});

test("notes a graph without trying to render one", () => {
  const text = worksheetToText({
    problems: [{ statement: "Graph it.", graph: { expr: "sin(x)" }, answer: "See graph." }],
  });
  assert.match(text, /\(graph shown in the app\)/);
});

test("tolerates missing optional fields rather than throwing", () => {
  const text = worksheetToText({ problems: [{ statement: "Just a statement." }] });
  assert.match(text, /1\. Just a statement\./);
});

test("malformed input returns an empty string, not a crash", () => {
  assert.equal(worksheetToText(null), "");
  assert.equal(worksheetToText({}), "");
  assert.equal(worksheetToText({ problems: "not an array" }), "");
});

// ── looksLikeReadout ──────────────────────────────────────────────────────
// The renderer sets a step's value in var(--mono) ONLY when this says yes.
// A real generation returned full-sentence reasoning in a step value despite
// the prompt asking for short results ("The amplitude is the coefficient A,
// which here is 2." instead of "2") — the prompt was tightened, but the
// render has to hold up regardless of what a model actually sends, so a
// prose value falls back to the normal reading font instead of sitting in a
// monospace face built for numbers, which wraps a sentence badly and violates
// the app's own "mono is for what you measure, not for words" rule.
test("looksLikeReadout accepts the short computed values the prompt asks for", () => {
  // "A = 2, B = 1, D = 5" is a real value from a live generation: naming three
  // coefficients at once runs to 9 whitespace tokens despite being only 19
  // characters, which is why length rather than word count is the primary cap.
  for (const v of ["2", "π/2", "2π", "−1", "sin x = 1/2", "x = π/6", "3.5", "−π/4 (left)", "A = 2, B = 1, D = 5"]) {
    assert.equal(looksLikeReadout(v), true, `expected "${v}" to read as a readout`);
  }
});

test("looksLikeReadout rejects prose even when a model ignores the prompt", () => {
  for (const v of [
    "The amplitude is the coefficient A, which here is 2.",
    "y = 3 sin(x) + 2 is in the form y = A sin(Bx - C) + D. Here A = 3, B = 1, C = 0, D = 2.",
    "This step shows the reasoning behind the next one",
  ]) {
    assert.equal(looksLikeReadout(v), false, `expected "${v}" to read as prose`);
  }
});

test("looksLikeReadout handles the edges", () => {
  assert.equal(looksLikeReadout(""), false);
  assert.equal(looksLikeReadout(null), false);
  assert.equal(looksLikeReadout(undefined), false);
  assert.equal(looksLikeReadout(42), false, "not even a string");
});
