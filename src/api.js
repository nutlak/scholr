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
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to create notebook");
    }
    const nb = await res.json();
    return shapeNotebook(nb, displayName);
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

  async createClass(title) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/classes`, {
      method: "POST", headers, body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to create class");
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
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Failed to create unit");
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

  async query(notebookId, question) {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/notebooks/${notebookId}/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({ question }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
    return data;
  },
};
