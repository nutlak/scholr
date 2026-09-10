import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { Brain, ChevronRight, FileText, Hammer, Headphones, Image as ImageIcon, Layers, Paperclip, RefreshCw, Share2, Trash2 } from "lucide-react";
import { MemberAvatarStack } from "../../ui/Avatar.jsx";
import { StatusPill } from "../../ui/StatusPill.jsx";
import { ToolModal } from "../../ui/ToolModal.jsx";
import { FONT, FONT_HEADING, classTint, tintFor } from "../../lib/theme.js";
import { InviteModal } from "./InviteModal.jsx";
import { UnitNotes } from "./UnitNotes.jsx";
import UploadNotesModal from "../../UploadNotesModal.jsx";
import ImageGeneratorModal from "../../ImageGeneratorModal.jsx";
import { FlashcardsPanel } from "../../Flashcards.jsx";
import { TheForge } from "../forge/TheForge.jsx";
import { PodcastPanel } from "../podcast/PodcastPanel.jsx";
import { FeynmanPanel } from "../feynman/FeynmanPanel.jsx";

// ── Scholr 2.0 study-tool registry ────────────────────────────────────────────
// One source of truth for the notebook study tools. The header bar maps over
// this to render its buttons, and ToolModal looks up title/subtitle/icon by id.
// Adding a future tool (e.g. standalone flashcards) is a single entry here.
const NB_TOOLS = [
  { id: "notes",   text: "Notes",   label: "Unit notes",   title: "Unit Notes",    Icon: FileText,   tint: "#60A5FA", subtitle: "Shared notes for everyone in this notebook" },
  { id: "forge",   text: "Forge",   label: "The Forge",    title: "The Forge",     Icon: Hammer,     tint: "#A78BFA", subtitle: "Generate study guides, quizzes & flashcards from your notes" },
  { id: "flashcards", text: "Cards", label: "Flashcards", title: "Flashcards",   Icon: Layers,     tint: "#F472B6", subtitle: "Spaced-repetition flashcards generated from your notes" },
  { id: "podcast", text: "Podcast", label: "Podcast Mode", title: "Podcast",       Icon: Headphones, tint: "#34D399", subtitle: "A two-host AI audio overview of your notes" },
  { id: "feynman", text: "Feynman", label: "Feynman Mode", title: "Feynman Mode",  Icon: Brain,      tint: "#FBBF24", subtitle: "Explain a concept in your words — Claude grades your understanding" },
];
const NB_TOOL_META = Object.fromEntries(NB_TOOLS.map(x => [x.id, x]));

function renderMessageText(text, isOwn) {
  // Highlight @mentions inline (e.g. "@Alice ...")
  const parts = String(text ?? "").split(/(@[A-Za-z][A-Za-z0-9_]*)/g);
  return parts.map((p, i) => {
    if (/^@[A-Za-z][A-Za-z0-9_]*$/.test(p)) {
      return (
        <span key={i} style={{
          color: isOwn ? "var(--t1)" : "var(--acc-h)",
          fontWeight: 600,
          background: isOwn ? "var(--border-h)" : "color-mix(in srgb, var(--acc) 16%, transparent)",
          padding: "0 4px", borderRadius: 4,
        }}>{p}</span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
function SourcesPanel({ sources }) {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;
  return (
    <div style={{ marginTop: 6, marginLeft: 2 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: "transparent",
          border: "1px solid var(--border-default)",
          borderRadius: 8, padding: "0 10px", height: 24,
          fontSize: 11, fontWeight: 600, fontFamily: FONT,
          color: "var(--text-tertiary)",
          cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}
      ><Paperclip size={11} strokeWidth={1.75} /> {sources.length} source{sources.length === 1 ? "" : "s"} <ChevronRight size={11} strokeWidth={2} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} /></button>
      {open && (
        <div style={{
          marginTop: 6, padding: "8px 10px",
          background: "var(--bg-surface-2)",
          border: "1px solid var(--border-default)",
          borderRadius: 8, maxWidth: 360,
        }}>
          {sources.map((s, i) => (
            <div key={i} style={{
              fontSize: 11.5, color: "var(--text-secondary)",
              fontFamily: FONT, padding: "2px 0",
            }}>• {s}</div>
          ))}
        </div>
      )}
    </div>
  );
}
// ── Public-share modal ───────────────────────────────────────────────────────
function ShareModal({ notebookId, onClose, onStateChange }) {
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.shareNotebook(notebookId)
      .then(r => { setShareUrl(r.shareUrl); setLoading(false); onStateChange?.(true); })
      .catch(e => { setError(e.message || "Couldn't create a share link."); setLoading(false); });
  }, [notebookId, onStateChange]);

  async function copy() {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  }
  async function stopSharing() {
    setStopping(true);
    try { await api.unshareNotebook(notebookId); onStateChange?.(false); onClose(); }
    catch (e) { setError(e.message || "Couldn't stop sharing."); setStopping(false); }
  }

  return (
    <div className="mobile-sheet-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn 0.18s ease",
    }}>
      <div className="mobile-sheet" style={{
        background: "var(--bg-surface-1)", border: "1px solid rgba(167,139,250,0.28)",
        borderRadius: 18, padding: "28px 26px", maxWidth: 440, width: "100%",
        boxShadow: "var(--sh-modal)", fontFamily: FONT, animation: "slideInUp 0.22s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Share2 size={18} strokeWidth={2} style={{ color: "var(--acc)" }} />
          <div style={{ fontSize: 18, fontWeight: 600, fontFamily: FONT_HEADING, color: "var(--text-primary)" }}>Your notebook is now public!</div>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 18 }}>Anyone with this link can view your notes.</div>

        {error ? (
          <div style={{ fontSize: 13, color: "#F87171", marginBottom: 14 }}>{error}</div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <input readOnly value={loading ? "Generating link…" : shareUrl} onFocus={e => e.target.select()} style={{
              flex: 1, height: 42, borderRadius: 10, background: "var(--s1)", border: "1px solid var(--border)",
              color: "var(--text-primary)", fontFamily: FONT, fontSize: 13.5, padding: "0 12px", outline: "none",
            }} />
            <button onClick={copy} disabled={loading} className="btn-press" style={{
              height: 42, borderRadius: 10, border: "none", padding: "0 16px", cursor: loading ? "wait" : "pointer",
              background: "linear-gradient(135deg, #A78BFA, #8B5CF6)", color: "#fff", fontWeight: 700, fontSize: 13.5, fontFamily: FONT, whiteSpace: "nowrap",
            }}>{copied ? "Copied! ✓" : "Copy"}</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
          <button onClick={stopSharing} disabled={stopping} className="btn-press" style={{
            height: 40, borderRadius: 10, padding: "0 16px", cursor: "pointer",
            background: "transparent", border: "1px solid rgba(248,113,113,0.4)", color: "var(--danger)",
            fontFamily: FONT, fontSize: 13, fontWeight: 600,
          }}>{stopping ? "Stopping…" : "Stop sharing"}</button>
          <button onClick={onClose} className="btn-press" style={{
            height: 40, borderRadius: 10, padding: "0 18px", cursor: "pointer",
            background: "transparent", border: "1px solid var(--border-h)", color: "var(--text-secondary)", fontFamily: FONT, fontSize: 13,
          }}>Done</button>
        </div>
      </div>
    </div>
  );
}
export function NotebookView({ nb, onBack, onDeleted, currentUserId, onToast, onSetStatus, onUpgradeNeeded }) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isShared, setIsShared] = useState(!!nb.is_public);
  const [deleting, setDeleting]     = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [members, setMembers]       = useState([]);
  // Scholr 2.0 — one source of truth for which study tool is open (it renders
  // in the shared ToolModal). Replaces the old show*/mobilePanelView/isMobile
  // tangle; responsive behavior is now handled purely in CSS.
  const [activeTool, setActiveTool] = useState(null); // null | 'notes' | 'forge' | 'podcast' | 'feynman' | 'image-gen'
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [explainLevel, setExplainLevel] = useState(null); // { messageId } showing submenu
  const [explainingId, setExplainingId] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  // Prefer the class-assigned color when available, otherwise fall back to
  // the deterministic per-notebook tint so other views still render nicely.
  const t = nb.color ? classTint(nb.color) : tintFor(nb.id ?? nb.title);

  useEffect(() => {
    api.listMembers(nb.id).then(setMembers).catch(() => {});
  }, [nb.id]);

  useEffect(() => {
    api.getMessages(nb.id)
      .then(async (rows) => {
        if (rows.length > 0) {
          // For prior assistant messages, derive sources by matching known note titles against the content
          let notesByTitle = [];
          try { notesByTitle = await api.listNotes(nb.id); } catch { /* ignore */ }
          setMessages(rows.map(r => ({
            id: r.id, role: r.role, text: r.content, createdBy: r.created_by,
            sources: r.role === "assistant"
              ? notesByTitle
                  .filter(n => n.title && r.content.toLowerCase().includes(n.title.toLowerCase()))
                  .map(n => n.title)
              : undefined,
          })));
        } else {
          setMessages([{ role: "assistant", text: `Hey! I've read all the notes in this notebook. Ask me anything about ${nb.title}.` }]);
        }
        setHistoryLoaded(true);
      })
      .catch(() => {
        setMessages([{ role: "assistant", text: `Hey! I've read all the notes in this notebook. Ask me anything about ${nb.title}.` }]);
        setHistoryLoaded(true);
      });
  }, [nb.id]);

  function handleNoteUploaded(note) {
    setMessages(m => [...m, {
      role: "assistant",
      text: `"${note.title}" was added to this notebook. I'll include it in future answers.`,
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

  useEffect(() => {
    if (!historyLoaded) return;
    const hasHistory = messages.some(m => m.id);
    if (hasHistory) return;
    api.listNotes(nb.id).then(notes => {
      if (notes.length === 0) return;
      const list = notes.map(n => `• ${n.title}`).join("\n");
      setMessages(m => [...m, {
        role: "assistant",
        text: `${notes.length} note${notes.length !== 1 ? "s" : ""} in this notebook:\n${list}\n\nAsk me anything about them!`,
      }]);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function ask(presetText) {
    const text = (typeof presetText === "string" ? presetText : query).trim();
    if (!text || loading) return;

    setQuery("");
    setMentionOpen(false);
    setLoading(true);
    setMessages(m => [...m, { role: "user", text, createdBy: currentUserId }]);
    api.addMessage(nb.id, "user", text).catch(err => console.error("addMessage failed (user):", err));

    try {
      const data = await api.query(nb.id, text);
      if (data.error) throw new Error(data.error);
      const saved = await api.addMessage(nb.id, "assistant", data.answer).catch(err => { console.error("addMessage failed (assistant):", err); return null; });
      setMessages(m => [...m, { id: saved?.id, role: "assistant", text: data.answer, createdBy: null, sources: data.sources ?? [] }]);
      if (data.usageWarning) onToast?.(`⚡ ${data.usageWarning.message}`);
    } catch (err) {
      if (err.code === "message_limit_reached") {
        // Remove the optimistic user message bubble and show upgrade modal
        setMessages(m => m.slice(0, -1));
        onUpgradeNeeded?.("message_limit_reached");
      } else {
        setMessages(m => [...m, {
          role: "assistant",
          text: `Sorry, something went wrong: ${err.message}`,
          isError: true,
        }]);
      }
    } finally {
      setLoading(false);
    }
  }

  function onQueryChange(e) {
    const value = e.target.value;
    setQuery(value);
    // Detect @mention pattern: word starting with @ at cursor
    const caret = e.target.selectionStart ?? value.length;
    const upToCaret = value.slice(0, caret);
    const m = upToCaret.match(/(?:^|\s)@([A-Za-z0-9_]*)$/);
    if (m) {
      setMentionQuery(m[1].toLowerCase());
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  }

  function pickMention(name) {
    if (!inputRef.current) return;
    const el = inputRef.current;
    const caret = el.selectionStart ?? query.length;
    const before = query.slice(0, caret).replace(/@([A-Za-z0-9_]*)$/, `@${name} `);
    const after = query.slice(caret);
    const next = before + after;
    setQuery(next);
    setMentionOpen(false);
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = before.length; }, 0);
  }

  async function doExplainDifferently(messageId, level) {
    setExplainLevel(null);
    setExplainingId(messageId);
    try {
      const data = await api.explainDifferently(nb.id, messageId, level);
      const saved = await api.addMessage(nb.id, "assistant", data.answer).catch(() => null);
      setMessages(m => [...m, { id: saved?.id, role: "assistant", text: data.answer, createdBy: null }]);
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", text: `Couldn't re-explain: ${err.message}`, isError: true }]);
    } finally {
      setExplainingId(null);
    }
  }

  const mentionCandidates = mentionOpen
    ? members
        .filter(m => {
          const name = (m.first_name || m.email?.split("@")[0] || "").toLowerCase();
          return name && name !== (members.find(x => x.user_id === currentUserId)?.first_name || "").toLowerCase() && name.startsWith(mentionQuery);
        })
        .slice(0, 6)
    : [];

  return (
    <div className="print-area" data-print-title={nb.title || "Notes"} style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0, overflow: "hidden", position: "relative" }}>
      {showShare && (
        <ShareModal notebookId={nb.id} onClose={() => setShowShare(false)} onStateChange={setIsShared} />
      )}
      {showUpload && (
        <UploadNotesModal
          notebookId={nb.id} accentColor={t.hue}
          onClose={() => setShowUpload(false)}
          onUploaded={handleNoteUploaded}
        />
      )}

      {showInvite && (
        <InviteModal notebookId={nb.id} onClose={() => setShowInvite(false)} />
      )}

      {confirmDelete && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
          backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000, padding: 16,
        }}>
          <div style={{
            background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
            border: "1px solid var(--border)",
            borderRadius: 18, width: "100%", maxWidth: 400,
            padding: "24px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(248,113,113,0.12)",
            animation: "fadeIn 0.2s ease",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.28)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--danger)", marginBottom: 14,
            }}><Trash2 size={20} strokeWidth={1.75} /></div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)", fontFamily: FONT, marginBottom: 6, letterSpacing: "-0.015em" }}>
              Delete this notebook?
            </div>
            <div style={{ fontSize: 13, color: "var(--t2)", fontFamily: FONT, marginBottom: 20, lineHeight: 1.55 }}>
              <span style={{ color: "var(--t1)", fontWeight: 500 }}>{nb.title}</span> and all its notes will be permanently deleted.
            </div>
            {deleteError && (
              <div style={{
                background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)",
                borderRadius: 10, padding: "10px 12px", marginBottom: 16,
                fontSize: 12.5, color: "#F87171", fontFamily: FONT,
              }}>{deleteError}</div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setConfirmDelete(false); setDeleteError(""); }}
                disabled={deleting}
                className="btn-press"
                style={{
                  background: "transparent", border: "1px solid var(--border-h)",
                  borderRadius: 10, padding: "0 16px", height: 36,
                  color: "var(--t2)", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", fontFamily: FONT,
                  opacity: deleting ? 0.5 : 1, letterSpacing: "-0.01em",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t1)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t2)"; }}
              >Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-press"
                style={{
                  background: "linear-gradient(135deg, #F87171 0%, #EF4444 100%)",
                  border: "none", borderRadius: 10, padding: "0 18px", height: 36,
                  color: "#fff", fontWeight: 600, fontSize: 13,
                  cursor: deleting ? "not-allowed" : "pointer",
                  fontFamily: FONT, opacity: deleting ? 0.65 : 1,
                  boxShadow: "0 4px 14px rgba(248,113,113,0.35)",
                  letterSpacing: "-0.01em",
                }}
              >{deleting ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="nb-header no-print" style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 18,
        paddingBottom: 14, borderBottom: "1px solid var(--border-default)",
      }}>
        {/* Back — always Row 1 */}
        <button onClick={onBack} className="btn-press" style={{
          background: "transparent", border: "1px solid var(--border-strong)",
          color: "var(--text-secondary)",
          borderRadius: 10, padding: "0 14px", height: 36, cursor: "pointer",
          fontFamily: FONT, fontSize: 13, fontWeight: 500,
          letterSpacing: "-0.01em", flexShrink: 0,
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--border-default)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "transparent"; }}
        >← Back</button>

        {/* Title + (desktop) status + due date */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          <div style={{
            width: 8, height: 8, borderRadius: 2,
            background: `linear-gradient(135deg, ${t.hue}, ${t.deep})`,
            boxShadow: `0 0 12px ${t.hue}66`, flexShrink: 0,
          }} />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 15, fontWeight: 600, color: "var(--text-primary)",
              fontFamily: FONT, letterSpacing: "-0.018em",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{nb.title}</div>
            {nb.topic && (
              <div style={{
                fontSize: 11.5, color: "var(--text-tertiary)",
                fontFamily: FONT, marginTop: 1,
              }}>{nb.topic}</div>
            )}
          </div>
          {onSetStatus && (
            <span className="nb-desktop-only" style={{ marginLeft: 4 }}>
              <StatusPill status={nb.status ?? "in_progress"} onChange={s => onSetStatus(s)} size="md" />
            </span>
          )}
        </div>

        {/* Avatar — mobile: in Row 1 right; desktop: in actions */}
        {members.length > 0 && (
          <span className="nb-mobile-only" style={{ flexShrink: 0 }}>
            <MemberAvatarStack members={members} />
          </span>
        )}

        {/* Action buttons — desktop: inline; mobile: full-width scrollable Row 2 */}
        <div className="nb-header-actions">
          <button
            onClick={() => {
              const prev = document.title;
              document.title = nb.title || "Scholr notes";
              window.print();
              setTimeout(() => { document.title = prev; }, 1000);
            }}
            aria-label="Export PDF"
            data-tooltip="Export as PDF"
            className="btn-press has-tip"
            style={{
              background: "transparent", border: "1px solid var(--border-strong)",
              color: "var(--text-secondary)",
              borderRadius: 10, padding: "0 12px", height: 36, cursor: "pointer",
              fontFamily: FONT, fontSize: 14, flexShrink: 0,
            }}
          >📄</button>
          <button
            onClick={() => setShowShare(true)}
            aria-label="Share notebook"
            data-tooltip="Share notebook"
            className="btn-press has-tip"
            style={{
              background: isShared ? "var(--acc-bg)" : "transparent",
              border: `1px solid ${isShared ? "var(--acc)" : "var(--border-strong)"}`,
              color: isShared ? "var(--acc-h)" : "var(--text-secondary)",
              borderRadius: 10, padding: "0 12px", height: 36, cursor: "pointer",
              fontFamily: FONT, fontSize: 14, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6,
            }}
          ><Share2 size={14} strokeWidth={1.85} /></button>
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete notebook"
            data-tooltip="Delete notebook"
            className="btn-press has-tip"
            style={{
              background: "transparent", border: "1px solid rgba(248,113,113,0.18)",
              color: "rgba(248,113,113,0.55)",
              borderRadius: 10, padding: "0 12px", height: 36, cursor: "pointer",
              fontFamily: FONT, fontSize: 14, flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(248,113,113,0.5)"; e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = "rgba(248,113,113,0.06)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(248,113,113,0.18)"; e.currentTarget.style.color = "rgba(248,113,113,0.55)"; e.currentTarget.style.background = "transparent"; }}
          ><Trash2 size={14} strokeWidth={1.75} /></button>

          {/* Status + DueDate mobile-only compact variants */}
          {onSetStatus && (
            <span className="nb-mobile-only">
              <StatusPill status={nb.status ?? "in_progress"} onChange={s => onSetStatus(s)} size="sm" compact />
            </span>
          )}
          <span className="nb-actions-divider nb-desktop-only" />

          {/* Study tools live in the Studio rail on desktop; on mobile, where the
              rail is hidden, they stay in the header as pills. */}
          <span className="nb-mobile-only" style={{ display: "contents" }}>
          {NB_TOOLS.map(({ id, text, label, Icon }) => {
            const active = activeTool === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTool(active ? null : id)}
                aria-label={label}
                data-tooltip={label}
                className="btn-press has-tip nb-tool-btn"
                style={{
                  background: active ? "linear-gradient(135deg, color-mix(in srgb, var(--acc) 18%, transparent) 0%, var(--acc-bg) 100%)" : "transparent",
                  border: `1px solid ${active ? "var(--acc-bg-h)" : "var(--border-strong)"}`,
                  color: active ? "var(--acc-h)" : "var(--text-secondary)",
                  boxShadow: active ? "0 0 0 1px rgba(167,139,250,0.18), 0 4px 14px var(--acc-bg-h)" : "none",
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.borderColor = "var(--border-strong)"; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.borderColor = "var(--border-strong)"; } }}
              ><Icon size={15} strokeWidth={1.85} /> <span className="nb-action-text">{text}</span></button>
            );
          })}
          </span>

          <span className="nb-actions-divider nb-desktop-only" />

          <button
            onClick={() => setShowUpload(true)}
            aria-label="Upload files"
            data-tooltip="Upload files"
            className="btn-press has-tip"
            style={{
              background: "transparent", border: "1px solid var(--border-strong)",
              borderRadius: 10, padding: "0 14px", height: 36, cursor: "pointer",
              fontFamily: FONT, fontSize: 13, fontWeight: 500,
              color: "var(--text-secondary)", letterSpacing: "-0.01em", flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--border-default)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "transparent"; }}
          ><Paperclip size={14} strokeWidth={1.75} /> <span className="nb-action-text">Upload</span></button>

          <button
            onClick={() => setShowInvite(true)}
            aria-label="Invite collaborators"
            data-tooltip="Invite collaborators"
            className="btn-press has-tip"
            style={{
              background: "transparent", border: "1px solid var(--border-strong)",
              borderRadius: 10, padding: "0 14px", height: 36, cursor: "pointer",
              fontFamily: FONT, fontSize: 13, fontWeight: 500,
              color: "var(--text-secondary)", letterSpacing: "-0.01em", flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--border-default)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "transparent"; }}
          >+ <span className="nb-action-text">Invite</span></button>

          {/* Avatar — desktop: in actions (right-most); mobile: shown in Row 1 via nb-mobile-only above */}
          {members.length > 0 && (
            <span className="nb-desktop-only">
              <MemberAvatarStack members={members} />
            </span>
          )}
        </div>
      </div>

      {/* Chat + Forge split */}
      <div className="notebook-split" style={{ display: "flex", flex: 1, minHeight: 0, gap: 0 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Message list */}
          <div style={{
            flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
            gap: 12, marginBottom: 14, paddingRight: 4,
          }}>
            {messages.map((m, i) => {
              const isOwn = m.role === "user" && (m.createdBy === currentUserId || (!m.createdBy && m.role === "user"));
              const isOtherMember = m.role === "user" && m.createdBy && m.createdBy !== currentUserId;
              const isAssistant = m.role === "assistant";

              const senderInfo = isOtherMember ? members.find(mem => mem.user_id === m.createdBy) : null;
              const senderLabel = isAssistant
                ? "Derek"
                : isOtherMember
                  ? (senderInfo?.first_name?.trim() || senderInfo?.email?.split("@")[0] || "Member")
                  : null;
              const senderTint = isOtherMember ? tintFor(senderInfo?.email ?? "") : null;

              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" }}>
                  {senderLabel && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6, marginBottom: 5,
                      paddingLeft: 4,
                    }}>
                      {isAssistant ? (
                        <div style={{
                          width: 16, height: 16, borderRadius: "50%",
                          background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, fontWeight: 700, color: "#fff",
                          boxShadow: "0 2px 6px var(--acc-bg-h)",
                        }}>D</div>
                      ) : senderTint && (
                        <div style={{
                          width: 16, height: 16, borderRadius: "50%",
                          background: `linear-gradient(135deg, ${senderTint.hue}, ${senderTint.deep})`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, fontWeight: 700, color: "#fff",
                        }}>{(senderLabel[0] || "?").toUpperCase()}</div>
                      )}
                      <div style={{
                        fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: isAssistant ? "var(--acc-h)" : senderTint?.hue ?? "var(--t3)",
                        fontFamily: FONT,
                      }}>
                        {senderLabel}
                      </div>
                    </div>
                  )}
                  <div style={{
                    maxWidth: "78%",
                    minWidth: 44,
                    textAlign: "left",
                    background: m.isError
                      ? "rgba(248,113,113,0.08)"
                      : isOwn
                        ? "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)"
                        : "linear-gradient(180deg, var(--bg-surface-1) 0%, var(--bg-surface-2) 100%)",
                    color: m.isError ? "#F87171" : isOwn ? "#fff" : "var(--text-primary)",
                    borderRadius: 14,
                    padding: "11px 14px",
                    fontSize: 14, lineHeight: 1.6,
                    fontFamily: FONT,
                    border: !isOwn
                      ? `1px solid ${m.isError ? "rgba(248,113,113,0.22)" : "var(--border-default)"}`
                      : "none",
                    boxShadow: isOwn
                      ? "0 2px 8px rgba(167,139,250,0.18)"
                      : "0 1px 3px rgba(0,0,0,0.18)",
                    whiteSpace: "pre-wrap",
                    letterSpacing: "-0.005em",
                    animation: isOwn
                      ? "slideInUp 200ms cubic-bezier(0.34, 1.56, 0.64, 1) both"
                      : "slideInLeft 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
                  }}>
                    {renderMessageText(m.text, isOwn)}
                  </div>
                  {/* Sources display under Derek's message */}
                  {isAssistant && !m.isError && m.sources && m.sources.length > 0 && (
                    <SourcesPanel sources={m.sources} />
                  )}
                  {/* Explain Differently controls */}
                  {isAssistant && !m.isError && m.id && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, marginLeft: 2 }}>
                      <button
                        onClick={() => setExplainLevel(explainLevel === m.id ? null : m.id)}
                        disabled={explainingId !== null}
                        title="Explain differently"
                        style={{
                          background: explainLevel === m.id ? "var(--acc-bg-h)" : "transparent",
                          border: "1px solid var(--border-default)",
                          borderRadius: 8, padding: "0 10px", height: 26,
                          fontSize: 11, fontWeight: 600, fontFamily: FONT,
                          color: "var(--text-secondary)",
                          cursor: explainingId !== null ? "not-allowed" : "pointer",
                          opacity: explainingId !== null ? 0.5 : 1,
                          display: "flex", alignItems: "center", gap: 4,
                        }}
                      ><RefreshCw size={11} strokeWidth={1.75} /> {explainingId === m.id ? "Re-explaining…" : "Explain differently"}</button>
                      {explainLevel === m.id && (
                        <>
                          {[
                            { id: "simpler", label: "Simpler" },
                            { id: "more_advanced", label: "More advanced" },
                            { id: "different_angle", label: "Different angle" },
                          ].map(l => (
                            <button
                              key={l.id}
                              onClick={() => doExplainDifferently(m.id, l.id)}
                              style={{
                                background: "var(--bg-surface-2)",
                                border: "1px solid rgba(167,139,250,0.32)",
                                borderRadius: 8, padding: "0 10px", height: 26,
                                fontSize: 11, fontWeight: 600, fontFamily: FONT,
                                color: "var(--acc-h)", cursor: "pointer",
                              }}
                            >{l.label}</button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, marginBottom: 5, paddingLeft: 4,
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%",
                    background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700, color: "#fff",
                    boxShadow: "0 2px 6px var(--acc-bg-h)",
                  }}>D</div>
                  <div style={{
                    fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em",
                    textTransform: "uppercase", color: "var(--acc-h)", fontFamily: FONT,
                  }}>Derek</div>
                </div>
                <div style={{
                  background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
                  border: "1px solid var(--border)",
                  borderRadius: 14, padding: "11px 14px",
                  display: "flex", gap: 6, alignItems: "center",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  animation: "slideInLeft 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
                }}>
                  <span style={{
                    fontSize: 13, color: "var(--t2)", fontStyle: "italic",
                    fontFamily: FONT, marginRight: 4,
                  }}>Derek is thinking</span>
                  <span className="dot-thinking" />
                  <span className="dot-thinking" />
                  <span className="dot-thinking" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* AI disclaimer — Derek is a study aid, not an authoritative source */}
          <div style={{
            fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT,
            marginBottom: 8, textAlign: "center", lineHeight: 1.4,
          }}>
            Derek is AI — responses may be inaccurate. Verify important information independently.
          </div>

          {/* First-run aha: suggested prompt when the chat is empty */}
          {messages.length === 0 && (
            <button
              onClick={() => ask("Summarize this note and quiz me on the key points.")}
              disabled={loading}
              className="btn-press"
              style={{
                alignSelf: "flex-start", marginBottom: 10,
                background: "linear-gradient(135deg, #A78BFA, #8B5CF6)", border: "none",
                borderRadius: 999, padding: "10px 18px", color: "#fff",
                fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
                cursor: loading ? "wait" : "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
              }}
            >✨ Ask AI about this →</button>
          )}

          {/* Input row */}
          <div style={{ display: "flex", gap: 10, position: "relative" }}>
            {mentionOpen && mentionCandidates.length > 0 && (
              <div style={{
                position: "absolute", bottom: "calc(100% + 6px)", left: 0,
                background: "var(--bg-surface-2)",
                border: "1px solid var(--border-default)",
                borderRadius: 10, padding: 4, zIndex: 50,
                boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
                minWidth: 200,
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--t3)", padding: "6px 8px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Mention a member
                </div>
                {mentionCandidates.map(m => {
                  const name = m.first_name || m.email?.split("@")[0] || "Member";
                  const tnt = tintFor(m.email ?? name);
                  return (
                    <div
                      key={m.user_id}
                      onMouseDown={e => { e.preventDefault(); pickMention(name); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 8px", borderRadius: 7, cursor: "pointer",
                        fontSize: 13, color: "var(--text-primary)", fontFamily: FONT,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--border)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%",
                        background: `linear-gradient(135deg, ${tnt.hue}, ${tnt.deep})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700, color: "#fff",
                      }}>{name[0]?.toUpperCase()}</div>
                      {name}
                    </div>
                  );
                })}
              </div>
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={onQueryChange}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && ask()}
              placeholder={`Ask anything about ${nb.title}… (use @ to mention)`}
              disabled={loading}
              style={{
                flex: 1, background: "var(--bg-surface-1)",
                border: "1px solid var(--border-default)",
                borderRadius: 12, padding: "0 16px", height: 48,
                color: "var(--text-primary)", fontSize: 14, fontFamily: FONT,
                outline: "none", transition: "all 0.18s",
                letterSpacing: "-0.01em",
              }}
              onFocus={e => { e.target.style.borderColor = "var(--acc)"; e.target.style.boxShadow = "0 0 0 3px var(--acc-bg-h)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border-default)"; e.target.style.boxShadow = "none"; }}
            />
            <button
              onClick={() => setActiveTool("image-gen")}
              className="btn-press"
              title="Generate image"
              aria-label="Generate image"
              style={{
                background: "var(--s2)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                width: 48, height: 48,
                color: "var(--text-primary)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}
            >
              <ImageIcon size={20} strokeWidth={1.85} />
            </button>
            <button
              onClick={ask}
              disabled={loading || !query.trim()}
              className="btn-press"
              style={{
                background: query.trim() && !loading
                  ? "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)"
                  : "var(--s2)",
                border: query.trim() && !loading ? "none" : "1px solid var(--border)",
                borderRadius: 12,
                width: 48, height: 48, fontSize: 18, fontWeight: 600,
                color: "#fff",
                cursor: loading || !query.trim() ? "not-allowed" : "pointer",
                opacity: loading || !query.trim() ? 0.5 : 1,
                boxShadow: query.trim() && !loading ? "0 4px 14px color-mix(in srgb, var(--acc) 35%, transparent)" : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}
            >
              {loading ? "…" : "↑"}
            </button>
          </div>

        </div>

        {/* Studio rail — the study tools live here as persistent tiles instead
            of five more pills in an already crowded header. Selecting one still
            opens the shared ToolModal. */}
        <aside className="nb-studio desktop-only">
          <div className="panel" style={{ height: "100%" }}>
            <div className="panel-head">
              Studio
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--t3)" }}>
                {members.length} {members.length === 1 ? "member" : "members"}
              </span>
            </div>
            <div className="panel-body">
              <div className="studio-grid">
                {NB_TOOLS.map(({ id, text, label, Icon, tint }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTool(activeTool === id ? null : id)}
                    aria-label={label}
                    className="studio-tile"
                    style={{
                      "--tile-color": tint,
                      borderColor: activeTool === id
                        ? "color-mix(in srgb, " + tint + " 55%, transparent)"
                        : undefined,
                    }}
                  >
                    <span className="studio-tile-row">
                      <span className="studio-tile-icon"><Icon size={16} strokeWidth={1.85} /></span>
                      <ChevronRight size={13} strokeWidth={2} style={{ color: "var(--t4)" }} />
                    </span>
                    <span>{text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Scholr 2.0 — every study tool opens in one spacious, dismissible shell */}
      {activeTool && NB_TOOL_META[activeTool] && (
        <ToolModal
          open
          onClose={() => setActiveTool(null)}
          title={NB_TOOL_META[activeTool].title}
          subtitle={NB_TOOL_META[activeTool].subtitle}
          Icon={NB_TOOL_META[activeTool].Icon}
        >
          {activeTool === "notes" && (
            <UnitNotes notebookId={nb.id} currentUserId={currentUserId} tint={t} />
          )}
          {activeTool === "forge" && (
            <TheForge nb={nb} onToast={onToast} onUpgradeNeeded={onUpgradeNeeded} />
          )}
          {activeTool === "flashcards" && (
            <FlashcardsPanel nb={nb} onToast={onToast} onUpgradeNeeded={onUpgradeNeeded} />
          )}
          {activeTool === "podcast" && (
            <PodcastPanel nb={nb} onToast={onToast} onUpgradeNeeded={onUpgradeNeeded} />
          )}
          {activeTool === "feynman" && (
            <FeynmanPanel nb={nb} onToast={onToast} onUpgradeNeeded={onUpgradeNeeded} />
          )}
        </ToolModal>
      )}

      {/* Image generator brings its own modal chrome, so it's gated on activeTool but rendered outside ToolModal */}
      {activeTool === "image-gen" && (
        <ImageGeneratorModal notebookId={nb.id} onClose={() => setActiveTool(null)} />
      )}
    </div>
  );
}
