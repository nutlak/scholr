// Run with: npm test   (node:test — no framework, no config)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatPodcastTime, memberLabel, getDisplayName, dueDateTone,
  computeStreak, streakAtRiskFromHeatmap, notifLine, dropdownShiftX,
  getGreeting, greetingBand, GREETINGS, QUOTES,
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

test("dropdownShiftX keeps a right-aligned panel on screen", () => {
  // Sidebar bell on desktop: right edge ~223px in, so a 300px panel would start
  // at -77 and run off the left edge. Nudge it to the 8px gutter.
  assert.equal(dropdownShiftX(223, 1470, 300), 85);
  // Mobile sidebar drawer: still overflows, by less.
  assert.equal(dropdownShiftX(268, 390, 300), 40);
  // Trigger near the right edge (mobile friends sheet): no nudge needed.
  assert.equal(dropdownShiftX(378, 390, 300), 0);
  assert.equal(dropdownShiftX(1450, 1470, 300), 0);
  // Very narrow viewport: maxWidth shrinks the panel, so the nudge shrinks too.
  assert.equal(dropdownShiftX(268, 320, 300), 28);
});

test("dropdownShiftX never pushes the panel off the right edge", () => {
  for (const vw of [320, 390, 768, 1024, 1470]) {
    // Only trigger positions that can actually exist inside this viewport.
    for (const right of [40, 120, 223, 268, 378, vw - 8].filter(r => r <= vw - 8)) {
      const w = Math.min(300, vw - 32);
      const left = right - w + dropdownShiftX(right, vw, 300);
      assert.ok(left >= 8 - 1e-9, `left ${left} < 8 (vw=${vw}, right=${right})`);
      assert.ok(left + w <= vw - 8 + 1e-9, `right ${left + w} > ${vw - 8}`);
    }
  }
});

test("greetingBand splits the day at 6/12/17/21", () => {
  assert.equal(greetingBand(0), "night");
  assert.equal(greetingBand(5), "night");
  assert.equal(greetingBand(6), "morning");
  assert.equal(greetingBand(11), "morning");
  assert.equal(greetingBand(12), "afternoon");
  assert.equal(greetingBand(16), "afternoon");
  assert.equal(greetingBand(17), "evening");
  assert.equal(greetingBand(20), "evening");
  assert.equal(greetingBand(21), "night");
  assert.equal(greetingBand(23), "night");
});

test("getGreeting uses the first name and the right time band", () => {
  const at = h => { const d = new Date(); d.setHours(h, 0, 0, 0); return d; };
  const first = arr => arr[0];
  assert.equal(getGreeting("Noah Butlak", at(9), first).text, "Good morning, Noah");
  assert.equal(getGreeting("Noah", at(14), first).text, "Good afternoon, Noah");
  assert.equal(getGreeting("Noah", at(19), first).text, "Good evening, Noah");
  assert.equal(getGreeting("Noah", at(23), first).text, "Burning the midnight oil, Noah");
  // never render "undefined" or a bare comma at the user
  assert.equal(getGreeting("", at(9), first).text, "Good morning, there");
  assert.equal(getGreeting(null, at(9), first).text, "Good morning, there");
});

test("getGreeting returns an attributed quote every time", () => {
  for (const q of QUOTES) {
    const g = getGreeting("Noah", new Date(), arr => (arr === QUOTES ? q : arr[0]));
    assert.equal(g.quote.text, q.text);
    assert.ok(g.quote.author && g.quote.author.trim().length > 0, "every quote needs an attribution");
  }
});

test("greeting and quote pools have no duplicates and offer real variety", () => {
  for (const [band, openers] of Object.entries(GREETINGS)) {
    assert.ok(openers.length >= 5, `${band} needs at least 5 openers, has ${openers.length}`);
    assert.equal(new Set(openers).size, openers.length, `${band} has a duplicate opener`);
  }
  assert.ok(QUOTES.length >= 20, `want at least 20 quotes, have ${QUOTES.length}`);
  assert.equal(new Set(QUOTES.map(q => q.text)).size, QUOTES.length, "duplicate quote text");
  // quotes carry their own punctuation from the render side, not baked in
  for (const q of QUOTES) assert.ok(!q.text.startsWith("“"), `${q.text} should not embed quote marks`);
});
