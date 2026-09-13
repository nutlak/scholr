// Run with: npm test   (node:test — no framework)
import { test } from "node:test";
import assert from "node:assert/strict";
import { unsubToken, unsubTokenValid } from "./email.js";

// The unsubscribe token is what stops a bare user_id from being a spoofable
// authorization key (IDOR). These pin the round-trip and every rejection path.
const A = "11111111-2222-3333-4444-555555555555";
const B = "99999999-2222-3333-4444-555555555555";

test("a token verifies for the user it was minted for", () => {
  assert.equal(unsubTokenValid(A, unsubToken(A)), true);
});

test("token is rejected when tampered, empty, or missing", () => {
  assert.equal(unsubTokenValid(A, unsubToken(A) + "x"), false);
  assert.equal(unsubTokenValid(A, ""), false);
  assert.equal(unsubTokenValid(A, null), false);
  assert.equal(unsubTokenValid("", unsubToken(A)), false);
});

test("one user's token cannot unsubscribe another user", () => {
  assert.equal(unsubTokenValid(B, unsubToken(A)), false);
  assert.notEqual(unsubToken(A), unsubToken(B));
});
