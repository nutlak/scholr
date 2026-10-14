// Run with: npm test   (node:test — no framework)
import { test } from "node:test";
import assert from "node:assert/strict";
import { inRecapWindow, worthSending } from "./recap.js";
import { recapEmailHtml } from "../email.js";

const none = { daysStudied: 0, friendsStudied: 0, due: [], sessions: [] };

test("an empty week isn't worth an email; any one signal is", () => {
  assert.equal(worthSending(none), false);
  assert.equal(worthSending({ ...none, daysStudied: 1 }), true);
  assert.equal(worthSending({ ...none, due: [{ title: "U", dueDate: "2026-10-17" }] }), true);
  assert.equal(worthSending({ ...none, sessions: [{ title: "U", startsAt: "2026-10-16T01:00:00Z", note: "" }] }), true);
});

test("sends only in the Sunday-evening UTC window", () => {
  assert.equal(inRecapWindow(new Date("2026-10-18T22:30:00Z")), true);   // Sunday 22:30
  assert.equal(inRecapWindow(new Date("2026-10-18T23:59:00Z")), true);
  assert.equal(inRecapWindow(new Date("2026-10-18T21:59:00Z")), false);  // too early
  assert.equal(inRecapWindow(new Date("2026-10-19T22:30:00Z")), false);  // Monday
  assert.equal(inRecapWindow(new Date("2026-10-14T22:30:00Z")), false);  // Wednesday
});

test("the email carries the numbers, omits empty sections, and escapes titles", () => {
  const html = recapEmailHtml("Sam <x>", {
    daysStudied: 3, friendsStudied: 1,
    due: [{ title: "<img src=x>", dueDate: "2026-10-17" }], sessions: [],
  }, "11111111-2222-3333-4444-555555555555");
  assert.match(html, /<strong[^>]*>3 days<\/strong>/);
  assert.match(html, /<strong[^>]*>1 friend<\/strong>/);
  assert.ok(html.includes("Coming up"));
  assert.ok(!html.includes("Study sessions planned"));
  assert.ok(!html.includes("<img src=x>") && !html.includes("Sam <x>"));
  assert.ok(html.includes("/api/email/unsubscribe?u=11111111"));     // one-click opt-out is there
  assert.match(recapEmailHtml("", { ...none }, "u"), /Quiet week/);
});
