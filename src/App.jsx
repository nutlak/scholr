import { useState, useEffect, useRef } from "react";
import { api } from "./api.js";
import { supabase } from "./supabase.js";
import AuthModal from "./AuthModal.jsx";
import NewNotebookModal from "./NewNotebookModal.jsx";
import UploadNotesModal from "./UploadNotesModal.jsx";
import "./App.css";

const recentActivity = [];

const avatarColors = ["#A78BFA", "#A78BFA", "#34D399", "#F472B6", "#FBBF24"];

function Avatar({ name, size = 28 }) {
  const idx = name.charCodeAt(0) % avatarColors.length;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: avatarColors[idx],
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 700, color: "#0A0A0F",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      flexShrink: 0,
      border: "2px solid #13131A"
    }}>
      {name[0].toUpperCase()}
    </div>
  );
}

function AvatarStack({ names }) {
  return (
    <div style={{ display: "flex", marginLeft: 4 }}>
      {names.slice(0, 3).map((n, i) => (
        <div key={n} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: names.length - i }}>
          <Avatar name={n} size={24} />
        </div>
      ))}
      {names.length > 3 && (
        <div style={{
          marginLeft: -8, width: 24, height: 24, borderRadius: "50%",
          background: "#2A2A38", border: "2px solid #13131A",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, color: "#9090A8", fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>+{names.length - 3}</div>
      )}
    </div>
  );
}

function NotebookCard({ nb, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#16161F" : "#111118",
        border: `1px solid ${hovered ? nb.color + "55" : "#1E1E2A"}`,
        borderRadius: 16,
        padding: "20px 22px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: nb.color, borderRadius: "16px 16px 0 0",
        opacity: hovered ? 1 : 0.5, transition: "opacity 0.2s"
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
          color: nb.color, textTransform: "uppercase",
          fontFamily: "'DM Mono', monospace"
        }}>{nb.notes} notes</div>
        <div style={{ fontSize: 11, color: "#4A4A60", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{nb.updated}</div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif", marginBottom: 4, lineHeight: 1.3 }}>
        {nb.title}
      </div>
      <div style={{ fontSize: 12, color: "#6060A0", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 16 }}>
        {nb.topic}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <AvatarStack names={nb.contributors} />
          <span style={{ fontSize: 11, color: "#4A4A60", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {nb.contributors.length} collaborators
          </span>
        </div>
        <div style={{
          fontSize: 11, color: nb.color, fontFamily: "'DM Mono', monospace",
          opacity: hovered ? 1 : 0, transition: "opacity 0.2s"
        }}>Open →</div>
      </div>
    </div>
  );
}

const MEMBER_COLORS = ["#A78BFA", "#7C3AED", "#6D28D9", "#8B5CF6", "#C4B5FD"];

function memberColor(email) {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  return MEMBER_COLORS[h % MEMBER_COLORS.length];
}

function MemberAvatarStack({ members }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const visible = members.slice(0, 3);
  const overflow = members.length - 3;

  return (
    <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
      {visible.map((m, i) => (
        <div
          key={m.user_id}
          onMouseEnter={() => setHoveredIdx(i)}
          onMouseLeave={() => setHoveredIdx(null)}
          style={{
            position: "relative",
            marginLeft: i === 0 ? 0 : -10,
            zIndex: visible.length - i,
            cursor: "default",
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: memberColor(m.email),
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#0A0A0F",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            border: "2px solid #13131A",
            userSelect: "none",
          }}>
            {m.email[0].toUpperCase()}
          </div>
          {hoveredIdx === i && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
              transform: "translateX(-50%)",
              background: "#1A1A28", border: "1px solid #2A2A38",
              borderRadius: 8, padding: "6px 10px",
              fontSize: 11, color: "#D0D0E8",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              whiteSpace: "nowrap", zIndex: 100,
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}>
              <div style={{ fontWeight: 600 }}>{m.email}</div>
              <div style={{ color: m.role === "owner" ? "#A78BFA" : "#6060A0", fontSize: 10, marginTop: 2, textTransform: "capitalize" }}>
                {m.role === "owner" ? "Owner" : "Member"}
              </div>
            </div>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div style={{
          marginLeft: -10, width: 32, height: 32, borderRadius: "50%",
          background: "#2A2A38", border: "2px solid #13131A",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, color: "#9090A8", fontFamily: "'Plus Jakarta Sans', sans-serif",
          zIndex: 0,
        }}>+{overflow}</div>
      )}
    </div>
  );
}

function NotebookView({ nb, onBack, onDeleted }) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", text: `Hey! I've read all the notes in this notebook. Ask me anything about ${nb.title}.` }
  ]);
  const [loading, setLoading]       = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [members, setMembers]       = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    api.listMembers(nb.id).then(setMembers).catch(() => {});
  }, [nb.id]);

  function handleNoteUploaded(note) {
    setMessages(m => [...m, {
      role: "assistant",
      text: `📎 "${note.title}" was added to this notebook. I'll include it in future answers.`,
    }]);
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteNotebook(nb.id);
      onDeleted(nb.id);
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  }

  // Fetch existing notes on open and surface them in the chat
  useEffect(() => {
    api.listNotes(nb.id).then(notes => {
      if (notes.length === 0) return;
      const list = notes.map(n => `• ${n.title}`).join("\n");
      setMessages(m => [...m, {
        role: "assistant",
        text: `📚 ${notes.length} note${notes.length !== 1 ? "s" : ""} in this notebook:\n${list}\n\nAsk me anything about them!`,
      }]);
    }).catch(err => {
      setMessages(m => [...m, {
        role: "assistant",
        text: `⚠️ Could not load existing notes: ${err.message}`,
        isError: true,
      }]);
    });
  }, [nb.id]);

  // Scroll to latest message whenever messages or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function ask() {
    const text = query.trim();
    if (!text || loading) return;

    setMessages(m => [...m, { role: "user", text }]);
    setQuery("");
    setLoading(true);

    try {
      const data = await api.query(nb.id, text);
      if (data.error) throw new Error(data.error);
      setMessages(m => [...m, { role: "assistant", text: data.answer }]);
    } catch (err) {
      setMessages(m => [...m, {
        role: "assistant",
        text: `Sorry, something went wrong: ${err.message}`,
        isError: true,
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      {showUpload && (
        <UploadNotesModal
          notebookId={nb.id}
          accentColor={nb.color}
          onClose={() => setShowUpload(false)}
          onUploaded={handleNoteUploaded}
        />
      )}

      {showInvite && (
        <InviteModal notebookId={nb.id} onClose={() => setShowInvite(false)} />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(10,10,15,0.78)",
          backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000, padding: 16,
        }}>
          <div style={{
            background: "#111118", border: "1px solid #2A2A38",
            borderRadius: 20, width: "100%", maxWidth: 380,
            padding: "32px 28px", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            animation: "fadeIn 0.2s ease",
          }}>
            <div style={{ fontSize: 28, marginBottom: 12, textAlign: "center" }}>🗑️</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif", textAlign: "center", marginBottom: 8 }}>
              Delete this notebook?
            </div>
            <div style={{ fontSize: 13, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "center", marginBottom: 24, lineHeight: 1.6 }}>
              <strong style={{ color: "#D0D0E8" }}>{nb.title}</strong> and all its notes will be permanently deleted. This can't be undone.
            </div>
            {deleteError && (
              <div style={{
                background: "#2A1A1A", border: "1px solid #5A2020", borderRadius: 8,
                padding: "10px 12px", marginBottom: 16,
                fontSize: 12, color: "#F87171", fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>{deleteError}</div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setConfirmDelete(false); setDeleteError(""); }}
                disabled={deleting}
                style={{
                  flex: 1, background: "transparent", border: "1px solid #2A2A38",
                  borderRadius: 10, padding: "11px", color: "#505070",
                  fontSize: 13, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
                  opacity: deleting ? 0.5 : 1,
                }}
              >Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1, background: "#7F1D1D", border: "1px solid #991B1B",
                  borderRadius: 10, padding: "11px", color: "#FCA5A5",
                  fontWeight: 700, fontSize: 13, cursor: deleting ? "not-allowed" : "pointer",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  opacity: deleting ? 0.7 : 1, transition: "opacity 0.15s",
                }}
              >{deleting ? "Deleting…" : "Yes, delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          background: "#1A1A24", border: "1px solid #2A2A38", color: "#9090A8",
          borderRadius: 8, padding: "6px 12px", cursor: "pointer",
          fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12
        }}>← Back</button>
        <button
          onClick={() => setConfirmDelete(true)}
          title="Delete notebook"
          style={{
            background: "transparent", border: "1px solid #3A1A1A", color: "#7F3030",
            borderRadius: 8, padding: "6px 10px", cursor: "pointer",
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#2A1010"; e.currentTarget.style.borderColor = "#991B1B"; e.currentTarget.style.color = "#FCA5A5"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#3A1A1A"; e.currentTarget.style.color = "#7F3030"; }}
        >🗑</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif" }}>{nb.title}</div>
          <div style={{ fontSize: 12, color: "#6060A0", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{nb.topic}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setShowUpload(true)}
            style={{
              background: "transparent", border: `1px solid ${nb.color}44`,
              borderRadius: 8, padding: "6px 12px", cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12,
              color: nb.color, fontWeight: 600, transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = nb.color + "18"; e.currentTarget.style.borderColor = nb.color + "88"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = nb.color + "44"; }}
          >+ Upload notes</button>
          <button
            onClick={() => setShowInvite(true)}
            title="Invite others to this unit"
            style={{
              background: "transparent", border: `1px solid ${nb.color}44`,
              borderRadius: 8, padding: "6px 12px", cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12,
              color: nb.color, fontWeight: 600, transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = nb.color + "18"; e.currentTarget.style.borderColor = nb.color + "88"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = nb.color + "44"; }}
          >🔗 Invite</button>
          {members.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#1A1A24", border: "1px solid #2A2A38",
              borderRadius: 8, padding: "6px 10px"
            }}>
              <MemberAvatarStack members={members} />
            </div>
          )}
        </div>
      </div>

      {/* Message list */}
      <div style={{
        flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
        gap: 12, marginBottom: 16, paddingRight: 4
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "75%",
              background: m.isError ? "#2A1A1A" : m.role === "user" ? "#A78BFA" : "#1A1A28",
              color: m.isError ? "#F87171" : m.role === "user" ? "#0A0A0F" : "#D0D0E8",
              borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              padding: "10px 14px",
              fontSize: 13, lineHeight: 1.6,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              border: m.role === "assistant" ? `1px solid ${m.isError ? "#5A2020" : "#2A2A38"}` : "none",
              whiteSpace: "pre-wrap",
            }}>
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex" }}>
            <div style={{
              background: "#1A1A28", border: "1px solid #2A2A38",
              borderRadius: "16px 16px 16px 4px", padding: "10px 16px",
              display: "flex", gap: 4, alignItems: "center"
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%", background: "#4A4A70",
                  animation: `pulse 1s ease-in-out ${i * 0.2}s infinite`
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && ask()}
          placeholder={`Ask anything about ${nb.title}…`}
          disabled={loading}
          style={{
            flex: 1, background: "#111118", border: "1px solid #2A2A38",
            borderRadius: 12, padding: "12px 16px",
            color: "#E8E8F0", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif",
            outline: "none", transition: "opacity 0.15s",
          }}
        />
        <button
          onClick={ask}
          disabled={loading || !query.trim()}
          style={{
            background: nb.color, border: "none", borderRadius: 12,
            padding: "12px 18px", fontSize: 16, fontWeight: 700,
            color: "#0A0A0F", transition: "opacity 0.15s",
            cursor: loading || !query.trim() ? "not-allowed" : "pointer",
            opacity: loading || !query.trim() ? 0.45 : 1,
          }}
        >
          {loading ? "…" : "↑"}
        </button>
      </div>
    </div>
  );
}

function PasswordResetModal({ onDone }) {
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }
    setError("");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      onDone();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  const inputBase = {
    width: "100%", background: "#0D0D14", border: "1px solid #2A2A38",
    borderRadius: 10, padding: "12px 14px", color: "#E8E8F0", fontSize: 13,
    fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", transition: "border-color 0.15s",
  };
  const label = {
    fontSize: 11, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif",
    letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(10,10,15,0.88)",
      backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#111118", border: "1px solid #2A2A38",
        borderRadius: 20, width: "100%", maxWidth: 420,
        padding: "36px 32px", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        animation: "fadeIn 0.25s ease",
      }}>
        <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 28, fontWeight: 900, color: "#E8E8F0", marginBottom: 6, letterSpacing: "-0.02em", textAlign: "center" }}>
          schol<span style={{ color: "#A78BFA" }}>r</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif", marginBottom: 6, marginTop: 20 }}>
          Set a new password
        </div>
        <div style={{ fontSize: 12, color: "#505070", marginBottom: 24, fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.6 }}>
          Choose a strong password for your account.
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={label}>New password</label>
            <input
              type="password" required autoFocus
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Min 6 characters" style={inputBase}
              onFocus={e => e.target.style.borderColor = "#A78BFA"}
              onBlur={e => e.target.style.borderColor = "#2A2A38"}
            />
          </div>
          <div>
            <label style={label}>Confirm password</label>
            <input
              type="password" required
              value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Same password again" style={inputBase}
              onFocus={e => e.target.style.borderColor = "#A78BFA"}
              onBlur={e => e.target.style.borderColor = "#2A2A38"}
            />
          </div>
          {error && (
            <div style={{
              background: "#2A1A1A", border: "1px solid #5A2020", borderRadius: 8,
              padding: "10px 12px", fontSize: 12, color: "#F87171",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>{error}</div>
          )}
          <button type="submit" disabled={loading} style={{
            width: "100%", background: "#A78BFA", border: "none", borderRadius: 10,
            padding: "12px", color: "#0A0A0F", fontWeight: 700, fontSize: 14,
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            opacity: loading ? 0.6 : 1, marginTop: 4, transition: "opacity 0.15s",
          }}>
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}

function DeleteAccountModal({ onClose, onConfirm }) {
  const [typed, setTyped]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const confirmed = typed === "DELETE";

  async function handleConfirm(e) {
    e.preventDefault();
    if (!confirmed) return;
    setLoading(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(10,10,15,0.82)",
      backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#111118", border: "1px solid #3A1A1A",
        borderRadius: 20, width: "100%", maxWidth: 400,
        padding: "32px 28px", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        animation: "fadeIn 0.2s ease",
      }}>
        <div style={{ fontSize: 28, textAlign: "center", marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif", textAlign: "center", marginBottom: 8 }}>
          Delete your account?
        </div>
        <div style={{ fontSize: 13, color: "#604040", fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "center", marginBottom: 24, lineHeight: 1.6 }}>
          All your notebooks, notes, and data will be <strong style={{ color: "#F87171" }}>permanently deleted</strong>. This cannot be undone.
        </div>

        <form onSubmit={handleConfirm} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{
              fontSize: 11, color: "#604040", fontFamily: "'Plus Jakarta Sans', sans-serif",
              letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8,
            }}>
              Type <strong style={{ color: "#F87171", letterSpacing: "0.1em" }}>DELETE</strong> to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder="DELETE"
              autoFocus
              spellCheck={false}
              style={{
                width: "100%", background: "#0D0D14",
                border: `1px solid ${confirmed ? "#991B1B" : "#2A2A38"}`,
                borderRadius: 10, padding: "11px 13px",
                color: confirmed ? "#FCA5A5" : "#E8E8F0",
                fontSize: 13, fontFamily: "'DM Mono', monospace",
                outline: "none", transition: "border-color 0.15s, color 0.15s",
                letterSpacing: "0.08em",
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "#2A1A1A", border: "1px solid #5A2020",
              borderRadius: 8, padding: "10px 12px",
              fontSize: 12, color: "#F87171",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1, background: "transparent", border: "1px solid #2A2A38",
                borderRadius: 10, padding: "11px", color: "#505070",
                fontSize: 13, cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                opacity: loading ? 0.5 : 1,
              }}
            >Cancel</button>
            <button
              type="submit"
              disabled={!confirmed || loading}
              style={{
                flex: 1, background: confirmed ? "#7F1D1D" : "#1A1A1A",
                border: `1px solid ${confirmed ? "#991B1B" : "#2A2A38"}`,
                borderRadius: 10, padding: "11px",
                color: confirmed ? "#FCA5A5" : "#404040",
                fontWeight: 700, fontSize: 13,
                cursor: confirmed && !loading ? "pointer" : "not-allowed",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: "all 0.2s",
              }}
            >{loading ? "Deleting…" : "Delete account"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UnitRow({ unit, color, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", borderRadius: 10,
        background: hovered ? "#1A1A28" : "#0D0D14",
        border: `1px solid ${hovered ? color + "44" : "#1A1A24"}`,
        cursor: "pointer", transition: "all 0.15s",
      }}
    >
      <div style={{ fontSize: 14 }}>📓</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#E8E8F0", fontFamily: "'Plus Jakarta Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {unit.title}
        </div>
        {unit.topic && (
          <div style={{ fontSize: 11, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{unit.topic}</div>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#404060", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
        {unit.notes} notes
      </div>
      {hovered && <div style={{ fontSize: 11, color, flexShrink: 0 }}>Open →</div>}
    </div>
  );
}

function ClassCard({ cls, expanded, units, onToggle, onOpenUnit, onNewUnit }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{
      background: "#111118",
      border: `1px solid ${expanded ? cls.color + "55" : "#1E1E2A"}`,
      borderRadius: 16, overflow: "hidden", transition: "border-color 0.2s",
    }}>
      <div
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: "16px 20px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 12,
          background: hovered ? "#16161F" : "transparent",
          transition: "background 0.15s",
        }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: cls.color + "20", border: `1px solid ${cls.color}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0,
        }}>📁</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif" }}>{cls.title}</div>
          <div style={{ fontSize: 11, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {units === null ? "…" : `${units.length} unit${units.length !== 1 ? "s" : ""}`}
          </div>
        </div>
        <div style={{
          fontSize: 11, color: cls.color,
          transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "none",
        }}>▶</div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid #1A1A24", padding: "10px 14px 14px" }}>
          {units === null ? (
            <div style={{ padding: "12px 8px", fontSize: 12, color: "#404060", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Loading…</div>
          ) : units.length === 0 ? (
            <div style={{ padding: "12px 8px", fontSize: 12, color: "#404060", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>No units yet — add one below</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {units.map(unit => (
                <UnitRow key={unit.id} unit={unit} color={cls.color} onClick={() => onOpenUnit(unit)} />
              ))}
            </div>
          )}
          <button
            onClick={onNewUnit}
            style={{
              width: "100%", background: "transparent",
              border: `1px dashed ${cls.color}55`, borderRadius: 10,
              padding: "9px", color: cls.color, fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = cls.color + "14"; e.currentTarget.style.borderColor = cls.color + "99"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = cls.color + "55"; }}
          >+ New Unit</button>
        </div>
      )}
    </div>
  );
}

function NewClassModal({ onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError("Class name is required."); return; }
    setError(""); setLoading(true);
    try { await onCreate(title.trim()); onClose(); }
    catch (err) { setError(err.message); }
    setLoading(false);
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(10,10,15,0.75)",
      backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#111118", border: "1px solid #2A2A38",
        borderRadius: 20, width: "100%", maxWidth: 420,
        padding: "32px 28px", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        animation: "fadeIn 0.2s ease",
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif", marginBottom: 4 }}>New Class</div>
          <div style={{ fontSize: 12, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>A class holds your units and notes for one course</div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. AP World History" maxLength={80}
            style={{ width: "100%", background: "#0D0D14", border: "1px solid #2A2A38", borderRadius: 10, padding: "12px 14px", color: "#E8E8F0", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", transition: "border-color 0.15s" }}
            onFocus={e => e.target.style.borderColor = "#A78BFA"}
            onBlur={e => e.target.style.borderColor = "#2A2A38"}
          />
          {error && <div style={{ background: "#2A1A1A", border: "1px solid #5A2020", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#F87171", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: "transparent", border: "1px solid #2A2A38", borderRadius: 10, padding: "11px", color: "#505070", fontSize: 13, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
            <button type="submit" disabled={loading || !title.trim()} style={{ flex: 2, background: "#A78BFA", border: "none", borderRadius: 10, padding: "11px", color: "#0A0A0F", fontWeight: 700, fontSize: 13, cursor: loading || !title.trim() ? "not-allowed" : "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: loading || !title.trim() ? 0.55 : 1, transition: "opacity 0.15s" }}>{loading ? "Creating…" : "Create Class"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewUnitModal({ classTitle, onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError("Unit name is required."); return; }
    setError(""); setLoading(true);
    try { await onCreate(title.trim(), topic.trim()); onClose(); }
    catch (err) { setError(err.message); }
    setLoading(false);
  }

  const inp = { width: "100%", background: "#0D0D14", border: "1px solid #2A2A38", borderRadius: 10, padding: "12px 14px", color: "#E8E8F0", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", transition: "border-color 0.15s" };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(10,10,15,0.75)",
      backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#111118", border: "1px solid #2A2A38",
        borderRadius: 20, width: "100%", maxWidth: 420,
        padding: "32px 28px", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        animation: "fadeIn 0.2s ease",
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif", marginBottom: 4 }}>New Unit</div>
          <div style={{ fontSize: 12, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Adding to <strong style={{ color: "#A78BFA" }}>{classTitle}</strong></div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Unit name *</label>
            <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Unit 5 — Revolutions" maxLength={80} style={inp} onFocus={e => e.target.style.borderColor = "#A78BFA"} onBlur={e => e.target.style.borderColor = "#2A2A38"} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Topic / description</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Industrial Revolution, causes and effects" maxLength={120} style={inp} onFocus={e => e.target.style.borderColor = "#A78BFA"} onBlur={e => e.target.style.borderColor = "#2A2A38"} />
          </div>
          {error && <div style={{ background: "#2A1A1A", border: "1px solid #5A2020", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#F87171", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: "transparent", border: "1px solid #2A2A38", borderRadius: 10, padding: "11px", color: "#505070", fontSize: 13, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
            <button type="submit" disabled={loading || !title.trim()} style={{ flex: 2, background: "#A78BFA", border: "none", borderRadius: 10, padding: "11px", color: "#0A0A0F", fontWeight: 700, fontSize: 13, cursor: loading || !title.trim() ? "not-allowed" : "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: loading || !title.trim() ? 0.55 : 1, transition: "opacity 0.15s" }}>{loading ? "Creating…" : "Create Unit"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InviteModal({ notebookId, onClose }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | success | error
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");

  async function handleSend() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address."); return;
    }
    setStatus("sending"); setError("");
    try {
      await api.createInvite(notebookId, trimmed);
      setSentTo(trimmed);
      setStatus("success");
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(err.message || "Failed to send invite.");
      setStatus("error");
    }
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(10,10,15,0.75)",
      backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#111118", border: "1px solid #2A2A38",
        borderRadius: 20, width: "100%", maxWidth: 420,
        padding: "32px 28px", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        animation: "fadeIn 0.2s ease",
      }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif", marginBottom: 4 }}>Invite a collaborator</div>
          <div style={{ fontSize: 12, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>They'll get an email with a link to join this unit</div>
        </div>

        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
            <div style={{ fontSize: 14, color: "#4ADE80", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>
              Invite sent to {sentTo}!
            </div>
          </div>
        ) : (
          <>
            <input
              type="email"
              placeholder="Enter your friend's email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); setStatus("idle"); }}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              autoFocus
              style={{
                width: "100%", background: "#0D0D14", border: `1px solid ${error ? "#F87171" : "#2A2A38"}`,
                borderRadius: 10, padding: "12px 14px", color: "#E8E8F0",
                fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif",
                outline: "none", boxSizing: "border-box", marginBottom: 10,
              }}
            />
            {error && (
              <div style={{ fontSize: 12, color: "#F87171", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 10 }}>{error}</div>
            )}
            <button
              onClick={handleSend}
              disabled={status === "sending"}
              style={{
                width: "100%", background: status === "sending" ? "#6B4FAF" : "#A78BFA",
                border: "none", borderRadius: 10, padding: "12px",
                color: "#0A0A0F", fontWeight: 700, fontSize: 13,
                cursor: status === "sending" ? "not-allowed" : "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 10,
                transition: "background 0.2s",
              }}
            >{status === "sending" ? "Sending…" : "Send Invite"}</button>
            <button onClick={onClose} style={{
              width: "100%", background: "transparent", border: "1px solid #2A2A38",
              borderRadius: 10, padding: "10px", color: "#505070", fontSize: 13,
              cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

function InviteLanding({ inviteInfo, onSignIn }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#0A0A0F",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 16, padding: 32, fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{ fontSize: 42 }}>📚</div>
      <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 28, fontWeight: 900, color: "#E8E8F0", letterSpacing: "-0.02em" }}>
        schol<span style={{ color: "#A78BFA" }}>r</span>
      </div>
      <div style={{ fontSize: 14, color: "#A78BFA", fontWeight: 600, textAlign: "center" }}>
        You've been invited to join a unit!
      </div>
      {inviteInfo ? (
        <div style={{ background: "#111118", border: "1px solid #2A2A38", borderRadius: 16, padding: "20px 28px", textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif", marginBottom: 4 }}>{inviteInfo.notebook_title}</div>
          {inviteInfo.class_title && <div style={{ fontSize: 12, color: "#505070" }}>in {inviteInfo.class_title}</div>}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "#505070" }}>Loading invite info…</div>
      )}
      <div style={{ fontSize: 13, color: "#606080", textAlign: "center" }}>Sign in or create an account to join</div>
      <button
        onClick={onSignIn}
        style={{
          background: "#A78BFA", border: "none", borderRadius: 12,
          padding: "13px 32px", color: "#0A0A0F", fontWeight: 700,
          fontSize: 14, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
          marginTop: 4, transition: "background 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "#9B7AE8"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "#A78BFA"; }}
      >Sign in or create account</button>
    </div>
  );
}

function getDisplayName(user) {
  return user?.user_metadata?.full_name
    || user?.email?.split("@")[0]
    || "Student";
}

function getGreeting(name) {
  const h = new Date().getHours();
  const first = name.split(" ")[0];
  if (h < 5)  return `Still up, ${first}?`;
  if (h < 12) return `Good morning, ${first} 👋`;
  if (h < 17) return `Good afternoon, ${first} 👋`;
  if (h < 21) return `Good evening, ${first} 👋`;
  return `Back at it, ${first} 🌙`;
}

const NAV = [
  { id: "dashboard", label: "Dashboard",  icon: "⊞" },
  { id: "my-notes",  label: "My Notes",   icon: "📓" },
  { id: "shared",    label: "Shared",     icon: "👥" },
  { id: "starred",   label: "Starred",    icon: "★"  },
  { id: "settings",  label: "Settings",   icon: "⚙"  },
];

export default function Scholr() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [activeNb, setActiveNb] = useState(null);
  const [search, setSearch] = useState("");
  const [notebooks, setNotebooks] = useState([]);          // flat list for My Notes
  const [sharedNotebooks, setSharedNotebooks] = useState([]); // notebooks user was invited to
  const [classes, setClasses] = useState([]);              // class folders for dashboard
  const [expandedClassId, setExpandedClassId] = useState(null);
  const [classUnitsCache, setClassUnitsCache] = useState({}); // { classId: unit[] }
  const [showNewClassModal, setShowNewClassModal] = useState(false);
  const [newUnitFor, setNewUnitFor] = useState(null);      // { classId, classTitle }
  const [toast, setToast] = useState("");
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [pendingInviteToken, setPendingInviteToken] = useState(null);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [showInviteAuth, setShowInviteAuth] = useState(false);

  // Restore session on mount; gate data fetches behind authReady to avoid race
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") { setShowPasswordReset(true); return; }
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Detect /invite/:token URL on mount
  useEffect(() => {
    const match = window.location.pathname.match(/^\/invite\/([^/]+)/);
    if (!match) return;
    const token = match[1];
    setPendingInviteToken(token);
    window.history.replaceState({}, "", "/");
    api.getInvite(token).then(setInviteInfo).catch(() => {});
  }, []);

  // Accept invite after user logs in
  useEffect(() => {
    if (!pendingInviteToken || !user || !authReady) return;
    const token = pendingInviteToken;
    setPendingInviteToken(null);
    api.acceptInvite(token)
      .then(({ notebook_id }) =>
        Promise.all([
          api.listNotebooks(getDisplayName(user)),
          api.listSharedNotebooks(getDisplayName(user)),
        ]).then(([nbs, shared]) => {
          setNotebooks(nbs);
          setSharedNotebooks(shared);
          const nb = shared.find(n => n.id === notebook_id) ?? nbs.find(n => n.id === notebook_id);
          if (nb) { setActiveNb(nb); setActiveView("dashboard"); }
        })
      )
      .catch(console.error);
  }, [pendingInviteToken, user, authReady]);

  // Only fetch data once auth is fully confirmed (authReady prevents JWT-empty race)
  useEffect(() => {
    if (!user || !authReady) return;
    const name = getDisplayName(user);
    api.listNotebooks(name).then(setNotebooks).catch(console.error);
    api.listSharedNotebooks(name).then(setSharedNotebooks).catch(console.error);
    api.listClasses().then(setClasses).catch(console.error);
  }, [user, authReady]);

  async function handleToggleClass(classId) {
    if (expandedClassId === classId) { setExpandedClassId(null); return; }
    setExpandedClassId(classId);
    if (classUnitsCache[classId]) return; // already fetched
    setClassUnitsCache(prev => ({ ...prev, [classId]: null })); // null = loading
    try {
      const units = await api.listClassNotebooks(classId, getDisplayName(user));
      setClassUnitsCache(prev => ({ ...prev, [classId]: units }));
    } catch {
      setClassUnitsCache(prev => ({ ...prev, [classId]: [] }));
    }
  }

  async function handleCreateClass(title) {
    const cls = await api.createClass(title);
    setClasses(prev => [...prev, cls]);
  }

  async function handleCreateUnit(classId, title, topic) {
    const unit = await api.createClassNotebook(classId, title, topic, getDisplayName(user));
    setClassUnitsCache(prev => ({ ...prev, [classId]: [...(prev[classId] ?? []), unit] }));
    setNotebooks(prev => [unit, ...prev]);
  }

  async function handleDeleteAccount() {
    await api.deleteAccount();
    localStorage.clear();
    await supabase.auth.signOut();
    setUser(null); setNotebooks([]); setSharedNotebooks([]); setClasses([]); setClassUnitsCache({});
    setActiveNb(null); setActiveView("dashboard");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null); setActiveNb(null); setNotebooks([]); setSharedNotebooks([]);
    setClasses([]); setClassUnitsCache({}); setActiveView("dashboard");
  }

  const displayName = getDisplayName(user);

  // Dashboard: filter classes by search
  const filteredClasses = classes.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  // My Notes / Shared: filter flat notebook list
  const viewBase = activeView === "my-notes" ? notebooks.filter(n => n.role === "owner")
    : activeView === "shared"   ? sharedNotebooks
    : activeView === "starred"  ? []
    : notebooks;

  const filtered = viewBase.filter(n => {
    const q = search.toLowerCase();
    return n.title.toLowerCase().includes(q) || (n.topic || "").toLowerCase().includes(q);
  });

  const viewLabel = NAV.find(n => n.id === activeView)?.label ?? "Dashboard";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A0A0F; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2A2A38; border-radius: 4px; }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-3px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {pendingInviteToken && authReady && !user && (
        <InviteLanding inviteInfo={inviteInfo} onSignIn={() => setShowInviteAuth(true)} />
      )}

      {authReady && !user && !showPasswordReset && (!pendingInviteToken || showInviteAuth) && (
        <AuthModal onAuth={(u) => { setShowInviteAuth(false); setUser(u); }} />
      )}

      {showPasswordReset && (
        <PasswordResetModal onDone={() => {
          setShowPasswordReset(false);
          setToast("Password updated");
          setTimeout(() => setToast(""), 3000);
        }} />
      )}

      {showDeleteAccount && (
        <DeleteAccountModal
          onClose={() => setShowDeleteAccount(false)}
          onConfirm={handleDeleteAccount}
        />
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: "#1A2E1A", border: "1px solid #2A5A2A",
          borderRadius: 12, padding: "12px 20px",
          fontSize: 13, color: "#4ADE80", fontWeight: 600,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          zIndex: 2000, animation: "fadeIn 0.2s ease",
          display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
        }}>
          ✓ {toast}
        </div>
      )}

      {showNewClassModal && (
        <NewClassModal
          onClose={() => setShowNewClassModal(false)}
          onCreate={handleCreateClass}
        />
      )}

      {newUnitFor && (
        <NewUnitModal
          classTitle={newUnitFor.classTitle}
          onClose={() => setNewUnitFor(null)}
          onCreate={(title, topic) => handleCreateUnit(newUnitFor.classId, title, topic)}
        />
      )}

      {/* Dashboard — always rendered so layout doesn't flash */}
      <div style={{
        minHeight: "100vh", background: "#0A0A0F",
        display: "flex", fontFamily: "'Plus Jakarta Sans', sans-serif",
        filter: authReady && !user ? "blur(4px)" : "none",
        pointerEvents: (authReady && !user) || (pendingInviteToken && !user) ? "none" : "auto",
        visibility: pendingInviteToken && !user ? "hidden" : "visible",
        transition: "filter 0.2s",
      }}>
        {/* Sidebar */}
        <div style={{
          width: 220, background: "#0D0D14", borderRight: "1px solid #1A1A24",
          padding: "28px 16px", display: "flex", flexDirection: "column", gap: 4,
          flexShrink: 0
        }}>
          <div style={{
            fontFamily: "'Nunito', sans-serif", fontSize: 22, fontWeight: 900,
            color: "#E8E8F0", marginBottom: 28, paddingLeft: 8, letterSpacing: "-0.02em"
          }}>
            schol<span style={{ color: "#A78BFA" }}>r</span>
          </div>

          {NAV.map(({ id, label, icon }) => {
            const active = activeView === id;
            return (
              <div
                key={id}
                onClick={() => { setActiveView(id); setActiveNb(null); setSearch(""); }}
                style={{
                  padding: "9px 12px", borderRadius: 10, display: "flex", alignItems: "center", gap: 8,
                  background: active ? "#1A1A28" : "transparent",
                  color: active ? "#E8E8F0" : "#606080",
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  cursor: "pointer", transition: "background 0.15s, color 0.15s",
                  userSelect: "none",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#14141E"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 14, opacity: active ? 1 : 0.6 }}>{icon}</span>
                {label}
              </div>
            );
          })}

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10, background: "#111118"
            }}>
              <Avatar name={displayName} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: "#D0D0E8",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                }}>{displayName}</div>
                <div style={{
                  fontSize: 10, color: "#404060",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                }}>{user?.email}</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              style={{
                width: "100%", background: "transparent",
                border: "1px solid #2A2A38", borderRadius: 10,
                padding: "9px 12px", color: "#505070", fontSize: 12,
                cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: "all 0.15s", textAlign: "left",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#5A2A2A"; e.currentTarget.style.color = "#F87171"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#2A2A38"; e.currentTarget.style.color = "#505070"; }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: "32px 36px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {activeNb ? (
            <div style={{ height: "100%", animation: "fadeIn 0.3s ease" }}>
              <NotebookView
                nb={activeNb}
                onBack={() => setActiveNb(null)}
                onDeleted={id => {
                  setNotebooks(prev => prev.filter(n => n.id !== id));
                  setClassUnitsCache(prev => {
                    const next = { ...prev };
                    for (const cid of Object.keys(next)) {
                      if (Array.isArray(next[cid])) next[cid] = next[cid].filter(u => u.id !== id);
                    }
                    return next;
                  });
                  setActiveNb(null);
                  setToast("Unit deleted");
                  setTimeout(() => setToast(""), 3000);
                }}
              />
            </div>

          ) : activeView === "settings" ? (
            <div style={{ animation: "fadeIn 0.3s ease", maxWidth: 480 }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif", letterSpacing: "-0.02em", marginBottom: 4 }}>
                Settings
              </div>
              <div style={{ fontSize: 13, color: "#505070", marginBottom: 32 }}>Manage your account</div>

              <div style={{ fontSize: 11, color: "#404060", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                Account
              </div>
              <div style={{ background: "#111118", border: "1px solid #1E1E2A", borderRadius: 14, padding: "16px 18px", marginBottom: 32 }}>
                <div style={{ fontSize: 12, color: "#505070", marginBottom: 4 }}>Signed in as</div>
                <div style={{ fontSize: 14, color: "#D0D0E8", fontWeight: 600 }}>{user?.email}</div>
              </div>

              <div style={{ fontSize: 11, color: "#7F1D1D", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                Danger zone
              </div>
              <div style={{ background: "#180C0C", border: "1px solid #3A1A1A", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#D0D0E8", marginBottom: 3 }}>Delete my account</div>
                  <div style={{ fontSize: 12, color: "#604040" }}>This action cannot be undone.</div>
                </div>
                <button
                  onClick={() => setShowDeleteAccount(true)}
                  style={{
                    background: "transparent", border: "1px solid #5A2020",
                    borderRadius: 10, padding: "8px 14px", color: "#F87171",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#2A1010"; e.currentTarget.style.borderColor = "#991B1B"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#5A2020"; }}
                >Delete account</button>
              </div>
            </div>

          ) : (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif", letterSpacing: "-0.02em" }}>
                    {activeView === "dashboard" ? getGreeting(displayName) : viewLabel}
                  </div>
                  <div style={{ fontSize: 13, color: "#505070", marginTop: 2 }}>
                    {activeView === "dashboard"
                      ? `${classes.length} class${classes.length !== 1 ? "es" : ""}`
                      : `${filtered.length} notebook${filtered.length !== 1 ? "s" : ""}`}
                  </div>
                </div>
                {activeView === "dashboard" && (
                  <button
                    onClick={() => setShowNewClassModal(true)}
                    style={{ background: "#A78BFA", border: "none", borderRadius: 12, padding: "10px 20px", color: "#0A0A0F", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "opacity 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                    onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                  >+ New Class</button>
                )}
              </div>

              {/* Search */}
              {activeView !== "starred" && (
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={activeView === "dashboard" ? "Search classes…" : `Search ${viewLabel.toLowerCase()}…`}
                  style={{ width: "100%", background: "#111118", border: "1px solid #1E1E2A", borderRadius: 12, padding: "12px 16px", color: "#E8E8F0", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", marginBottom: 24 }}
                />
              )}

              {/* Dashboard: class cards */}
              {activeView === "dashboard" ? (
                filteredClasses.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", gap: 12, color: "#404060" }}>
                    <div style={{ fontSize: 32 }}>📁</div>
                    <div style={{ fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {search ? "No classes match your search" : "No classes yet — create one to get started"}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
                    {filteredClasses.map(cls => (
                      <ClassCard
                        key={cls.id}
                        cls={cls}
                        expanded={expandedClassId === cls.id}
                        units={classUnitsCache[cls.id] ?? null}
                        onToggle={() => handleToggleClass(cls.id)}
                        onOpenUnit={unit => setActiveNb(unit)}
                        onNewUnit={() => setNewUnitFor({ classId: cls.id, classTitle: cls.title })}
                      />
                    ))}
                  </div>
                )

              /* My Notes / Shared: flat notebook list */
              ) : activeView === "starred" ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", gap: 12, color: "#404060" }}>
                  <div style={{ fontSize: 32 }}>★</div>
                  <div style={{ fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>No starred notebooks yet</div>
                  <div style={{ fontSize: 12, color: "#2A2A40" }}>Open a notebook and star it to find it here</div>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", gap: 12, color: "#404060" }}>
                  <div style={{ fontSize: 32 }}>📓</div>
                  <div style={{ fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {search ? "No notebooks match your search" : "No notebooks here yet"}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: "#404060", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>
                    {viewLabel}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 32 }}>
                    {filtered.map(nb => (
                      <NotebookCard key={nb.id} nb={nb} onClick={() => setActiveNb(nb)} />
                    ))}
                  </div>
                </>
              )}

              {/* Recent Activity — dashboard only */}
              {activeView === "dashboard" && (
                <>
                  <div style={{ fontSize: 11, color: "#404060", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>
                    Recent Activity
                  </div>
                  {recentActivity.length === 0 ? (
                    <div style={{
                      background: "#111118", border: "1px solid #1A1A24",
                      borderRadius: 12, padding: "20px 16px",
                      fontSize: 13, color: "#404060",
                      fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "center",
                    }}>
                      No new notifications yet
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {recentActivity.map((a, i) => (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: 12,
                          background: "#111118", border: "1px solid #1A1A24",
                          borderRadius: 12, padding: "12px 16px"
                        }}>
                          <Avatar name={a.user} size={30} />
                          <div style={{ flex: 1, fontSize: 13, color: "#8080A0", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            <span style={{ color: "#C0C0D8", fontWeight: 600 }}>{a.user}</span> {a.action} <span style={{ color: "#C0C0D8" }}>{a.target}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "#404060", fontFamily: "'DM Mono', monospace" }}>{a.time}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
