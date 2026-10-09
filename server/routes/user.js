// Profile, onboarding, streaks, terms and subscription.
import { Router } from "express";
import { recordConsent, trackEvent } from "../lib/analytics.js";
import { requireAuth } from "../lib/auth.js";
import { WELCOME_NOTE } from "../lib/notebooks.js";
import { supabase } from "../lib/supabase.js";
import { FREE_MSG_LIMIT, countOwnedNotebooks, getUserTier, resetUsageIfNeeded } from "../lib/usage.js";

export const router = Router();

// ── Daily visit tracking ──────────────────────────────────────────────────
// POST /api/user/track-visit — marks today as "active" for the user if not already.
// Body: { dateLabel: "YYYY-MM-DD" } — client-local date (avoids server-tz drift).
// Idempotent: if a row already exists for (user_id, dateLabel), no-op.
router.post("/api/user/track-visit", requireAuth, async (req, res) => {
  const raw = req.body?.dateLabel;
  // Validate YYYY-MM-DD strictly — bail if missing/malformed to avoid bad data.
  const dateLabel = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? raw
    : new Date().toISOString().slice(0, 10);
  try {
    const { data: existing } = await supabase
      .from("daily_activity")
      .select("id")
      .eq("user_id", req.user.id)
      .eq("date", dateLabel)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabase
        .from("daily_activity")
        .insert({ user_id: req.user.id, date: dateLabel, activity_count: 1 });
      if (error) {
        // Race condition (unique constraint hit) — treat as already-tracked, not an error.
        if (!/duplicate key|unique/i.test(error.message)) {
          return res.status(500).json({ error: error.message });
        }
      }
    }
    res.json({ tracked: true });
  } catch (err) {
    console.error("track-visit error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Activity heatmap ──────────────────────────────────────────────────────
// GET /api/user/activity-heatmap — last 365 days of activity for current user
router.get("/api/user/activity-heatmap", requireAuth, async (req, res) => {
  const start = new Date();
  start.setDate(start.getDate() - 365);
  const startStr = start.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("daily_activity")
    .select("date, activity_count")
    .eq("user_id", req.user.id)
    .gte("date", startStr)
    .order("date", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data ?? []).map(r => ({ date: r.date, count: r.activity_count ?? 0 })));
});

// GET /api/user/terms-status — has the caller accepted the current terms?
// Used by the in-app "terms wall" to gate existing users who predate the
// signup age-gate (no profiles row → not accepted).
router.get("/api/user/terms-status", requireAuth, async (req, res) => {
  const { data } = await supabase
    .from("profiles")
    .select("terms_accepted_at")
    .eq("user_id", req.user.id)
    .maybeSingle();
  res.json({ accepted: !!data?.terms_accepted_at });
});

// ── Profile flags (onboarding wizard + streak gamification) ───────────────────
router.get("/api/user/profile", requireAuth, async (req, res) => {
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_completed, longest_streak, streak_milestones_shown")
    .eq("user_id", req.user.id)
    .maybeSingle();
  res.json({
    onboarding_completed: !!data?.onboarding_completed,
    longest_streak: data?.longest_streak ?? 0,
    streak_milestones_shown: data?.streak_milestones_shown ?? [],
  });
});

router.post("/api/user/complete-onboarding", requireAuth, async (req, res) => {
  await supabase.from("profiles").upsert({ user_id: req.user.id, onboarding_completed: true }, { onConflict: "user_id" });
  trackEvent(req.user.id, "onboarding_completed");
  res.json({ ok: true });
});

router.post("/api/user/seed-welcome", requireAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    const count = await countOwnedNotebooks(userId);
    if (count > 0) return res.json({ seeded: false }); // brand-new users only
    const { data: nb, error } = await supabase
      .from("notebooks")
      .insert({ title: "Welcome to Scholr 👋", topic: "Start here", created_by: userId })
      .select("id")
      .single();
    if (error || !nb) { console.error("[seed-welcome]", error?.message); return res.json({ seeded: false }); }
    await supabase.from("notebook_members").insert({ notebook_id: nb.id, user_id: userId, role: "owner" });
    await supabase.from("notes").insert({ notebook_id: nb.id, uploader_id: userId, title: "How Scholr works", content: WELCOME_NOTE });
    await supabase.from("profiles").upsert({ user_id: userId, onboarding_completed: true }, { onConflict: "user_id" });
    trackEvent(userId, "notebook_created", { notebookId: nb.id, seeded: true });
    res.json({ seeded: true, notebookId: nb.id });
  } catch (e) {
    console.error("[seed-welcome]", e.message);
    res.json({ seeded: false });
  }
});

// Update longest streak if the current run beats the stored record.
router.post("/api/user/streak", requireAuth, async (req, res) => {
  const current = Math.max(0, parseInt(req.body?.current, 10) || 0);
  const { data } = await supabase.from("profiles").select("longest_streak").eq("user_id", req.user.id).maybeSingle();
  const longest = Math.max(current, data?.longest_streak ?? 0);
  await supabase.from("profiles").upsert({ user_id: req.user.id, longest_streak: longest }, { onConflict: "user_id" });
  res.json({ longest_streak: longest });
});

// Record which limit triggered an upgrade prompt (analytics: what converts).
router.post("/api/user/upgrade-trigger", requireAuth, async (req, res) => {
  const trigger = String(req.body?.trigger ?? "").slice(0, 64);
  if (!trigger) return res.status(400).json({ error: "trigger required" });
  try {
    await supabase.from("profiles").upsert({ user_id: req.user.id, upgrade_trigger: trigger }, { onConflict: "user_id" });
    trackEvent(req.user.id, "upgrade_modal_viewed", { trigger });
  } catch (e) { console.error("[upgrade-trigger]", e.message); }
  res.json({ ok: true });
});

// POST /api/user/accept-terms — record consent for an existing logged-in user
// (the terms wall). Same write path as signup via recordConsent().
router.post("/api/user/accept-terms", requireAuth, async (req, res) => {
  if (req.body?.termsAccepted !== true) {
    return res.status(400).json({ error: "terms_required", message: "You must accept the Terms of Service and Privacy Policy to continue." });
  }
  await recordConsent(req.user.id);
  res.json({ ok: true });
});

// GET /api/user/subscription — current tier + usage stats
router.get("/api/user/subscription", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const tier = await getUserTier(userId);
  await resetUsageIfNeeded(userId);

  const [{ data: usageRow }, { data: sub }, notebooksUsed] = await Promise.all([
    supabase.from("usage")
      .select("messages_this_month, forge_outputs_this_month, reset_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("subscriptions")
      .select("current_period_end, cancel_at_period_end")
      .eq("user_id", userId)
      .maybeSingle(),
    countOwnedNotebooks(userId),
  ]);

  res.json({
    tier,
    messagesUsed:   usageRow?.messages_this_month ?? 0,
    messagesLimit:  tier === "pro" ? null : FREE_MSG_LIMIT,
    forgeUsed:      usageRow?.forge_outputs_this_month ?? 0,
    forgeLimit:     tier === "pro" ? null : 3,
    notebooksUsed,
    notebooksLimit: tier === "pro" ? null : 3,
    resetAt:        usageRow?.reset_at ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
    cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
  });
});
