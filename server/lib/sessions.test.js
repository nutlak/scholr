// Run with: npm test   (node:test — no framework)
import { test } from "node:test";
import assert from "node:assert/strict";
import { dueForReminder, isUpcoming, parseSessionInput, readSession } from "./sessions.js";

const NOW = Date.parse("2026-10-14T20:00:00Z");
const MIN = 60 * 1000;
const iso = ms => new Date(NOW + ms).toISOString();

test("accepts a time between 5 minutes and 30 days ahead, trims the note", () => {
  const ok = parseSessionInput({ startsAt: iso(2 * 60 * MIN), note: "  chapter 4 review  " }, NOW);
  assert.equal(ok.startsAt, iso(2 * 60 * MIN));
  assert.equal(ok.note, "chapter 4 review");
});

test("rejects missing, garbled, too-soon, too-far and past times", () => {
  for (const startsAt of [undefined, "", "tomorrow-ish", iso(2 * MIN), iso(-60 * MIN), iso(31 * 24 * 60 * MIN)]) {
    assert.ok(parseSessionInput({ startsAt }, NOW).error, String(startsAt));
  }
});

test("note is capped and non-strings are dropped", () => {
  assert.equal(parseSessionInput({ startsAt: iso(60 * MIN), note: "x".repeat(500) }, NOW).note.length, 80);
  assert.equal(parseSessionInput({ startsAt: iso(60 * MIN), note: { evil: 1 } }, NOW).note, "");
});

test("a session stays listed for an hour after it starts, then drops", () => {
  assert.equal(isUpcoming({ startsAt: iso(-30 * MIN) }, NOW), true);
  assert.equal(isUpcoming({ startsAt: iso(-90 * MIN) }, NOW), false);
  assert.equal(isUpcoming({ startsAt: null }, NOW), false);
});

test("reminders go to sessions starting within 10 minutes that haven't been reminded", () => {
  const s = (startsAt, remindedAt = null) => ({ startsAt, remindedAt });
  const due = dueForReminder([
    s(iso(5 * MIN)),                                   // due
    s(iso(9 * MIN)),                                   // due
    s(iso(15 * MIN)),                                  // too early
    s(iso(-1 * MIN)),                                  // already started
    s(iso(5 * MIN), iso(-1 * MIN)),                    // already reminded
    s("garbage"),
  ], NOW);
  assert.equal(due.length, 2);
});

test("a corrupt row reads as a session that never starts", () => {
  const s = readSession({ id: "1", notebook_id: "n", user_id: "u", content: "{not json" });
  assert.equal(s.startsAt, null);
  assert.equal(isUpcoming(s, NOW), false);
});
