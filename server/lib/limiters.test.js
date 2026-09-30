import { test } from "node:test";
import assert from "node:assert/strict";
import * as limiters from "./limiters.js";
import { otpEmailKey } from "./limiters.js";

/* Every rate limiter in this app was silently a no-op.
 *
 * express-rate-limit's `ipKeyGenerator` takes an IP **string**
 * (`ipKeyGenerator(ip, ipv6Subnet?)`), and every limiter here called it as
 * `ipKeyGenerator(req)`. Passing an object isn't a type error — the helper just
 * returns whatever it's given — so each limiter's key became the request object
 * itself. Two separate requests are never the same object, so every single
 * request got a brand-new bucket and no limit ever fired: not the global cap,
 * not the OTP brute-force guard, not password reset.
 *
 * It read correctly and every response was a normal 200, which is why it
 * shipped and survived. These tests drive the real middleware (not a
 * reimplementation of the key logic) with two distinct request objects from the
 * same IP and assert they share a bucket — the exact case the bug fell through.
 */

function mockRes() {
  const headers = {};
  return {
    headers,
    setHeader(k, v) { headers[k] = v; },
    getHeader(k) { return headers[k]; },
    removeHeader() {},
    status() { return this; },
    json() {},
    end() {},
    headersSent: false,
  };
}

async function run(limiter, req) {
  const res = mockRes();
  await new Promise(resolve => limiter(req, res, resolve));
  return Number(res.headers["RateLimit-Remaining"]);
}

const NAMES = [
  "globalLimiter", "aiLimiter", "queryLimiter", "forgeLimiter", "checkoutLimiter",
  "webhookLimiter", "otpIpLimiter", "otpSendEmailLimiter", "otpVerifyLimiter",
  "resetLimiter", "feynmanLimiter", "explainLimiter", "podcastLimiter",
  "errorReportLimiter",
];

test("every limiter is exported and is real middleware", () => {
  for (const name of NAMES) {
    assert.equal(typeof limiters[name], "function", `${name} must be middleware`);
  }
});

// Each test below uses IPs from its own /24 so the shared in-memory store
// (state persists for the process lifetime, same as it would across real
// requests) never lets one test's budget bleed into another's.
let nextOctet = 10;
function freshIp() { return `203.0.${nextOctet++}.7`; }

test("two distinct request objects from the same IP share one bucket", async () => {
  // This is the regression: with `ipKeyGenerator(req)`, every object is its
  // own key, so "remaining" would read the same (fresh) value every time.
  for (const name of NAMES) {
    const ip = freshIp();
    const reqA = { ip, body: {}, get: () => undefined };
    const reqB = { ip, body: {}, get: () => undefined };
    const remA = await run(limiters[name], reqA);
    const remB = await run(limiters[name], reqB);
    assert.ok(
      Number.isFinite(remA) && remB === remA - 1,
      `${name}: expected the second request from the same IP to consume the ` +
      `same budget (got remaining ${remA} then ${remB})`,
    );
  }
});

test("two different IPs get independent buckets", async () => {
  const reqA = { ip: freshIp(), body: {}, get: () => undefined };
  const reqC = { ip: freshIp(), body: {}, get: () => undefined };
  const remA = await run(limiters.resetLimiter, reqA);
  const remC = await run(limiters.resetLimiter, reqC);
  assert.equal(remA, remC, "a fresh IP must start with a full budget, not an exhausted shared one");
});

test("an authenticated request keys by user id, not IP", async () => {
  // Same IP, two different signed-in users: separate budgets, so one heavy
  // user can't throttle everyone behind the same NAT/office network.
  const ip = freshIp();
  const userA1 = { ip, body: {}, get: () => undefined, user: { id: "user-123" } };
  const userA2 = { ip, body: {}, get: () => undefined, user: { id: "user-123" } };
  const userB = { ip, body: {}, get: () => undefined, user: { id: "user-456" } };
  const a1 = await run(limiters.globalLimiter, userA1);
  const b = await run(limiters.globalLimiter, userB);
  const a2 = await run(limiters.globalLimiter, userA2);
  assert.equal(b, a1, "a different user must start with a full, independent budget");
  assert.equal(a2, a1 - 1, "the same user's second request must consume their own budget");
});

test("otpEmailKey keys by email, falling back to a string IP key", () => {
  assert.equal(
    otpEmailKey({ ip: "203.0.113.7", body: { email: "  Noah@Example.COM " } }),
    "email:noah@example.com",
    "email keys must be normalised so case/whitespace can't buy extra attempts",
  );
  const fallback = otpEmailKey({ ip: "203.0.113.7", body: {} });
  assert.equal(typeof fallback, "string");
  assert.ok(fallback.length > 0);
});

test("the sensitive limiters are actually tight", () => {
  for (const name of ["otpIpLimiter", "otpVerifyLimiter", "resetLimiter", "errorReportLimiter"]) {
    const m = limiters[name]?.max ?? null;
    if (m === null) continue;
    assert.ok(m <= 20, `${name} allows ${m} per window — too many for an auth/abuse path`);
  }
});
