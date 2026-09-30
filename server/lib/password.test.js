import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  validatePassword, breachCount, checkPassword,
  MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH,
} from "./password.js";

// ── Offline rules ───────────────────────────────────────────────────────────

test("accepts a reasonable passphrase", () => {
  assert.equal(validatePassword("correct horse battery"), null);
  assert.equal(validatePassword("my calc notes 2026"), null);
});

test("rejects anything shorter than the minimum", () => {
  assert.match(validatePassword("short1"), /at least 8/);
  assert.match(validatePassword("a".repeat(MIN_PASSWORD_LENGTH - 1)), /at least 8/);
  // Exactly at the boundary is fine (given it passes the other rules).
  assert.equal(validatePassword("abcd1234"), null);
});

test("rejects empty and non-string input rather than throwing", () => {
  for (const bad of ["", null, undefined, 12345678, {}]) {
    assert.ok(typeof validatePassword(bad) === "string", `expected a message for ${String(bad)}`);
  }
});

test("rejects an absurdly long password", () => {
  assert.match(validatePassword("a1b2c3d4".repeat(40)), /under 200/);
  assert.equal(validatePassword("a1b2c3d4".repeat(5)), null, "40 chars is fine");
});

test("rejects whitespace-only", () => {
  assert.ok(validatePassword("          "));
});

test("rejects the passwords attackers try first", () => {
  for (const p of ["password", "Password123", "12345678", "qwerty123", "letmein1", "scholr123"]) {
    assert.ok(validatePassword(p), `expected "${p}" to be rejected`);
  }
});

test("rejects a password with almost no distinct characters", () => {
  assert.match(validatePassword("aaaaaaaaaa"), /repetitive/);
  assert.match(validatePassword("ababababab"), /repetitive/);
  // Four or more distinct characters clears this particular rule.
  assert.equal(validatePassword("abcdabcdabcd"), null);
});

test("rejects a password built from the account's own email", () => {
  assert.match(
    validatePassword("noahbutlak2026", { email: "noahbutlak@icloud.com" }),
    /email address/,
  );
  // Case-insensitive, and only when the local part is substantial.
  assert.match(validatePassword("XXNOAHBUTLAKXX", { email: "noahbutlak@icloud.com" }), /email address/);
  // A short local part shouldn't veto unrelated passwords containing it.
  assert.equal(validatePassword("about the moon", { email: "ab@x.com" }), null);
});

test("email rule doesn't fire when no email is supplied", () => {
  assert.equal(validatePassword("noahbutlak2026"), null);
});

// ── Breach check (k-anonymity) ──────────────────────────────────────────────
// A fake HIBP that asserts we only ever send the 5-character prefix.

function fakeHibp({ knownPassword, count = 42, status = 200, hang = false }) {
  const full = createHash("sha1").update(knownPassword, "utf8").digest("hex").toUpperCase();
  const wantPrefix = full.slice(0, 5);
  const wantSuffix = full.slice(5);
  const calls = [];
  const impl = async (url, opts) => {
    calls.push(url);
    if (hang) {
      // Respect the abort signal the way a real fetch would.
      return new Promise((_, reject) => {
        opts.signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    }
    const prefix = String(url).split("/").pop();
    if (status !== 200) return { ok: false, status, text: async () => "" };
    const lines = [
      "0000000000000000000000000000000000A:3",
      prefix === wantPrefix ? `${wantSuffix}:${count}` : "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:9",
    ];
    return { ok: true, status: 200, text: async () => lines.join("\r\n") };
  };
  return { impl, calls, wantPrefix, full };
}

test("breachCount finds a known-breached password", async () => {
  const hibp = fakeHibp({ knownPassword: "hunter2hunter2", count: 5000 });
  const n = await breachCount("hunter2hunter2", { fetchImpl: hibp.impl });
  assert.equal(n, 5000);
});

test("breachCount returns 0 for a password not in the list", async () => {
  const hibp = fakeHibp({ knownPassword: "some other password" });
  const n = await breachCount("a genuinely unused passphrase", { fetchImpl: hibp.impl });
  assert.equal(n, 0);
});

test("breachCount only ever sends the first five hash characters", async () => {
  const pw = "my secret passphrase";
  const hibp = fakeHibp({ knownPassword: pw });
  await breachCount(pw, { fetchImpl: hibp.impl });

  assert.equal(hibp.calls.length, 1);
  const url = hibp.calls[0];
  const sent = url.split("/").pop();
  assert.equal(sent.length, 5, "exactly the 5-char prefix");
  assert.equal(sent, hibp.wantPrefix);
  // The password, and the rest of its hash, must not appear anywhere in the URL.
  assert.ok(!url.includes(pw), "the password itself must never be sent");
  assert.ok(!url.includes(hibp.full.slice(5)), "the hash suffix must never be sent");
});

test("breachCount fails open when HIBP errors", async () => {
  const hibp = fakeHibp({ knownPassword: "x", status: 503 });
  assert.equal(await breachCount("anything at all", { fetchImpl: hibp.impl }), 0);
});

test("breachCount fails open when the request throws", async () => {
  const boom = async () => { throw new Error("network down"); };
  assert.equal(await breachCount("anything at all", { fetchImpl: boom }), 0);
});

test("breachCount fails open (rather than hanging) on timeout", async () => {
  const hibp = fakeHibp({ knownPassword: "x", hang: true });
  const started = Date.now();
  const n = await breachCount("anything at all", { fetchImpl: hibp.impl, timeoutMs: 50 });
  assert.equal(n, 0);
  assert.ok(Date.now() - started < 1000, "must not hang past its timeout");
});

// ── Full policy ─────────────────────────────────────────────────────────────

test("checkPassword runs the offline rules before spending a network call", async () => {
  let called = false;
  const spy = async () => { called = true; return { ok: true, text: async () => "" }; };
  const msg = await checkPassword("short", { fetchImpl: spy });
  assert.match(msg, /at least 8/);
  assert.equal(called, false, "a too-short password shouldn't reach HIBP");
});

test("checkPassword rejects a breached password that passes the offline rules", async () => {
  const pw = "brimstone teacup ladder";
  const hibp = fakeHibp({ knownPassword: pw, count: 12 });
  assert.match(await checkPassword(pw, { fetchImpl: hibp.impl }), /data breach/);
});

test("checkPassword calls out the worst offenders more strongly", async () => {
  const pw = "brimstone teacup ladder";
  const hibp = fakeHibp({ knownPassword: pw, count: 3_000_000 });
  assert.match(await checkPassword(pw, { fetchImpl: hibp.impl }), /attackers try first/);
});

test("checkPassword accepts a good, unbreached password", async () => {
  const pw = "brimstone teacup ladder";
  const hibp = fakeHibp({ knownPassword: "something else entirely" });
  assert.equal(await checkPassword(pw, { fetchImpl: hibp.impl }), null);
});

test("the exported bounds are what the messages claim", () => {
  assert.equal(MIN_PASSWORD_LENGTH, 8);
  assert.equal(MAX_PASSWORD_LENGTH, 200);
});
