// Public stats and email unsubscribe.
import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { unsubPage } from "../lib/urls.js";
import { unsubTokenValid } from "../email.js";
import { relayJarvis } from "../lib/analytics.js";
import { errorReportLimiter } from "../lib/limiters.js";

export const router = Router();

// ── Start ─────────────────────────────────────────────────────────────────────
// ── Public aggregate stats (landing-page social proof) ───────────────────────
// Three aggregates over growing tables: two `count: "exact"` scans plus an
// admin listUsers. Measured cold at 4.8 SECONDS, and it only gets slower as the
// tables grow. It was already cached for 5 minutes, which hid it from everyone
// except whoever arrived first after an expiry — and that person is exactly the
// one you care about, because this feeds the landing page.
//
// So the cache is stale-while-revalidate: an expired entry is still served
// immediately and a refresh runs behind it. And a single in-flight promise is
// shared, because "cache expired" is a thundering herd — every visitor who
// arrives during those 4.8s used to start their own copy of the same three
// queries.
const STATS_TTL_MS = 5 * 60 * 1000;
let statsCache = { data: null, at: 0 };
let statsInFlight = null;

async function refreshStats() {
  // One refresh at a time, whoever asks.
  if (statsInFlight) return statsInFlight;
  statsInFlight = (async () => {
    const [usersRes, nbRes, notesRes] = await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1 }),
      supabase.from("notebooks").select("*", { count: "exact", head: true }),
      supabase.from("notes").select("*", { count: "exact", head: true }),
    ]);
    const data = {
      userCount:     usersRes?.data?.total ?? usersRes?.data?.users?.length ?? 0,
      notebookCount: nbRes.count ?? 0,
      noteCount:     notesRes.count ?? 0,
    };
    statsCache = { data, at: Date.now() };
    return data;
  })().finally(() => { statsInFlight = null; });
  return statsInFlight;
}

router.get("/api/stats/public", async (req, res) => {
  const fresh = statsCache.data && Date.now() - statsCache.at < STATS_TTL_MS;
  if (statsCache.data) {
    // Serve what we have, now. If it has gone stale, start the refresh behind
    // this response rather than in front of it — a five-minute-old visitor
    // count is social proof, not a readout, and nobody should wait on it.
    if (!fresh) refreshStats().catch(err => console.error("[stats/public] refresh", err.message));
    return res.json(statsCache.data);
  }
  // Cold start only: nothing to serve yet, so this one request does wait.
  try {
    res.json(await refreshStats());
  } catch (err) {
    console.error("[stats/public]", err.message);
    res.json({ userCount: 0, notebookCount: 0, noteCount: 0, fallback: true });
  }
});

// Warm it at boot so even that first visitor gets a cached answer. Failure is
// fine — the request path still falls back to computing it on demand.
refreshStats().catch(() => {});

router.get("/api/email/unsubscribe", (req, res) => {
  const u = encodeURIComponent(String(req.query.u || ""));
  const t = encodeURIComponent(String(req.query.t || ""));
  res.set("Content-Type", "text/html").send(unsubPage(
    `<p style="color:#A0A0B8;">Unsubscribe from Scholr onboarding emails?</p>
     <form method="POST" action="/api/email/unsubscribe?u=${u}&t=${t}">
       <button type="submit" style="background:#A78BFA;color:#0A0A0F;border:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer;">Unsubscribe</button>
     </form>`));
});

router.post("/api/email/unsubscribe", async (req, res) => {
  const u = String(req.query?.u || req.body?.u || "");
  const t = String(req.query?.t || req.body?.t || "");
  if (!u) return res.status(400).send(unsubPage("<p>Missing user.</p>"));
  // Authorize on the signed token, not the bare user_id. Without this any known
  // UUID could unsubscribe any user (IDOR/CSRF); the service-role client bypasses
  // RLS, so there is no DB backstop. Fail closed on a bad/absent token.
  if (!unsubTokenValid(u, t)) return res.status(403).send(unsubPage("<p>This unsubscribe link is invalid or expired.</p>"));
  try {
    await supabase.from("profiles").upsert({ user_id: u, email_unsubscribed: true }, { onConflict: "user_id" });
  } catch (e) { console.error("[unsubscribe]", e.message); }
  res.set("Content-Type", "text/html").send(unsubPage(`<p style="color:#A0A0B8;">You're unsubscribed. You won't get onboarding emails anymore.</p>`));
});

// ── Client crash reports ─────────────────────────────────────────────────────
// Before this existed, an unhandled render error white-screened the app and the
// only record of it was a console nobody reads. This is deliberately
// first-party: the reports land in scholr's own jarvis_events table, so there
// is no third-party processor in the path and nothing to add to the privacy
// policy for a product with under-18 users.
//
// Unauthenticated, because the crashes worth hearing about include the ones
// that happen before a session resolves. That makes every field below
// attacker-controlled: nothing is trusted, everything is a truncated string,
// and no field is ever interpolated anywhere. errorReportLimiter caps it.
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : null);

router.post("/api/client-error", errorReportLimiter, (req, res) => {
  const b = req.body ?? {};
  const message = str(b.message, 500);
  // Nothing useful to store without a message, and an empty report is the
  // shape a scanner sends.
  if (!message) return res.status(400).json({ error: "message_required" });

  relayJarvis("client_error", {
    message,
    kind:           str(b.kind, 40),          // "render" | "window" | "promise"
    stack:          str(b.stack, 4000),
    componentStack: str(b.componentStack, 4000),
    path:           str(b.path, 300),         // pathname only — the client strips query/hash
    userAgent:      str(req.get("user-agent"), 300),
    appVersion:     str(b.appVersion, 60),
    userId:         str(b.userId, 64),        // claimed, not verified — for grouping only
    at:             new Date().toISOString(),
  });

  // 204 whatever happened: the client is already broken and must never retry
  // or branch on this.
  res.status(204).end();
});
