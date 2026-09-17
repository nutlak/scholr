#!/usr/bin/env node
// Verify production Supabase actually has everything the code expects.
//
// Migrations here are applied BY HAND in the Supabase dashboard, so a
// migration can sit committed in migrations/ and never reach production --
// the same shape as the 2026-09-17 outage, where config existed in the repo's
// world but not in the running one. Tables and buckets are checked too, since
// a missing one only shows up as a 500 in whichever feature touches it.
//
// Read-only. Run: node server/scripts/check-prod-schema.mjs
import { config } from "dotenv";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
config({ path: join(repo, "server", ".env") });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const src = readFileSync(join(repo, "server", "index.js"), "utf8");
const tables = [...new Set([...src.matchAll(/\.from\("([a-z_]+)"\)/g)].map(m => m[1]))]
  .filter(t => !/^(scholr|notebook-images)$/.test(t)); // storage buckets, not tables
const buckets = [...new Set([...src.matchAll(/storage\.from\("([a-z-]+)"\)/g)].map(m => m[1]))];

// Every column any migration adds, so an unapplied migration is visible.
const cols = new Set();
for (const dir of ["migrations", join("supabase", "migrations")]) {
  let files = [];
  try { files = readdirSync(join(repo, dir)).filter(f => f.endsWith(".sql")); } catch { continue; }
  for (const f of files) {
    const sql = readFileSync(join(repo, dir, f), "utf8");
    for (const m of sql.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?"?(\w+)"?\s+([\s\S]*?);/gi)) {
      for (const c of m[2].matchAll(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/gi)) {
        cols.add(`${m[1].toLowerCase()}.${c[1].toLowerCase()}`);
      }
    }
  }
}

let bad = 0;
const fail = m => { console.log("  ✗", m); bad++; };

for (const t of tables) {
  // NOT `{ head: true }` — PostgREST answers a HEAD against a nonexistent
  // table with no error at all, so the obvious form of this check silently
  // passes for every missing table. limit(0) still round-trips the table name
  // and errors properly, without pulling any rows.
  const { error } = await sb.from(t).select("*").limit(0);
  if (error) fail(`table ${t} — ${error.message}`);
}
console.log(`tables:  ${tables.length} checked`);

for (const pair of cols) {
  const [t, c] = pair.split(".");
  const { error } = await sb.from(t).select(c, { head: true, count: "exact" });
  if (error) fail(`column ${pair} — migration likely not applied in production`);
}
console.log(`columns: ${cols.size} checked (every ADD COLUMN in migrations/)`);

const { data: list, error: bErr } = await sb.storage.listBuckets();
if (bErr) fail(`buckets — ${bErr.message}`);
else {
  const names = new Set(list.map(b => b.name));
  for (const b of buckets) if (!names.has(b)) fail(`bucket ${b} missing`);
}
console.log(`buckets: ${buckets.length} checked`);

console.log(bad ? `\n✗ ${bad} problem(s) — production is behind the repo` : "\n✓ production matches the repo");
process.exit(bad ? 1 : 0);
