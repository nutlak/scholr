// Turns "look up one key" calls made around the same moment into ONE call that
// looks up all of them. The classic N+1 fix: code like
//
//   await Promise.all(ids.map(id => lookup(id)))
//
// reads like N independent lookups, but `lookup` is built on a batcher, so it
// sends a single `WHERE id IN (...)` instead of N queries. Callers don't change.
//
// `loadMany(keys)` gets the distinct keys of one batch and returns a Map of
// key -> value (a missing key resolves to null). If it throws, every caller in
// that batch rejects with the same error, and the next batch starts clean.
//
// Batches close on setImmediate, i.e. after every promise callback queued by the
// current turn has run, so lookups started a few awaits apart still coalesce.
export function createBatcher(loadMany) {
  let pending = null;
  return function load(key) {
    return new Promise((resolve, reject) => {
      if (!pending) {
        const batch = (pending = []);
        setImmediate(async () => {
          pending = null;
          try {
            const results = await loadMany([...new Set(batch.map(w => w.key))]);
            for (const w of batch) w.resolve(results.get(w.key) ?? null);
          } catch (err) {
            for (const w of batch) w.reject(err);
          }
        });
      }
      pending.push({ key, resolve, reject });
    });
  };
}

// A small time-limited cache for values that change rarely and are expensive to
// fetch (display names from the auth service). Failed lookups are never stored.
// Entries are evicted oldest-first past `max`, so it can't grow without bound.
// Per process: every server instance warms its own copy.
export function createTtlCache({ ttlMs, max = 5000, now = Date.now }) {
  const map = new Map();
  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (now() - hit.at >= ttlMs) { map.delete(key); return undefined; }
      return hit.value;
    },
    set(key, value) {
      if (map.size >= max && !map.has(key)) map.delete(map.keys().next().value);
      map.set(key, { at: now(), value });
    },
    get size() { return map.size; },
  };
}
