import { supabase } from "./supabase.js";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

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
      const err = new Error(data.message ?? data.error ?? "Failed to generate");
      err.code = data.error;
      err.status = res.status;
      throw err;
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
      const err = new Error(data.message ?? data.error ?? `Request failed (${res.status})`);
      err.code = data.error;
      err.status = res.status;
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

  // ── Due date / Status ───────────────────────────────────────────────
  async updateDueDate(notebookId, dueDate) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/due-date`, {
      method: "PATCH", headers, body: JSON.stringify({ due_date: dueDate }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to update due date");
    }
    return res.json();
  },

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
      messagesUsed: 0, messagesLimit: 30,
      forgeUsed: 0, forgeLimit: 3,
      notebooksUsed: 0, notebooksLimit: 15,
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
};
