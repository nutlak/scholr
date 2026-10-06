import { test } from "node:test";
import assert from "node:assert/strict";
import { ageFromDob, needsSignupCompletion } from "./signup.js";

const NOW = new Date("2026-10-06T12:00:00Z");

test("ageFromDob counts whole years and respects the birthday", () => {
  assert.equal(ageFromDob("2013-10-06", NOW), 13);
  assert.equal(ageFromDob("2013-10-07", NOW), 12); // birthday is tomorrow
  assert.equal(ageFromDob("2009-05-20", NOW), 17);
});

test("ageFromDob rejects junk, future dates and odd formats", () => {
  for (const bad of [undefined, "", "yesterday", "2030-01-01", "10/06/2013", "2013-13-45", 2013]) {
    assert.ok(Number.isNaN(ageFromDob(bad, NOW)), `expected NaN for ${bad}`);
  }
});

test("only non-email accounts without the flag must finish signup", () => {
  assert.equal(needsSignupCompletion({ app_metadata: { provider: "google" } }), true);
  assert.equal(needsSignupCompletion({ app_metadata: { provider: "google", age_verified: true } }), false);
  assert.equal(needsSignupCompletion({ app_metadata: { provider: "email" } }), false);
  // An email account that later linked Google keeps provider "email".
  assert.equal(needsSignupCompletion({ app_metadata: { provider: "email", providers: ["email", "google"] } }), false);
});
