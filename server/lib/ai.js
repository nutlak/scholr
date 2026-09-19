// Prompt construction and AI-response handling shared by the query, forge,
// feynman, explain and podcast routes.
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "./supabase.js";
import { resolveUserBrief } from "./users.js";

export const NOTES_CONTEXT_CHAR_CAP = 80000; // ~20K tokens
export function buildNotesContext(notes, { emptyFallback = "(no notes uploaded yet)", formatHeader } = {}) {
  const header = formatHeader || (n => `Note: ${n.title || "Untitled"}`);
  const parts = [];
  let total = 0;
  let truncated = false;
  for (const n of notes ?? []) {
    const body = n.content ? n.content : "[file attachment — no text content]";
    const chunk = `${header(n)}\n${body}`;
    if (total + chunk.length > NOTES_CONTEXT_CHAR_CAP) { truncated = true; break; }
    parts.push(chunk);
    total += chunk.length + 9; // rough allowance for the "\n\n---\n\n" joiner
  }
  if (parts.length === 0) return emptyFallback;
  const joined = parts.join("\n\n---\n\n");
  return truncated
    ? `${joined}\n\n[older or additional notes omitted — this notebook has more content than fits one request]`
    : joined;
}

// POST /api/notebooks/:id/query — AI query against notebook notes (Derek chat)

// ── Group context for Derek ───────────────────────────────────────────────────
// Derek sits in a *shared* chat, so he needs to know who is in the room, who is
// speaking, and whose notes he is quoting. Display names are user-controlled, so
// they are stripped of control characters and capped before they reach a prompt —
// a name containing newlines could otherwise forge a turn boundary.
export function promptSafeName(name, fallback = "A student") {
  return String(name ?? "")
    .replace(/\p{C}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40) || fallback;
}

// user_id → display name for every member of a notebook.
export async function notebookMemberNames(notebookId) {
  const { data: members } = await supabase
    .from("notebook_members")
    .select("user_id")
    .eq("notebook_id", notebookId);
  const ids = (members ?? []).map(m => m.user_id);
  const briefs = await Promise.all(ids.map(resolveUserBrief));
  return new Map(briefs.map(b => [b.userId, promptSafeName(b.name)]));
}

export function aiErrorDetail(err, provider = "Claude") {
  const parts = [provider];
  if (err?.status) parts.push(String(err.status));
  const code = err?.error?.error?.type || err?.error?.type || err?.code;
  if (code) parts.push(`(${code})`);
  const msg = err?.error?.error?.message || err?.message || "request failed";
  return `${parts.join(" ")}: ${msg}`.slice(0, 280);
}

// Coerce the model's JSON into a strict, safe shape so the UI never renders junk.
export function validateFeynmanResult(p) {
  const clampScore = (n) => {
    const x = Math.round(Number(n));
    return Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : 0;
  };
  const strArr = (v) => Array.isArray(v)
    ? v.filter(x => typeof x === "string" && x.trim()).map(x => x.trim().slice(0, 180)).slice(0, 5)
    : [];
  const str = (v, fb = "") => (typeof v === "string" && v.trim()) ? v.trim().slice(0, 400) : fb;
  return {
    score: clampScore(p?.score),
    verdict: str(p?.verdict, "Graded."),
    nailed: strArr(p?.nailed),
    gaps: strArr(p?.gaps),
    misconceptions: strArr(p?.misconceptions),
    followup: str(p?.followup, ""),
  };
}

// Anthropic client factory. AI_BASE_URL points the SDK at an Anthropic-compatible
// proxy (e.g. a local router) instead of api.anthropic.com — useful for local
// development, where every test message otherwise spends real credits.
//
// Unset in production, which is deliberate: the Pro tier is sold as "Claude
// Sonnet", so production must actually call Anthropic. Do not set this on a
// deployment that serves paying users.
export function anthropicClient(apiKey) {
  const baseURL = process.env.AI_BASE_URL;
  if (baseURL) return new Anthropic({ apiKey, baseURL });
  return new Anthropic({ apiKey });
}

export function getModel(tier) {
  // Overridable only so a local proxy can serve its own model ids alongside
  // AI_BASE_URL. Left unset in production.
  if (tier === "pro") return process.env.AI_MODEL_PRO || "claude-sonnet-5";
  return process.env.AI_MODEL_FREE || "claude-haiku-4-5-20251001";
}

// How much of the shared chat Derek sees. Enough to follow a thread and answer
// "explain that again"; short enough that a long-running notebook doesn't blow
// the context window or the bill.
export const QUERY_HISTORY_TURNS = 20;

// ── Image generation (OpenAI proxy) ───────────────────────────────────────────
// Keeps OPENAI_API_KEY server-side; client never sees it.
// Simple in-memory token bucket per user: 5 requests / 60s window.
export const IMAGE_RATE_LIMIT = { max: 5, windowMs: 60_000 };

export const imageHits = new Map(); // userId -> [timestamps]

export function checkImageRateLimit(userId) {
  const now = Date.now();
  const cutoff = now - IMAGE_RATE_LIMIT.windowMs;
  const hits = (imageHits.get(userId) ?? []).filter(t => t > cutoff);
  if (hits.length >= IMAGE_RATE_LIMIT.max) {
    const retryAfter = Math.ceil((hits[0] + IMAGE_RATE_LIMIT.windowMs - now) / 1000);
    return { ok: false, retryAfter };
  }
  hits.push(now);
  imageHits.set(userId, hits);
  return { ok: true };
}

export const ALLOWED_IMAGE_SIZES = new Set(["1024x1024", "1536x1024", "1024x1536"]);
