import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyTurnstile } from "./turnstile.js";

const reply = (body) => async () => ({ json: async () => body });
const boom = async () => { throw new Error("network down"); };

test("no secret configured: everything passes, Cloudflare is never called", async () => {
  assert.equal(await verifyTurnstile(undefined, null, { secret: "", fetchImpl: boom }), true);
});

test("secret configured: missing or junk tokens fail without a network call", async () => {
  for (const t of [undefined, "", 42, "x".repeat(3000)]) {
    assert.equal(await verifyTurnstile(t, null, { secret: "s", fetchImpl: boom }), false);
  }
});

test("secret configured: trusts Cloudflare's verdict", async () => {
  assert.equal(await verifyTurnstile("tok", "1.2.3.4", { secret: "s", fetchImpl: reply({ success: true }) }), true);
  assert.equal(await verifyTurnstile("tok", "1.2.3.4", { secret: "s", fetchImpl: reply({ success: false }) }), false);
});

test("secret configured: Cloudflare unreachable fails closed", async () => {
  assert.equal(await verifyTurnstile("tok", null, { secret: "s", fetchImpl: boom }), false);
});
