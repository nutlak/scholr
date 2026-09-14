import { createClient } from "@supabase/supabase-js";

// Public (publishable/anon) project credentials — safe to ship to the client.
// Exported so the Realtime layer (src/lib/live.js) can reach the same project
// over its REST broadcast endpoint without a second client.
export const SUPABASE_URL = "https://dbgdzgxrwelppotfvyym.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_qvUioXv0KZdmjs4sAjFlVQ_mwWpBVtL";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
