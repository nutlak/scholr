// dotenv, loaded as a module so it runs before anything that reads process.env.
//
// ESM evaluates every import before the importing module's body, so the old
// `config()` call sitting between index.js's imports would now fire *after*
// lib/supabase.js had already tried to build a client — "supabaseUrl is
// required" at boot. Importing this module first is what restores the ordering,
// and the env-reading modules import it themselves so they're safe no matter
// which entry point pulls them in.
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env") });
