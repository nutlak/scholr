// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { clientLocalDate } from "./date.js";

const now = new Date("2026-09-09T03:00:00Z"); // UTC day = 2026-09-09
const withDate = d => ({ headers: { "x-client-date": d } });

test("uses the client's date when it is plausible", () => {
  assert.equal(clientLocalDate(withDate("2026-09-09"), now), "2026-09-09");
  assert.equal(clientLocalDate(withDate("2026-09-08"), now), "2026-09-08"); // west of UTC
  assert.equal(clientLocalDate(withDate("2026-09-10"), now), "2026-09-10"); // east of UTC
});

test("falls back to UTC when the header is absent or malformed", () => {
  assert.equal(clientLocalDate({ headers: {} }, now), "2026-09-09");
  assert.equal(clientLocalDate(undefined, now), "2026-09-09");
  assert.equal(clientLocalDate(withDate("nonsense"), now), "2026-09-09");
  assert.equal(clientLocalDate(withDate("09-09-2026"), now), "2026-09-09");
  assert.equal(clientLocalDate(withDate(""), now), "2026-09-09");
});

test("rejects dates further than a day out, so streaks cannot be forged", () => {
  assert.equal(clientLocalDate(withDate("2026-09-20"), now), "2026-09-09");
  assert.equal(clientLocalDate(withDate("2026-01-01"), now), "2026-09-09");
  assert.equal(clientLocalDate(withDate("2027-09-09"), now), "2026-09-09");
});

test("a well-formed but impossible date does not crash", () => {
  assert.equal(clientLocalDate(withDate("2026-13-45"), now), "2026-09-09");
});
