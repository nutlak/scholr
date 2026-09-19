// One-time codes for signup and password reset. Randomness is crypto, never
// Math.random() — these are auth-bearing.
import { randomInt, randomBytes } from "crypto";
import { supabase } from "./supabase.js";

// Best-effort in-memory brute-force counter for OTP verification: after too many
// wrong codes for an email, burn all outstanding codes so they can't be guessed.
export const otpFailures = new Map(); // emailLower -> consecutive failed attempts

export const OTP_MAX_VERIFY_FAILS = 5;

export function generateOtp() {
  // Must be cryptographically random: this code is the only thing standing
  // between an attacker and a password reset. Math.random() is predictable.
  return String(randomInt(100000, 1000000));
}

export function generateToken() {
  return randomBytes(32).toString("hex");
}

export async function invalidateOldCodes(email, type) {
  await supabase
    .from("verification_codes")
    .update({ used: true })
    .eq("email", email)
    .eq("type", type)
    .eq("used", false);
}
