// Run with: npm test   (node:test — no framework, no config)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatPodcastTime, memberLabel, getDisplayName, dueDateTone,
  computeStreak, streakAtRiskFromHeatmap, notifLine,
} from "./format.js";

// Days back from local midnight, keyed the way computeStreak keys them.
function daysAgo(n) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

test("formatPodcastTime pads seconds and rejects junk", () => {
  assert.equal(formatPodcastTime(0), "0:00");
  assert.equal(formatPodcastTime(9), "0:09");
  assert.equal(formatPodcastTime(75), "1:15");
  assert.equal(formatPodcastTime(3600), "60:00");
  assert.equal(formatPodcastTime(NaN), "0:00");
  assert.equal(formatPodcastTime(-5), "0:00");
  assert.equal(formatPodcastTime(undefined), "0:00");
});

test("memberLabel prefers first name, else capitalised email local part", () => {
  assert.equal(memberLabel({ first_name: "Ada" }), "Ada");
  assert.equal(memberLabel({ first_name: "   ", email: "grace@navy.mil" }), "Grace");
  assert.equal(memberLabel({ email: "alan@bletchley.uk" }), "Alan");
  assert.equal(memberLabel({}), "Member");
});

test("getDisplayName falls back through metadata, email, then default", () => {
  assert.equal(getDisplayName({ user_metadata: { full_name: "Ada L" } }), "Ada L");
  assert.equal(getDisplayName({ email: "ada@x.com" }), "ada");
  assert.equal(getDisplayName(null), "Student");
});

test("dueDateTone classifies overdue, soon and upcoming", () => {
  const day = 86400000;
  assert.equal(dueDateTone(null), null);
  assert.equal(dueDateTone(new Date(Date.now() - day).toISOString()).tone, "red");
  assert.equal(dueDateTone(new Date(Date.now() + day).toISOString()).tone, "amber");
  assert.equal(dueDateTone(new Date(Date.now() + 10 * day).toISOString()).tone, "green");
});

test("computeStreak counts consecutive days back from today", () => {
  assert.equal(computeStreak([]), 0);
  assert.equal(computeStreak(null), 0);
  assert.equal(computeStreak([{ date: daysAgo(0), count: 1 }]), 1);
  assert.equal(computeStreak([
    { date: daysAgo(0), count: 2 },
    { date: daysAgo(1), count: 1 },
    { date: daysAgo(2), count: 5 },
  ]), 3);
  // a gap ends the streak
  assert.equal(computeStreak([
    { date: daysAgo(0), count: 1 },
    { date: daysAgo(2), count: 1 },
  ]), 1);
  // zero-count days do not extend it
  assert.equal(computeStreak([
    { date: daysAgo(0), count: 1 },
    { date: daysAgo(1), count: 0 },
  ]), 1);
});

test("streakAtRisk is true only when yesterday counted and today has not", () => {
  assert.equal(streakAtRiskFromHeatmap([]), false);
  assert.equal(streakAtRiskFromHeatmap([{ date: daysAgo(1), count: 3 }]), true);
  assert.equal(streakAtRiskFromHeatmap([
    { date: daysAgo(1), count: 3 },
    { date: daysAgo(0), count: 1 },
  ]), false);
});

test("notifLine renders every handled type and a safe default", () => {
  const who = { fromUsername: "ada" };
  assert.match(notifLine({ type: "friend_request", payload: who }), /@ada sent you a friend request/);
  assert.match(notifLine({ type: "friend_accepted", payload: who }), /accepted/);
  assert.match(notifLine({ type: "notebook_invite", payload: { ...who, notebookTitle: "Bio" } }), /added you to Bio/);
  assert.match(notifLine({ type: "mention", payload: who }), /mentioned you/);
  assert.match(notifLine({ type: "payment_failed", payload: {} }), /payment/i);
  assert.match(notifLine({ type: "renewal_reminder", payload: { days: 0 } }), /today/);
  assert.match(notifLine({ type: "renewal_reminder", payload: { days: 1 } }), /tomorrow/);
  assert.match(notifLine({ type: "renewal_reminder", payload: { days: 3 } }), /in 3 days/);
  assert.equal(notifLine({ type: "who_knows", payload: {} }), "New notification");
  // missing sender must not render "undefined" at the user
  assert.match(notifLine({ type: "friend_request", payload: {} }), /^Someone/);
});
