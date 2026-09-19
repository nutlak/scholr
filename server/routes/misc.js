// Public stats and email unsubscribe.
import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { unsubPage } from "../lib/urls.js";
import { unsubTokenValid } from "../email.js";

export const router = Router();

// ── Start ─────────────────────────────────────────────────────────────────────
// ── Public aggregate stats (landing-page social proof) — cached 5 min ─────────
let statsCache = { data: null, at: 0 };

router.get("/api/stats/public", async (req, res) => {
  try {
    if (statsCache.data && Date.now() - statsCache.at < 5 * 60 * 1000) {
      return res.json(statsCache.data);
    }
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
    res.json(data);
  } catch (err) {
    console.error("[stats/public]", err.message);
    res.json({ userCount: 0, notebookCount: 0, noteCount: 0, fallback: true });
  }
});

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
