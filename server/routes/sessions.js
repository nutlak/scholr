// Planned study sessions (see lib/sessions.js for how they're stored).
import { Router } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { requireAuth, requireMember } from "../lib/auth.js";
import { trackEvent } from "../lib/analytics.js";
import { supabase } from "../lib/supabase.js";
import {
  MAX_UPCOMING_PER_UNIT, RSVP_TYPE, SESSION_TYPE,
  isUpcoming, listSessions, notifyAboutSession, parseSessionInput, readSession,
} from "../lib/sessions.js";

export const router = Router();

const sessionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 30,
  keyGenerator: req => req.user?.id ?? ipKeyGenerator(req.ip),
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many session changes. Please slow down." },
});

// Loads a session and proves the caller belongs to its unit. 404 for both
// "no such session" and "not yours", so ids can't be probed.
async function sessionFor(req, res) {
  const { data: row } = await supabase.from("forge_outputs")
    .select("id, notebook_id, user_id, content").eq("id", req.params.sid).eq("type", SESSION_TYPE).maybeSingle();
  const { data: member } = row
    ? await supabase.from("notebook_members").select("role").eq("notebook_id", row.notebook_id).eq("user_id", req.user.id).maybeSingle()
    : { data: null };
  if (!row || !member) { res.status(404).json({ error: "Session not found" }); return null; }
  return { row, session: readSession(row) };
}

router.get("/api/notebooks/:id/sessions", requireAuth, requireMember, async (req, res) => {
  res.json(await listSessions(req.params.id, req.user.id));
});

router.post("/api/notebooks/:id/sessions", requireAuth, requireMember, sessionLimiter, async (req, res) => {
  const input = parseSessionInput(req.body);
  if (input.error) return res.status(400).json({ error: input.error });

  const upcoming = await listSessions(req.params.id, req.user.id);
  if (upcoming.length >= MAX_UPCOMING_PER_UNIT) {
    return res.status(400).json({ error: `This unit already has ${MAX_UPCOMING_PER_UNIT} sessions planned.` });
  }

  const { data: created, error } = await supabase.from("forge_outputs").insert({
    notebook_id: req.params.id, user_id: req.user.id, type: SESSION_TYPE, title: "Study session",
    content: JSON.stringify({ startsAt: input.startsAt, note: input.note }),
  }).select("id").single();
  if (error || !created) return res.status(500).json({ error: "Couldn't plan that session. Try again." });

  // The planner is going.
  await supabase.from("forge_outputs").insert({
    notebook_id: req.params.id, user_id: req.user.id, type: RSVP_TYPE, title: created.id, content: "",
  });

  // Tell everyone else in the unit.
  const [{ data: members }, { data: nb }] = await Promise.all([
    supabase.from("notebook_members").select("user_id").eq("notebook_id", req.params.id),
    supabase.from("notebooks").select("title").eq("id", req.params.id).maybeSingle(),
  ]);
  notifyAboutSession({
    userIds: (members ?? []).map(m => m.user_id).filter(id => id !== req.user.id),
    kind: "session_planned", notebookId: req.params.id, notebookTitle: nb?.title, startsAt: input.startsAt,
    fromUserId: req.user.id, pushBody: who => `${who ?? "A classmate"} planned a study session.`,
  }).catch(e => console.error("[sessions notify]", e.message));

  trackEvent(req.user.id, "study_session_planned", { notebookId: req.params.id });
  res.json((await listSessions(req.params.id, req.user.id)).find(s => s.id === created.id));
});

// Say you're in (going: true) or out (going: false).
router.post("/api/sessions/:sid/rsvp", requireAuth, sessionLimiter, async (req, res) => {
  const found = await sessionFor(req, res);
  if (!found) return;
  if (!isUpcoming(found.session)) return res.status(400).json({ error: "That session has already happened." });
  const { data: mine } = await supabase.from("forge_outputs").select("id")
    .eq("type", RSVP_TYPE).eq("title", found.row.id).eq("user_id", req.user.id);
  if (req.body?.going === false) {
    if (mine?.length) await supabase.from("forge_outputs").delete().in("id", mine.map(r => r.id));
  } else if (!mine?.length) {
    await supabase.from("forge_outputs").insert({
      notebook_id: found.row.notebook_id, user_id: req.user.id, type: RSVP_TYPE, title: found.row.id, content: "",
    });
    trackEvent(req.user.id, "study_session_joined", { notebookId: found.row.notebook_id });
  }
  res.json((await listSessions(found.row.notebook_id, req.user.id)).find(s => s.id === found.row.id) ?? null);
});

// Only whoever planned it can cancel it.
router.delete("/api/sessions/:sid", requireAuth, sessionLimiter, async (req, res) => {
  const found = await sessionFor(req, res);
  if (!found) return;
  if (found.row.user_id !== req.user.id) return res.status(403).json({ error: "Only the person who planned it can cancel." });
  await supabase.from("forge_outputs").delete().eq("type", RSVP_TYPE).eq("title", found.row.id);
  await supabase.from("forge_outputs").delete().eq("id", found.row.id);
  res.json({ ok: true });
});
