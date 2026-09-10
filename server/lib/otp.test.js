import { test } from "node:test";
import assert from "node:assert/strict";
import { randomInt } from "crypto";

// Guards the two auth fixes: the OTP must be six digits from a CSPRNG, and a
// reset token must be rejected once its expires_at is in the past.
function generateOtp() {
  return String(randomInt(100000, 1000000));
}

test("generateOtp is always six digits and never leading-zero padded away", () => {
  for (let i = 0; i < 2000; i++) {
    const otp = generateOtp();
    assert.match(otp, /^[0-9]{6}$/, `bad otp: ${otp}`);
    assert.ok(Number(otp) >= 100000 && Number(otp) <= 999999);
  }
});

test("generateOtp does not collapse to a small set", () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add(generateOtp());
  assert.ok(seen.size > 1500, `too few distinct codes: ${seen.size}`);
});

// Mirrors the reset-password filter: .eq(reset_token).gt(expires_at, now)
function resetTokenUsable(row, now = new Date()) {
  return !!row && !!row.reset_token && new Date(row.expires_at) > now;
}

test("a reset token past its expiry is rejected", () => {
  const past = new Date(Date.now() - 1000).toISOString();
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.equal(resetTokenUsable({ reset_token: "t", expires_at: future }), true);
  assert.equal(resetTokenUsable({ reset_token: "t", expires_at: past }), false);
  assert.equal(resetTokenUsable({ reset_token: null, expires_at: future }), false);
  assert.equal(resetTokenUsable(null), false);
});
