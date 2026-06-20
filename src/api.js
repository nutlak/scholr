import { supabase } from "./supabase.js";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

// Build an Error from a failed response. 429s (global or per-feature rate limit)
// always get a friendly "slow down" message so the UI never shows a raw error.
function apiError(res, data, fallback) {
  const isRateLimited = res.status === 429;
  const message = isRateLimited
    ? (data?.message ?? "You're going too fast — please wait a moment and try again.")
    : (data?.message ?? data?.error ?? fallback);
  const err = new Error(message);
  err.code = isRateLimited ? (data?.error ?? "rate_limited") : data?.error;
  err.status = res.status;
  return err;
}

async function authHeaders(extra = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token ?? ""}`,
    ...extra,
  };
}

const COLORS = ["#A78BFA", "#60A5FA", "#34D399", "#F472B6", "#FBBF24", "#F97316"];

function shapeNotebook(nb, displayName) {
  return {
    ...nb,
    notes: nb.notes_count ?? 0,
    color: COLORS[nb.id?.charCodeAt(0) % COLORS.length ?? 0] ?? COLORS[0],
    contributors: [displayName ?? "You"],
    updated: nb.created_at
      ? new Date(nb.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "Today",
    due_date: nb.due_date ?? null,
    status: nb.status ?? "in_progress",
    class_id: nb.class_id ?? null,
  };
}

export const api = {
  async listNotebooks(displayName) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks`, { headers });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.map(nb => shapeNotebook(nb, displayName));
  },

  async listOwnedNotebooks(displayName) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/owned`, { headers });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.map(nb => shapeNotebook(nb, displayName));
  },

  async listSharedNotebooks(displayName) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/shared`, { headers });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.map(nb => shapeNotebook(nb, displayName));
  },

  async createNotebook(title, topic, displayName) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title, topic }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      const err = new Error(data.message ?? data.error ?? "Failed to create notebook");
      err.code = data.error;
      err.status = res.status;
      throw err;
    }
    const nb = await res.json();
    return shapeNotebook(nb, displayName);
  },

  async signOut() {
    // Tell the server first, then clear the local Supabase session
    const headers = await authHeaders();
    await fetch(`${API_URL}/api/auth/sign-out`, { method: "POST", headers }).catch(() => {});
    await supabase.auth.signOut();
  },

  async deleteAccount() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/auth/delete-account`, {
      method: "DELETE",
      headers,
    });
    if (res.status !== 204) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to delete account");
    }
  },

  async deleteNotebook(notebookId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}`, {
      method: "DELETE",
      headers,
    });
    if (res.status !== 204) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to delete notebook");
    }
  },

  async listClasses() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/classes`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createClass(title, color) {
    const headers = await authHeaders();
    const body = color ? { title, color } : { title };
    const res = await fetch(`${API_URL}/api/classes`, {
      method: "POST", headers, body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      const err = new Error(data.message ?? data.error ?? "Failed to create class");
      err.code = data.error;
      err.status = res.status;
      throw err;
    }
    return res.json();
  },

  async updateClassColor(classId, color) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/classes/${classId}/color`, {
      method: "PATCH", headers, body: JSON.stringify({ color }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to update color");
    }
    return res.json();
  },

  async reorderClasses(classIds) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/classes/reorder`, {
      method: "PUT", headers, body: JSON.stringify({ classIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to reorder classes");
    }
    return res.json();
  },

  async deleteClass(classId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/classes/${classId}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to delete class");
    }
    return res.json(); // { success: true, message: "Class deleted" }
  },

  async listClassNotebooks(classId, displayName) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/classes/${classId}/notebooks`, { headers });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.map(nb => shapeNotebook({ ...nb, role: "owner" }, displayName));
  },

  async createClassNotebook(classId, title, topic, displayName) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/classes/${classId}/notebooks`, {
      method: "POST", headers, body: JSON.stringify({ title, topic }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      const err = new Error(data.message ?? data.error ?? "Failed to create unit");
      err.code = data.error;
      err.status = res.status;
      throw err;
    }
    const nb = await res.json();
    return shapeNotebook({ ...nb, role: "owner" }, displayName);
  },

  async createInvite(notebookId, email) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/invites`, {
      method: "POST", headers, body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to send invite");
    }
    return res.json(); // { success: true }
  },

  async getInvite(token) {
    const res = await fetch(`${API_URL}/api/invite/${token}`);
    if (!res.ok) throw new Error("Invalid invite link");
    return res.json(); // { notebook_id, notebook_title, class_title }
  },

  async acceptInvite(token) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/invite/${token}/accept`, {
      method: "POST", headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to accept invite");
    }
    return res.json(); // { notebook_id, title }
  },

  async listMembers(notebookId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/members`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // [{ user_id, role, email }]
  },

  async listNotes(notebookId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/notes`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async uploadNote(notebookId, { title, content, file }) {
    const { data: { session } } = await supabase.auth.getSession();
    const form = new FormData();
    if (title)   form.append("title",   title);
    if (content) form.append("content", content);
    if (file)    form.append("file",    file);

    // Do NOT set Content-Type — browser sets it with the correct multipart boundary
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/notes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to upload note");
    }
    return res.json();
  },

  async getNotifications() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notifications`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // [{ id, is_read, created_at, activities: { action, description, created_at, notebooks: { title } } }]
  },

  async clearAllNotifications() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notifications/clear-all`, { method: "PATCH", headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { cleared: N }
  },

  async getStarredNotebooks(displayName) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/starred`, { headers });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.map(nb => shapeNotebook(nb, displayName));
  },

  async toggleStar(notebookId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/star`, {
      method: "POST", headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to toggle star");
    }
    return res.json(); // { starred: true/false }
  },

  async getMessages(notebookId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/messages`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // [{ id, role, content, created_at, created_by }]
  },

  async addMessage(notebookId, role, content) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ role, content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to save message");
    }
    return res.json(); // { id, role, content, created_at, created_by }
  },

  async forge(notebookId, action, topic, onChunk, onDone, onError) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/forge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ action, topic }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      throw apiError(res, data, "Failed to generate");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) { onError?.(data.error); return; }
            if (data.done) { onDone?.(); return; }
            if (data.text) onChunk?.(data.text);
          } catch { /* skip malformed */ }
        }
      }
    }
    onDone?.();
  },

  async saveForgeOutput(notebookId, type, content, topic) {
    console.log("saveForgeOutput API called:", { notebookId, type, contentLength: content?.length });
    const headers = await authHeaders();
    // Send the date label formatted in the user's local timezone so the title
    // reflects the user's actual local date (not the server's UTC date).
    const dateLabel = new Date().toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/forge-output`, {
      method: "POST", headers, body: JSON.stringify({ type, content, topic, dateLabel }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      console.error("saveForgeOutput API error:", err);
      throw new Error(err.error ?? "Failed to save");
    }
    return res.json();
  },

  async listForgeOutputs(notebookId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/forge-outputs`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteForgeOutput(outputId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/forge-outputs/${outputId}`, {
      method: "DELETE", headers,
    });
    if (res.status !== 204) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to delete");
    }
  },

  async query(notebookId, question) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({ question }),
    });

    const data = await res.json();
    if (!res.ok) {
      const err = apiError(res, data, `Request failed (${res.status})`);
      throw err;
    }
    return data;
  },

  async getUnitNotes(notebookId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/unit-notes`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to load notes");
    }
    return res.json();
  },

  async addUnitNote(notebookId, content) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/unit-notes`, {
      method: "POST", headers, body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to add note");
    }
    return res.json();
  },

  async deleteUnitNote(noteId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/unit-notes/${noteId}`, {
      method: "DELETE", headers,
    });
    if (res.status !== 204) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to delete note");
    }
  },

  // ── Activity heatmap ────────────────────────────────────────────────
  async getActivityHeatmap() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/user/activity-heatmap`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // [{ date, count }]
  },

  // ── Track daily visit (idempotent per (user, date)) ─────────────────
  // Pass today's local YYYY-MM-DD so the server records the user's calendar
  // day, not the server's UTC day. Fire-and-forget on the client; safe to
  // call multiple times (server no-ops if a row already exists).
  async trackVisit(dateLabel) {
    const headers = await authHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`${API_URL}/api/user/track-visit`, {
      method: "POST", headers, body: JSON.stringify({ dateLabel }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { tracked: true }
  },

  // ── Reactions ───────────────────────────────────────────────────────
  async addReaction(unitNoteId, emoji) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/unit-notes/${unitNoteId}/react`, {
      method: "POST", headers, body: JSON.stringify({ emoji }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to react");
    }
    return res.json();
  },

  async removeReaction(unitNoteId, emoji) {
    const headers = await authHeaders();
    const res = await fetch(
      `${API_URL}/api/unit-notes/${unitNoteId}/react/${encodeURIComponent(emoji)}`,
      { method: "DELETE", headers }
    );
    if (res.status !== 204) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to remove reaction");
    }
  },

  async getNoteReactions(unitNoteId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/unit-notes/${unitNoteId}/reactions`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // ── Comments ────────────────────────────────────────────────────────
  async addNoteComment(unitNoteId, content) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/unit-notes/${unitNoteId}/comments`, {
      method: "POST", headers, body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to add comment");
    }
    return res.json();
  },

  async getNoteComments(unitNoteId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/unit-notes/${unitNoteId}/comments`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteNoteComment(commentId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/note-comments/${commentId}`, {
      method: "DELETE", headers,
    });
    if (res.status !== 204) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to delete comment");
    }
  },

  // ── Status ─────────────────────────────────────────────────────────
  async updateNotebookStatus(notebookId, status) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/status`, {
      method: "PATCH", headers, body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to update status");
    }
    return res.json();
  },

  // ── Explain Differently ─────────────────────────────────────────────
  async explainDifferently(notebookId, messageId, level) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/explain-differently`, {
      method: "POST", headers, body: JSON.stringify({ messageId, level }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
    return data;
  },

  // ── Subscription & billing ──────────────────────────────────────────
  async getSubscription() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/user/subscription`, { headers });
    if (!res.ok) return {
      tier: "free",
      messagesUsed: 0, messagesLimit: 100,
      forgeUsed: 0, forgeLimit: 3,
      notebooksUsed: 0, notebooksLimit: 3,
    };
    return res.json();
  },

  async createCheckoutSession() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/create-checkout-session`, { method: "POST", headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to start checkout");
    }
    const { url } = await res.json();
    window.location.href = url;
  },

  async createPortalSession() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/create-portal-session`, { method: "POST", headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to open billing portal");
    }
    const { url } = await res.json();
    window.location.href = url;
  },

  // ── Podcast Mode ─────────────────────────────────────────────────────
  // Kicks off generation. Server responds immediately with { podcastId };
  // poll getPodcast(id) every few seconds until status flips to ready/failed.
  async generatePodcast(notebookId, opts) {
    const headers = await authHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/podcast/generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        lengthPreset: opts?.lengthPreset ?? "standard",
        formatPreset: opts?.formatPreset ?? "casual",
        focusTopic: opts?.focusTopic ?? null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw apiError(res, data, "Failed to start podcast");
    }
    return res.json(); // { podcastId }
  },

  async getPodcasts(notebookId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/podcasts`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getPodcast(podcastId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/podcasts/${podcastId}`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Feynman Mode — grade a plain-language explanation of a concept.
  // Returns { score, verdict, nailed[], gaps[], misconceptions[], followup }.
  async feynman({ concept, explanation }) {
    const headers = await authHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`${API_URL}/api/feynman`, {
      method: "POST", headers,
      body: JSON.stringify({ concept, explanation }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.message ?? data.error ?? "Failed to grade your explanation.");
      err.code = data.error;
      throw err;
    }
    return res.json();
  },

  // Terms gate — has the user accepted the current Terms/Privacy? (existing-user wall)
  async getTermsStatus() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/user/terms-status`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { accepted: boolean }
  },

  async acceptTerms() {
    const headers = await authHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`${API_URL}/api/user/accept-terms`, {
      method: "POST", headers,
      body: JSON.stringify({ termsAccepted: true }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.message ?? data.error ?? "Failed to record acceptance.");
      err.code = data.error;
      throw err;
    }
    return res.json();
  },

  // Record which limit triggered an upgrade prompt (fire-and-forget).
  async recordUpgradeTrigger(trigger) {
    try {
      const headers = await authHeaders({ "Content-Type": "application/json" });
      await fetch(`${API_URL}/api/user/upgrade-trigger`, {
        method: "POST", headers, body: JSON.stringify({ trigger }),
      });
    } catch { /* analytics only — never block the UI */ }
  },

  // ── Profile flags (onboarding + streak) ─────────────────────────────────
  async getProfile() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/user/profile`, { headers });
    if (!res.ok) return { onboarding_completed: true, longest_streak: 0, streak_milestones_shown: [], referral_months_earned: 0 };
    return res.json();
  },

  async completeOnboarding() {
    const headers = await authHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`${API_URL}/api/user/complete-onboarding`, { method: "POST", headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // First-login: seed a "Welcome to Scholr" notebook + demo note (idempotent).
  async seedWelcome() {
    const headers = await authHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`${API_URL}/api/user/seed-welcome`, { method: "POST", headers });
    if (!res.ok) return { seeded: false };
    return res.json(); // { seeded, notebookId }
  },

  async updateStreak(current) {
    const headers = await authHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`${API_URL}/api/user/streak`, {
      method: "POST", headers, body: JSON.stringify({ current }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { longest_streak }
  },

  async recordStreakMilestone(day) {
    const headers = await authHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`${API_URL}/api/user/streak-milestone`, {
      method: "POST", headers, body: JSON.stringify({ day }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { streak_milestones_shown }
  },

  // ── Referrals ───────────────────────────────────────────────────────────
  async getReferralStats() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/referral/stats`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { referralLink, invited, signedUp, monthsEarned }
  },

  async sendReferralInvite(referredEmail) {
    const headers = await authHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`${API_URL}/api/referral/invite`, {
      method: "POST", headers, body: JSON.stringify({ referredEmail }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to send invite");
    }
    return res.json(); // { success: true }
  },

  // ── Public notebook sharing ─────────────────────────────────────────────
  async shareNotebook(notebookId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/share`, { method: "POST", headers });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed to share"); }
    return res.json(); // { slug, shareUrl }
  },

  async unshareNotebook(notebookId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/share`, { method: "DELETE", headers });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed to stop sharing"); }
    return res.json();
  },

  // PUBLIC — no auth header sent.
  async getSharedNotebook(slug) {
    const res = await fetch(`${API_URL}/api/share/${slug}`);
    if (!res.ok) throw new Error("not_found");
    return res.json(); // { title, topic, ownerName, notes }
  },

  // ── Class templates ─────────────────────────────────────────────────────
  async applyTemplate(classId, notebooks) {
    const headers = await authHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`${API_URL}/api/classes/${classId}/apply-template`, {
      method: "POST", headers, body: JSON.stringify({ notebooks }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed to set up class"); }
    return res.json(); // { success, firstNotebookId, created, limitHit }
  },

  async getNotebookImages(notebookId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/images`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to load saved images");
    }
    return res.json(); // [{ url, created_at }]
  },

  async saveImageToNotebook(notebookId, b64) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/images`, {
      method: "POST", headers,
      body: JSON.stringify({ image: b64 }),
    });
    const data = await res.json().catch(() => ({ error: res.statusText }));
    if (!res.ok) {
      const err = new Error(data.error ?? `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data; // { url }
  },

  async generateImage({ prompt, size = "1024x1024", n = 1 }) {
    const headers = await authHeaders();
    // 90s client-side timeout: image generation can legitimately take 30–60s,
    // but anything past 90s is almost certainly a stalled server/upstream and
    // shouldn't leave the UI spinning forever.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000);
    let res;
    try {
      res = await fetch(`${API_URL}/api/generate-image`, {
        method: "POST", headers,
        body: JSON.stringify({ prompt, size, n }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === "AbortError") {
        const err = new Error("Request timed out after 90s. The server may be down or the OpenAI API is slow.");
        err.status = 0;
        throw err;
      }
      const err = new Error(e.message || "Network error reaching the image server.");
      err.status = 0;
      throw err;
    }
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({ error: res.statusText }));
    if (!res.ok) {
      // apiError surfaces the friendly `message` and exposes `code` so the UI can
      // branch on image_limit_reached / rate_limited like other gated features.
      throw apiError(res, data, `Request failed (${res.status})`);
    }
    return data; // { images: [{ b64_json }] }
  },

  // ── Username ───────────────────────────────────────────────────────
  async getMyUsername() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/me/username`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { username: string | null }
  },

  async setMyUsername(username) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/me/username`, {
      method: "POST", headers,
      body: JSON.stringify({ username }),
    });
    const data = await res.json().catch(() => ({ error: res.statusText }));
    if (!res.ok) {
      const err = new Error(data.error ?? "Failed to set username");
      err.status = res.status; // 409 = taken, 400 = invalid/reserved
      throw err;
    }
    return data; // { username }
  },

  // ── Social notifications (friend requests / accepts / notebook invites) ──
  // Named *Social* to avoid colliding with the existing activity-based
  // getNotifications()/clearAllNotifications() above.
  async getSocialNotifications() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/social/notifications`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { notifications: [{ id, type, payload, read, created_at }], unreadCount }
  },

  async markSocialNotificationsRead(ids) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/social/notifications/read`, {
      method: "POST", headers,
      body: JSON.stringify({ ids: ids ?? [] }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { ok: true }
  },

  // Mark every unread social notification as read (empty ids = all, server-side).
  async markAllSocialNotificationsRead() {
    return this.markSocialNotificationsRead([]);
  },

  // Clear inbox — permanently DELETE all of the current user's notifications.
  async clearSocialNotifications() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/social/notifications`, { method: "DELETE", headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { ok: true }
  },

  // ── Friends system ─────────────────────────────────────────────────
  async requestFriend(toUserId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/friends/request`, {
      method: "POST", headers,
      body: JSON.stringify({ toUserId }),
    });
    const data = await res.json().catch(() => ({ error: res.statusText }));
    if (!res.ok) {
      const err = new Error(data.error ?? "Failed to send friend request");
      err.status = res.status;
      throw err;
    }
    return data; // { status: 'pending'|'accepted'|'already_friends', requestId? }
  },

  async respondToFriend(requestId, action) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/friends/respond`, {
      method: "POST", headers,
      body: JSON.stringify({ requestId, action }),
    });
    const data = await res.json().catch(() => ({ error: res.statusText }));
    if (!res.ok) {
      // Prefer the friendly message; expose code so the UI can detect
      // already_actioned (409) and show "Already handled" rather than failing.
      const err = new Error(data.message ?? data.error ?? "Failed to respond to friend request");
      err.code = data.error;       // e.g. "already_actioned"
      err.status = res.status;
      throw err;
    }
    return data; // { status: 'accepted'|'declined' }
  },

  async getFriends() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/friends`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // [{ userId, name, username, isOnline, lastActive }]
  },

  async getFriendRequests() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/friends/requests`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // [{ requestId, fromUserId, fromName, fromUsername, created_at }]
  },

  async getOutgoingRequests() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/friends/requests/outgoing`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // [{ requestId, toUserId, toName, toUsername, created_at }]
  },

  async cancelFriendRequest(requestId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/friends/request/${requestId}`, { method: "DELETE", headers });
    if (res.status !== 204) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to cancel request");
    }
  },

  async removeFriend(friendUserId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/friends/${friendUserId}`, { method: "DELETE", headers });
    if (res.status !== 204) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to remove friend");
    }
  },

  async blockUser(userId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/friends/block`, {
      method: "POST", headers, body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to block user");
    }
    return res.json(); // { ok: true }
  },

  async unblockUser(userId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/friends/unblock`, {
      method: "POST", headers, body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to unblock user");
    }
    return res.json(); // { ok: true }
  },

  async getBlockedUsers() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/friends/blocked`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // [{ userId, username, name }]
  },

  async sendHeartbeat() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/me/heartbeat`, { method: "POST", headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { ok: true }
  },

  async getBestFriends() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/friends/best`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // [{ userId, name, username, activityCount }]
  },

  async inviteFriendToNotebook(notebookId, friendUserId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/invite-friend`, {
      method: "POST", headers,
      body: JSON.stringify({ friendUserId }),
    });
    const data = await res.json().catch(() => ({ error: res.statusText }));
    if (!res.ok) {
      const err = new Error(data.error ?? "Failed to invite friend");
      err.status = res.status;
      throw err;
    }
    return data; // { success: true }
  },

  async searchUsers(q) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/friends/search?q=${encodeURIComponent(q)}`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // [{ userId, username, name }] — username prefix match, no email
  },

  // ── Flashcards (spaced repetition) ──────────────────────────────────
  async generateFlashcards(notebookId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/flashcards/generate`, {
      method: "POST", headers,
    });
    const data = await res.json().catch(() => ({ error: res.statusText }));
    if (!res.ok) {
      throw apiError(res, data, "Failed to generate flashcards"); // code e.g. "forge_limit_reached" / "rate_limited"
    }
    return data; // { cards: [...] }
  },

  async getFlashcards(notebookId) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/flashcards`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // [{ id, front, back, due_date, ... }]
  },

  async getDueFlashcards(notebookId) {
    const headers = await authHeaders();
    const qs = notebookId ? `?notebookId=${encodeURIComponent(notebookId)}` : "";
    const res = await fetch(`${API_URL}/api/flashcards/due${qs}`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { cards: [{ ..., notebookTitle }], total }
  },

  async getDueCount() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/flashcards/due/count`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { count }
  },

  async reviewFlashcard(id, quality) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/flashcards/${id}/review`, {
      method: "POST", headers, body: JSON.stringify({ quality }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to record review");
    }
    return res.json(); // updated card
  },

  async updateFlashcard(id, { front, back }) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/flashcards/${id}`, {
      method: "PATCH", headers, body: JSON.stringify({ front, back }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to update card");
    }
    return res.json();
  },

  async deleteFlashcard(id) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/flashcards/${id}`, { method: "DELETE", headers });
    if (res.status !== 204) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to delete card");
    }
  },
};
