// Podcast generation and playback.
import { Router } from "express";
import { trackEvent } from "../lib/analytics.js";
import { requireAuth, requireMember } from "../lib/auth.js";
import { aiLimiter, podcastLimiter } from "../lib/limiters.js";
import { PODCAST_FORMATS, PODCAST_LENGTH_TARGETS, runPodcastPipeline } from "../lib/podcast.js";
import { supabase } from "../lib/supabase.js";
import { getUserTier } from "../lib/usage.js";
import { UUID_RE } from "../lib/validate.js";

export const router = Router();

// POST /api/notebooks/:id/podcast/generate — Pro-only.
// Responds with { podcastId } immediately; client polls GET /api/podcasts/:id.
router.post("/api/notebooks/:id/podcast/generate", requireAuth, requireMember, aiLimiter, podcastLimiter, async (req, res) => {
  const tier = await getUserTier(req.user.id);
  if (tier !== "pro") {
    return res.status(403).json({ error: "pro_required", message: "Podcast Mode is a Pro feature." });
  }
  const lengthPreset = PODCAST_LENGTH_TARGETS[req.body?.lengthPreset] ? req.body.lengthPreset : "standard";
  const formatPreset = PODCAST_FORMATS.includes(req.body?.formatPreset) ? req.body.formatPreset : "casual";
  const focusRaw = typeof req.body?.focusTopic === "string" ? req.body.focusTopic.trim() : "";
  const focusTopic = focusRaw ? focusRaw.slice(0, 200) : null;

  // Optional: a second notebook (typically a friend's, on the same unit) to
  // draw the episode from too. Membership is checked here, same as the
  // first notebook via requireMember — a caller can't pull in a notebook
  // they don't already belong to.
  let secondNotebookId = null;
  const secondRaw = req.body?.secondNotebookId;
  if (typeof secondRaw === "string" && UUID_RE.test(secondRaw) && secondRaw !== req.params.id) {
    const { data: member } = await supabase
      .from("notebook_members")
      .select("user_id")
      .eq("notebook_id", secondRaw)
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (member) secondNotebookId = secondRaw;
  }

  // Insert generating row up-front so client immediately has an id to poll.
  const { data: row, error } = await supabase
    .from("podcasts")
    .insert({
      notebook_id: req.params.id,
      created_by: req.user.id,
      title: "Generating episode…",
      length_preset: lengthPreset,
      format_preset: formatPreset,
      focus_topic: focusTopic,
      status: "generating",
    })
    .select("id")
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Fire-and-forget the pipeline. Not awaited — we must not hold the
  // response while TTS runs (minutes). The pipeline updates the row itself.
  setImmediate(() => {
    runPodcastPipeline(row.id, {
      notebookId: req.params.id,
      userId: req.user.id,
      lengthPreset, formatPreset, focusTopic, secondNotebookId,
    }).catch(err => console.error("podcast pipeline crashed:", err));
  });

  trackEvent(req.user.id, "podcast_created", { notebookId: req.params.id });
  res.json({ podcastId: row.id });
});

// GET /api/notebooks/:id/podcasts — list episodes for this notebook (members only).
router.get("/api/notebooks/:id/podcasts", requireAuth, requireMember, async (req, res) => {
  const { data, error } = await supabase
    .from("podcasts")
    .select("id, title, audio_url, duration_seconds, status, length_preset, format_preset, focus_topic, created_at, created_by")
    .eq("notebook_id", req.params.id)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// GET /api/podcasts/:podcastId — single episode (for polling status + reading transcript).
// Membership-checked via the notebook FK.
router.get("/api/podcasts/:podcastId", requireAuth, async (req, res) => {
  const { data: pod, error } = await supabase
    .from("podcasts")
    .select("id, notebook_id, title, audio_url, duration_seconds, status, length_preset, format_preset, focus_topic, transcript, error_message, created_at, created_by")
    .eq("id", req.params.podcastId)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!pod) return res.status(404).json({ error: "Podcast not found" });
  // Must be a member of the notebook.
  const { data: member } = await supabase
    .from("notebook_members")
    .select("user_id")
    .eq("notebook_id", pod.notebook_id)
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (!member) return res.status(403).json({ error: "Not a member of this notebook" });
  res.json(pod);
});
