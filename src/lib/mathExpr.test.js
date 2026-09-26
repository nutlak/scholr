import { test } from "node:test";
import assert from "node:assert/strict";
import { compile, evaluateAt, MathExprError } from "./mathExpr.js";

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test("basic arithmetic and operator precedence", () => {
  assert.ok(close(evaluateAt("2 + 3 * 4", 0), 14));
  assert.ok(close(evaluateAt("(2 + 3) * 4", 0), 20));
  assert.ok(close(evaluateAt("2^3^2", 0), 512), "^ is right associative");
  assert.ok(close(evaluateAt("-2^2", 0), -4), "unary minus binds looser than ^");
});

test("implicit multiplication reads the way people write it", () => {
  assert.ok(close(evaluateAt("2x", 3), 6));
  assert.ok(close(evaluateAt("2pi", 0), 2 * Math.PI));
  assert.ok(close(evaluateAt("3sin(x)", Math.PI / 2), 3));
  assert.ok(close(evaluateAt("(x+1)(x-1)", 3), 8));
});

test("the trig functions this exists for", () => {
  const f = compile("sin(x)");
  assert.ok(close(f(0), 0));
  assert.ok(close(f(Math.PI / 2), 1));
  assert.ok(close(f(Math.PI), 0, 1e-10));
});

test("reciprocal trig identities hold across a full period", () => {
  const csc = compile("csc(x)");
  const sec = compile("sec(x)");
  const cot = compile("cot(x)");
  for (let x = 0.3; x < 6; x += 0.37) {
    assert.ok(close(csc(x), 1 / Math.sin(x)), `csc(${x})`);
    assert.ok(close(sec(x), 1 / Math.cos(x)), `sec(${x})`);
    assert.ok(close(cot(x), Math.cos(x) / Math.sin(x), 1e-6), `cot(${x})`);
  }
});

test("a sinusoid in the y = A sin(Bx - C) + D form scholr's packets use", () => {
  // amplitude 2, period pi (B=2), phase shift pi/4 (C=pi/2), midline 1
  const f = compile("2sin(2x - pi/2) + 1");
  assert.ok(close(f(Math.PI / 4), 1), "starts at the midline");
  assert.ok(close(f(Math.PI / 4 + Math.PI / 4), 3), "peaks a quarter-period later");
});

test("asymptote functions blow up rather than silently returning something plausible", () => {
  const tan = compile("tan(x)");
  assert.ok(Math.abs(tan(Math.PI / 2)) > 1e10 || !Number.isFinite(tan(Math.PI / 2)));
});

test("absolute value, both notations", () => {
  assert.ok(close(evaluateAt("abs(-5)", 0), 5));
  assert.ok(close(evaluateAt("|-5|", 0), 5));
  assert.ok(close(evaluateAt("|x - 3|", 1), 2));
});

test("constants", () => {
  assert.ok(close(evaluateAt("e", 0), Math.E));
  assert.ok(close(evaluateAt("tau", 0), 2 * Math.PI));
});

test("rejects what it should — this is the security boundary", () => {
  for (const bad of [
    "alert(1)",
    "window.location",
    "1; console.log(2)",
    "process.exit()",
    "__proto__",
    "constructor",
    "x => x",
    "",
    "   ",
    "sin(",
    "2 +",
    "2 3 +",  // trailing garbage after a complete expr — implicit-mult would eat "2 3" then choke on "+"
  ]) {
    assert.throws(() => compile(bad), err => err instanceof MathExprError || err instanceof Error,
      `expected "${bad}" to be rejected`);
  }
});

test("rejects unknown identifiers rather than treating them as zero", () => {
  assert.throws(() => evaluateAt("y", 0));
  assert.throws(() => evaluateAt("foo(x)", 0));
});

test("length guard on pathological input", () => {
  assert.throws(() => compile("x".repeat(10000)));
});
