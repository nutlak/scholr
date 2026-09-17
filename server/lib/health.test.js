// Run with: npm test
//
// Guards the bug that took an afternoon on 2026-09-17: push notifications and
// Squad checkout were both dead in production because four env vars were never
// set there — and /api/health, the endpoint built to catch exactly that,
// reported all-true. It had been written before either feature shipped and
// nobody updated its list, so it lied by omission for two days while Squad
// silently couldn't take money.
//
// The invariant: any env var read WITHOUT a fallback is one whose absence
// breaks something quietly, so it must be declared in /api/health. Vars with a
// `||` / `??` default degrade safely and don't need declaring.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = join(dirname(fileURLToPath(import.meta.url)), "..");

// Operational knobs, not feature credentials: absence is the normal case and
// changes nothing a user can see. Adding to this list should be a conscious
// decision, which is the point of it being explicit.
const OPERATIONAL = new Set([
  "PORT",              // defaults to 3001
  "NODE_ENV",
  "DEBUG",             // extra logging only
  "DISABLE_WORKERS",   // presence check; local-only email guard
  "AI_BASE_URL",       // test-harness override, guarded by `if (baseURL)`
]);

function sourceFiles() {
  const files = [join(serverDir, "index.js"), join(serverDir, "email.js")];
  for (const f of readdirSync(join(serverDir, "lib"))) {
    if (f.endsWith(".js") && !f.endsWith(".test.js")) files.push(join(serverDir, "lib", f));
  }
  return files;
}

// A read "has a fallback" when the same expression supplies a default.
function readsWithoutFallback(src) {
  const found = new Set();
  const re = /process\.env\.([A-Z0-9_]+)\s*(\?\?|\|\|)?/g;
  let m;
  while ((m = re.exec(src))) {
    if (!m[2]) found.add(m[1]);
  }
  return found;
}

test("/api/health declares every env var that has no fallback", () => {
  const index = readFileSync(join(serverDir, "index.js"), "utf8");

  // The literal env block inside the health route.
  const block = index.match(/app\.get\("\/api\/health"[\s\S]*?\n {2}\};/);
  assert.ok(block, "could not locate the /api/health env block — did the route move?");
  const declared = new Set([...block[0].matchAll(/^ {4}([A-Z0-9_]+):/gm)].map(m => m[1]));
  assert.ok(declared.size > 5, `parsed too few declared vars (${declared.size}) — the matcher is probably broken`);

  const required = new Set();
  for (const file of sourceFiles()) {
    for (const v of readsWithoutFallback(readFileSync(file, "utf8"))) {
      if (!OPERATIONAL.has(v)) required.add(v);
    }
  }

  const undeclared = [...required].filter(v => !declared.has(v)).sort();
  assert.deepEqual(
    undeclared, [],
    `These env vars are read with no fallback but aren't in /api/health, so a deploy `
    + `missing them fails silently:\n  ${undeclared.join("\n  ")}\n`
    + `Add them to the env block in server/index.js (value never exposed, just !!presence).`,
  );
});

test("the health route still exposes presence only, never values", () => {
  const index = readFileSync(join(serverDir, "index.js"), "utf8");
  const block = index.match(/app\.get\("\/api\/health"[\s\S]*?\n {2}\};/);
  const lines = block[0].split("\n").filter(l => /^ {4}[A-Z0-9_]+:/.test(l));
  assert.ok(lines.length > 0, "no env lines parsed");
  for (const line of lines) {
    assert.match(
      line, /:\s*!!process\.env\./,
      `health must report !!presence, never a raw value — offending line: ${line.trim()}`,
    );
  }
});
