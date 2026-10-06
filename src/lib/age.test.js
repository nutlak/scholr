import { test } from "node:test";
import assert from "node:assert/strict";
import { ageFromDob } from "./age.js";

test("a birthday counts on the day itself, in local time", () => {
  const today = new Date(2026, 9, 6, 9, 0); // Oct 6, 9am local
  assert.equal(ageFromDob("2013-10-06", today), 13);
  assert.equal(ageFromDob("2013-10-07", today), 12);
});

test("junk and future dates are NaN", () => {
  const today = new Date(2026, 9, 6);
  for (const bad of ["", "2013-02-30", "2030-01-01", "06/10/2013", undefined]) assert.ok(Number.isNaN(ageFromDob(bad, today)));
});
