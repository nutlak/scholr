// Run with: npm test   (node:test — no framework)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBatcher, createTtlCache } from "./batch.js";

test("lookups made together become one call with distinct keys", async () => {
  const calls = [];
  const load = createBatcher(async (keys) => { calls.push(keys); return new Map(keys.map(k => [k, k.toUpperCase()])); });
  const out = await Promise.all(["a", "b", "a", "c"].map(load));
  assert.deepEqual(out, ["A", "B", "A", "C"]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ["a", "b", "c"]);
});

test("lookups a few awaits apart still share a batch", async () => {
  let calls = 0;
  const load = createBatcher(async (keys) => { calls++; return new Map(keys.map(k => [k, k])); });
  await Promise.all([1, 2, 3].map(async (k) => { await null; await null; return load(k); }));
  assert.equal(calls, 1);
});

test("a key the loader doesn't return resolves to null, not undefined or a hang", async () => {
  const load = createBatcher(async () => new Map());
  assert.equal(await load("nobody"), null);
});

test("a failing batch rejects all its callers, and the next batch is unaffected", async () => {
  let fail = true;
  const load = createBatcher(async (keys) => { if (fail) throw new Error("db down"); return new Map(keys.map(k => [k, 1])); });
  const settled = await Promise.allSettled([load("a"), load("b")]);
  assert.deepEqual(settled.map(s => s.status), ["rejected", "rejected"]);
  fail = false;
  assert.equal(await load("a"), 1);
});

test("separate moments make separate batches", async () => {
  const sizes = [];
  const load = createBatcher(async (keys) => { sizes.push(keys.length); return new Map(keys.map(k => [k, k])); });
  await load("a");
  await Promise.all([load("b"), load("c")]);
  assert.deepEqual(sizes, [1, 2]);
});

test("the cache expires entries, evicts the oldest past its cap, and reports misses", () => {
  let t = 1000;
  const cache = createTtlCache({ ttlMs: 100, max: 2, now: () => t });
  assert.equal(cache.get("x"), undefined);
  cache.set("x", 1); cache.set("y", 2);
  assert.equal(cache.get("x"), 1);
  t += 99; assert.equal(cache.get("y"), 2);
  t += 2; assert.equal(cache.get("y"), undefined);          // 101ms old: expired
  cache.set("a", 3); cache.set("b", 4);                      // cap is 2: oldest goes
  assert.equal(cache.size, 2);
  assert.equal(cache.get("a"), 3);
});
