import { test } from "node:test";
import assert from "node:assert/strict";
import { isNativeReq, returnUrls } from "./billing.js";

// A minimal stand-in for the express request: only the three things these
// helpers read.
const req = (body, host = "api.example.com") => ({
  body,
  protocol: "https",
  get: (h) => (h.toLowerCase() === "host" ? host : undefined),
});

const paths = { okPath: "/app?upgraded=true", cancelPath: "/pricing" };

test("a web checkout returns to the web app", () => {
  process.env.CLIENT_ORIGIN = "https://scholr.dev";
  const { success_url, cancel_url } = returnUrls(req(undefined), paths);
  assert.equal(success_url, "https://scholr.dev/app?upgraded=true");
  assert.equal(cancel_url, "https://scholr.dev/pricing");
});

test("an empty body is a web checkout, not a native one", () => {
  // The web client sends no body at all. If that ever read as native, every
  // browser customer would be redirected into a deep link they cannot open.
  assert.equal(isNativeReq(req(undefined)), false);
  assert.equal(isNativeReq(req({})), false);
  assert.equal(isNativeReq(req({ platform: "web" })), false);
  assert.equal(isNativeReq(req({ platform: "ios" })), true);
});

test("a native checkout returns through the bounce, not the web app", () => {
  const { success_url, cancel_url } = returnUrls(req({ platform: "ios" }), paths);
  assert.equal(success_url, "https://api.example.com/api/billing/return?status=success");
  assert.equal(cancel_url, "https://api.example.com/api/billing/return?status=cancelled");
});

test("both Stripe URLs are absolute http(s) — Stripe rejects anything else", () => {
  for (const body of [undefined, { platform: "ios" }]) {
    const urls = returnUrls(req(body), paths);
    for (const u of [urls.success_url, urls.cancel_url]) {
      assert.match(u, /^https?:\/\//, `${u} is not an absolute http(s) URL`);
      assert.doesNotMatch(u, /^scholr:/, "Stripe cannot redirect to a custom scheme");
    }
  }
});
