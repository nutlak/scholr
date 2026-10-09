import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { Brain, BookOpen, ChevronRight, ClipboardList, FileDown, FileText, GraduationCap, Headphones, HelpCircle, Layers, LineChart, MoreHorizontal, Orbit, Paperclip, RefreshCw, Trash2, UserPlus, Users } from "lucide-react";
import { MemberAvatarStack } from "../../ui/Avatar.jsx";
import { StudyRoomBar } from "./StudyRoomBar.jsx";
import { ToolModal } from "../../ui/ToolModal.jsx";
import { SheetMenu } from "../../ui/SheetMenu.jsx";
import { FONT, classTint, tintFor } from "../../lib/theme.js";
import { useNarrow } from "../../lib/breakpoints.js";
import { useDerekPhrase } from "../../lib/derekPhrases.js";
import { InviteModal } from "./InviteModal.jsx";
import { StudyMenu } from "./StudyMenu.jsx";
const UnitSources = lazy(() => import("./SourcesPanel.jsx").then(m => ({ default: m.SourcesPanel })));
import UploadNotesModal from "../../UploadNotesModal.jsx";
const FlashcardsPanel = lazy(() => import("../../Flashcards.jsx").then(m => ({ default: m.FlashcardsPanel })));
const TheForge = lazy(() => import("../forge/TheForge.jsx").then(m => ({ default: m.TheForge })));
const PodcastPanel = lazy(() => import("../podcast/PodcastPanel.jsx").then(m => ({ default: m.PodcastPanel })));
const FeynmanPanel = lazy(() => import("../feynman/FeynmanPanel.jsx").then(m => ({ default: m.FeynmanPanel })));
const BrainPanel = lazy(() => import("../brain/BrainPanel.jsx").then(m => ({ default: m.BrainPanel })));

// ── Scholr 2.0 study-tool registry ────────────────────────────────────────────
// One source of truth for the notebook study tools. The header bar maps over
// this to render its buttons, and ToolModal looks up title/subtitle/icon by id.
// Adding a future tool (e.g. standalone flashcards) is a single entry here.
//
// Flat by design — this used to be five tools, one of which ("The Forge") was
// itself a second five-item picker one level in, so reaching Worksheet was
// two consecutive "pick one of five" screens behind a button that was ALSO
// labelled "Forge". Noah's own words, after two rounds of screenshots trying
// to find it: "put everything in the forge so its in one place." Every Forge
// generation action is now its own row here, same level as Notes, Podcast and
// Feynman — one list, one click. `panel: "forge"` + `forgeAction` is what a
// row needs to open TheForge already generating; the review-mode Flashcards
// deck and the Forge one-off "make me a set" are genuinely different features
// that happen to share a name, so their subtitles say which is which rather
// than pretending one supersedes the other.
const NB_TOOLS = [
  { id: "brain",             text: "Brain",     label: "Unit brain",   title: "Brain",        Icon: Orbit,         tint: "#C2410C", subtitle: "Every key idea, and how well you know it" },
  { id: "sources",           text: "Sources",   label: "Sources",      title: "Sources",      Icon: FileText,      tint: "#1D4ED8", subtitle: "What Derek reads in this unit",            group: "learn" },
  { id: "forge:study_guide", text: "Guide",     label: "Study guide",  title: "Study Guide",  Icon: BookOpen,      tint: "#15803D", subtitle: "Comprehensive review",                     group: "learn", panel: "forge", forgeAction: "study_guide" },
  { id: "forge:summary",     text: "Summary",   label: "Summary",      title: "Summary",      Icon: ClipboardList, tint: "#0E7490", subtitle: "Concise overview",                         group: "learn", panel: "forge", forgeAction: "summary" },
  { id: "podcast",           text: "Podcast",   label: "Podcast",      title: "Podcast",      Icon: Headphones,    tint: "#DC2626", subtitle: "Two-host audio overview",                  group: "learn" },
  { id: "forge:questions",   text: "Questions", label: "Questions",    title: "Questions",    Icon: HelpCircle,    tint: "#B45309", subtitle: "Practice questions",                       group: "test",  panel: "forge", forgeAction: "questions" },
  { id: "flashcards",        text: "Cards",     label: "Flashcards",   title: "Flashcards",   Icon: Layers,        tint: "#C2410C", subtitle: "Your deck, spaced out over days",          group: "test" },
  { id: "forge:worksheet",   text: "Worksheet", label: "Worksheet",    title: "Worksheet",    Icon: LineChart,     tint: "#1D4ED8", subtitle: "Worked problems with real plotted graphs", group: "test",  panel: "forge", forgeAction: "worksheet" },
  { id: "feynman",           text: "Feynman",   label: "Explain it",   title: "Feynman Mode", Icon: Brain,         tint: "#15803D", subtitle: "Explain it in your words, get graded",     group: "test" },
];
// Shown while a tool's chunk downloads. Tools are code-split because they are
// only reachable behind a click, and together they were a large slice of a
// single 807 kB bundle every visitor paid for up front.
function ToolPanelFallback() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: 220, fontFamily: FONT, fontSize: 13,
    }}><span className="shimmer">Loading…</span></div>
  );
}

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
function SourcesPanel({ sources, notesById = {} }) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
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
          {sources.map((s, i) => {
            const note = s.id ? notesById[s.id] : null;
            const isExpanded = expandedId === s.id;
            return (
              <div key={s.id ?? i} style={{ padding: "2px 0" }}>
                <button
                  onClick={() => note && setExpandedId(isExpanded ? null : s.id)}
                  disabled={!note}
                  style={{
                    background: "none", border: "none", padding: 0,
                    fontSize: 11.5, color: note ? "var(--acc-h)" : "var(--text-secondary)",
                    fontFamily: FONT, cursor: note ? "pointer" : "default",
                    textDecoration: note ? "underline" : "none", textAlign: "left",
                  }}
                >
                  &bull; {s.title}
                  {s.author && <span style={{ color: "var(--accent)" }}> &mdash; {s.author}</span>}
                </button>
                {isExpanded && note && (
                  <div style={{
                    marginTop: 4, marginBottom: 4, padding: "8px 10px",
                    background: "var(--bg-surface-1)", border: "1px solid var(--border-subtle)",
                    borderRadius: 8, fontSize: 12, color: "var(--text-secondary)",
                    lineHeight: 1.5, maxHeight: 200, overflowY: "auto", whiteSpace: "pre-wrap",
                  }}>
                    {(note.content || "[file attachment \u2014 no text content]").slice(0, 1200)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export function NotebookView({ nb, onBack, onDeleted, currentUserId, onToast, onUpgradeNeeded }) {
  const narrow = useNarrow();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loading, setLoading]       = useState(false);
  const derekPhrase = useDerekPhrase(loading);
  const [showUpload, setShowUpload] = useState(false);
  const [sourcesVersion, setSourcesVersion] = useState(0); // bumps the Sources panel after an upload
  const [showInvite, setShowInvite] = useState(false);
  const [studyRoomJoined, setStudyRoomJoined] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [members, setMembers]       = useState([]);
  // Scholr 2.0 — one source of truth for which study tool is open (it renders
  // in the shared ToolModal). Replaces the old show*/mobilePanelView/isMobile
  // tangle; responsive behavior is now handled purely in CSS.
  const [activeTool, setActiveTool] = useState(null); // null | 'brain' | 'sources' | 'forge' | 'podcast' | 'feynman'
  const [feynmanConcept, setFeynmanConcept] = useState(null); // set when the brain opens Feynman on one concept
  useEffect(() => { if (activeTool !== "feynman") setFeynmanConcept(null); }, [activeTool]);
  const [sheet, setSheet] = useState(null);           // null | 'tools' | 'more'
  const [mobileTab, setMobileTab] = useState("chat"); // phone only: "chat" | "study"
  const [notesById, setNotesById] = useState({});     // id -> note, for expanding a citation inline

  // Print with the notebook's own name on the page instead of "scholr — …".
  function exportPdf() {
    const prev = document.title;
    document.title = nb.title || "Scholr notes";
    window.print();
    setTimeout(() => { document.title = prev; }, 1000);
  }
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [explainLevel, setExplainLevel] = useState(null); // { messageId } showing submenu
  const [explainingId, setExplainingId] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  // Prefer the class-assigned color when available, otherwise fall back to
  // the deterministic per-notebook tint so other views still render nicely.
  const t = nb.color ? classTint(nb.color) : tintFor(nb.id ?? nb.title);

  // Re-poll while the notebook is open so "here now" stays true — presence is
  // only worth showing if it's current. Matches the 60s heartbeat interval.
  useEffect(() => {
    const load = () => api.listMembers(nb.id).then(setMembers).catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [nb.id]);

  useEffect(() => {
    api.getMessages(nb.id)
      .then(async (rows) => {
        // Needed both to derive prior-message sources below and so a fresh
        // answer's {id, title} sources can expand to full content inline —
        // fetch once per notebook open regardless of whether there's history.
        let notesByTitle = [];
        try { notesByTitle = await api.listNotes(nb.id); } catch { /* ignore */ }
        setNotesById(Object.fromEntries(notesByTitle.map(n => [n.id, n])));

        if (rows.length > 0) {
          setMessages(rows.map(r => ({
            id: r.id, role: r.role, text: r.content, createdBy: r.created_by,
            sources: r.role === "assistant"
              ? notesByTitle
                  .filter(n => n.title && r.content.toLowerCase().includes(n.title.toLowerCase()))
                  .map(n => ({ id: n.id, title: n.title }))
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
    setSourcesVersion(v => v + 1);
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
      setMessages(m => [...m, { id: data.messageId, role: "assistant", text: data.answer, createdBy: null, sources: data.sources ?? [] }]);
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
      setMessages(m => [...m, { id: data.messageId, role: "assistant", text: data.answer, createdBy: null }]);
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", text: `Couldn't re-explain: ${err.message}`, isError: true }]);
    } finally {
      setExplainingId(null);
    }
  }

  const mentionCandidates = mentionOpen
    ? members
        .filter(m => {
          const name = (m.display_name || "").toLowerCase();
          return name && name !== (members.find(x => x.user_id === currentUserId)?.display_name || "").toLowerCase() && name.startsWith(mentionQuery);
        })
        .slice(0, 6)
    : [];

  const me = currentUserId ? {
    userId: currentUserId,
    name: members.find(m => m.user_id === currentUserId)?.display_name || "Someone",
  } : null;

  return (
    <div className="print-area" data-print-title={nb.title || "Notes"} style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0, overflow: "hidden", position: "relative" }}>
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
          position: "fixed", inset: 0, background: "var(--overlay)",
          backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000, padding: 16,
        }}>
          <div style={{
            background: "var(--bg-surface-1)",
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
                fontSize: 12.5, color: "var(--danger)", fontFamily: FONT,
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
        <button onClick={onBack} className="btn-press nb-back" style={{
          background: "transparent", border: "1px solid var(--border-strong)",
          color: "var(--text-secondary)",
          borderRadius: 10, padding: "0 14px", height: 36, cursor: "pointer",
          fontFamily: FONT, fontSize: 13, fontWeight: 500,
          letterSpacing: "-0.01em", flexShrink: 0,
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--border-default)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "transparent"; }}
        >← Back</button>

        {/* Title + (desktop) status + due date. The 200px basis is what makes
            the actions wrap to a second row when a docked tool narrows the
            column; with a 0 basis the title was squeezed to nothing and the
            Forge button drew on top of the topic and status pill. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "1 1 200px" }}>
          <div style={{
            width: 8, height: 8, borderRadius: 2,
            background: t.hue, flexShrink: 0,
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
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{nb.topic}</div>
            )}
          </div>
        </div>

        {/* Mobile: one ⋯ in the title row replaces the Invite/Upload/More row
            below it. Those two are in the sheet it opens — a phone cannot
            afford 74px of buttons above a chat window. */}
        <button
          onClick={() => setSheet("more")}
          className="btn-press nb-more-inline"
          aria-haspopup="dialog"
          aria-label="Notebook actions"
          style={{
            background: "transparent", border: "1px solid var(--border-strong)",
            color: "var(--text-secondary)", cursor: "pointer", flexShrink: 0,
            width: 44, height: 44, alignItems: "center", justifyContent: "center",
          }}
        ><MoreHorizontal size={18} strokeWidth={1.85} /></button>

        {/* Avatar — mobile: in Row 1 right; desktop: in actions */}
        {members.length > 0 && (
          <span className="nb-mobile-only" style={{ flexShrink: 0 }}>
            <MemberAvatarStack members={members} />
          </span>
        )}

        {/* Action buttons — desktop: inline; mobile: full-width scrollable Row 2 */}
        {/* Four targets, not ten. Everything rarely reached lives behind More,
            and the five study tools live behind one Forge button. */}
        <div className="nb-header-actions">

          <button
            onClick={() => setSheet("tools")}
            className="btn-press nb-tool-btn"
            aria-haspopup="dialog"
            style={{
              background: activeTool ? "var(--acc-bg)" : "transparent",
              border: `1px solid ${activeTool ? "var(--acc)" : "var(--border-strong)"}`,
              color: activeTool ? "var(--acc-h)" : "var(--text-primary)",
            }}
          ><GraduationCap size={16} strokeWidth={1.85} /> Study</button>

          <button
            onClick={() => setShowInvite(true)}
            className="btn-press nb-util-btn"
            style={{
              background: "var(--acc-bg)", border: "1px solid var(--accent)",
              color: "var(--acc-h)", fontWeight: 600,
            }}
          ><UserPlus size={15} strokeWidth={1.95} /> Invite</button>

          <button
            onClick={() => setShowUpload(true)}
            className="btn-press nb-util-btn"
            style={{
              background: "transparent", border: "1px solid var(--border-strong)",
              color: "var(--text-secondary)",
            }}
          ><Paperclip size={15} strokeWidth={1.75} /> Add source</button>

          <button
            onClick={() => setSheet("more")}
            className="btn-press nb-util-btn"
            aria-haspopup="dialog"
            aria-label="More actions"
            style={{
              background: "transparent", border: "1px solid var(--border-strong)",
              color: "var(--text-secondary)",
            }}
          ><MoreHorizontal size={16} strokeWidth={1.85} /> More</button>

          {members.length > 0 && (
            <span className="nb-desktop-only">
              <MemberAvatarStack members={members} />
            </span>
          )}
        </div>
      </div>

      {/* Live study room — the roster, shared pomodoro, quiz battle and Feynman
          feed. Opt-in from the ⋯ menu ("Study together"); until then this
          renders nothing and the chat keeps the space. Note this is a different
          thing from "Invite a classmate", which shares the notebook itself. */}
      {me && studyRoomJoined && (
        <div className="no-print" style={{ marginBottom: 14 }}>
          <StudyRoomBar
            notebookId={nb.id}
            me={me}
            joined={studyRoomJoined}
            onJoinedChange={setStudyRoomJoined}
          />
        </div>
      )}

      {/* Phone only: NotebookLM's split — the chat keeps the whole screen, and
          the study tools are a tab you go to rather than a strip of ten
          equal boxes under the composer. */}
      <div className="seg-control nb-tabs no-print" role="radiogroup" aria-label="Notebook view" style={{ "--seg-n": 2 }}>
        <span className="seg-pill" aria-hidden="true" style={{ transform: `translateX(${mobileTab === "study" ? 100 : 0}%)` }} />
        {[["chat", "Chat"], ["study", "Study"]].map(([id, label]) => (
          <button key={id} className="seg-option" role="radio" aria-checked={mobileTab === id} onClick={() => setMobileTab(id)}>{label}</button>
        ))}
      </div>
      {mobileTab === "study" && (
        <div className="nb-study-pane no-print">
          <StudyMenu nb={nb} tools={NB_TOOLS} currentUserId={currentUserId} onOpen={setActiveTool} />
        </div>
      )}

      {/* Chat + Forge split */}
      <div className={`notebook-split${mobileTab === "study" ? " is-study" : ""}`} style={{ display: "flex", flex: 1, minHeight: 0, gap: 0 }}>
        {/* minHeight: 0 is load-bearing. A flex item will not shrink below its
            content without it, so this column grew to the full height of the
            transcript (5322px inside a 780px notebook), the message list never
            scrolled, and the chat's scroll-to-latest dragged the header — Back,
            Invite, Upload, and the whole tool strip — off the top of the screen
            with no way to scroll back, because the root clips its overflow. */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          {/* Message list */}
          <div style={{
            flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
            gap: 12, marginBottom: 14, paddingRight: 4,
          }}>
            {/* AI disclaimer — Derek is a study aid, not an authoritative
                source. It sits at the top of the transcript rather than pinned
                above the composer: there it was on screen forever and cost ~36px
                of a phone's chat height, which is the most valuable space in the
                app. Here it is the first thing above Derek's greeting, so it is
                read when the notebook is new and scrolls away once there is a
                conversation. flexShrink keeps the flex column from squashing it. */}
            <div style={{
              flexShrink: 0,
              fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT,
              textAlign: "center", lineHeight: 1.4, padding: "2px 8px",
            }}>
              Derek is AI — responses may be inaccurate. Verify important information independently.
            </div>
            {messages.map((m, i) => {
              const isOwn = m.role === "user" && (m.createdBy === currentUserId || (!m.createdBy && m.role === "user"));
              const isOtherMember = m.role === "user" && m.createdBy && m.createdBy !== currentUserId;
              const isAssistant = m.role === "assistant";

              const senderInfo = isOtherMember ? members.find(mem => mem.user_id === m.createdBy) : null;
              const senderLabel = isAssistant
                ? "Derek"
                : isOtherMember
                  ? (senderInfo?.display_name || "Member")
                  : null;
              const senderTint = isOtherMember ? tintFor(senderInfo?.user_id ?? "") : null;

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
                          background: "var(--acc)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, fontWeight: 700, color: "var(--on-acc)",
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
                  <div className={"chat-bubble " + (isOwn ? "chat-own" : "chat-in")} style={{
                    maxWidth: "78%",
                    minWidth: 44,
                    textAlign: "left",
                    // Incoming bubble keeps var(--bubble-in) rather than a
                    // surface token: it is a bubble, not a card, and wants its
                    // own slightly warmer tone.
                    //
                    // Sent bubbles take var(--on-acc), not white. The accent is
                    // a light violet and white on it is 2.72:1 — under AA — and
                    // this is the text people reread most: their own question.
                    background: m.isError
                      ? "rgba(248,113,113,0.08)"
                      : isOwn
                        ? "var(--acc)"
                        : "var(--bubble-in)",
                    color: m.isError ? "var(--danger)" : isOwn ? "var(--on-acc)" : "var(--text-primary)",
                    borderRadius: 18,
                    padding: "11px 15px",
                    fontSize: isAssistant && !m.isError ? 15 : 14,
                    lineHeight: isAssistant && !m.isError ? 1.65 : 1.6,
                    fontFamily: FONT, // answers are read at length: body face, not handwriting
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
                    <SourcesPanel sources={m.sources} notesById={notesById} />
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
                                border: "1px solid var(--acc)",
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
                    background: "var(--acc)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700, color: "var(--on-acc)",
                    boxShadow: "0 2px 6px var(--acc-bg-h)",
                  }}>D</div>
                  <div style={{
                    fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em",
                    textTransform: "uppercase", color: "var(--acc-h)", fontFamily: FONT,
                  }}>Derek</div>
                </div>
                <div style={{
                  background: "var(--bg-surface-1)",
                  border: "1px solid var(--border)",
                  borderRadius: 14, padding: "11px 14px",
                  display: "flex", gap: 6, alignItems: "center",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  animation: "slideInLeft 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
                }}>
                  <span className="shimmer" style={{
                    fontSize: 13, fontWeight: 500, fontFamily: FONT, letterSpacing: "-0.01em",
                  }}>{derekPhrase}</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

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
                  const name = m.display_name || "Member";
                  const tnt = tintFor(m.user_id ?? name);
                  return (
                    <div
                      key={m.user_id}
                      onMouseDown={e => { e.preventDefault(); pickMention(name); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 8px", borderRadius: 9, cursor: "pointer",
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
              placeholder={narrow ? "Ask Derek anything…" : `Ask anything about ${nb.title}… (use @ to mention)`}
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
              onClick={ask}
              disabled={loading || !query.trim()}
              className="btn-press"
              style={{
                background: query.trim() && !loading
                  ? "var(--acc)"
                  : "var(--s2)",
                border: query.trim() && !loading ? "none" : "1px solid var(--border)",
                borderRadius: 12,
                width: 48, height: 48, fontSize: 18, fontWeight: 600,
                color: query.trim() && !loading ? "var(--on-acc)" : "var(--t2)",
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
      </div>

      {/* Menus dock to the same right rail the tools use — never a centred dialog. */}
      {sheet === "tools" && !activeTool && (
        <ToolModal
          open
          onClose={() => setSheet(null)}
          title="Study"
          subtitle="Turn these notes into something you can study from"
          Icon={GraduationCap}
        >
          <StudyMenu nb={nb} tools={NB_TOOLS} currentUserId={currentUserId}
            onOpen={(id) => { setSheet(null); setActiveTool(id); }} />
        </ToolModal>
      )}

      {sheet === "more" && !activeTool && (
        <ToolModal
          open
          onClose={() => setSheet(null)}
          title="Notebook"
          subtitle={nb.title}
          Icon={MoreHorizontal}
        >
          <SheetMenu
            items={[
              { id: "studyroom", label: studyRoomJoined ? "Leave the study room" : "Study together",
                description: studyRoomJoined ? "Close the live room for yourself" : "Live room: who's here, a shared timer, quiz battles",
                Icon: Users, onSelect: () => { setSheet(null); setStudyRoomJoined(v => !v); } },
              { id: "invite", label: "Invite a classmate", description: "Share this notebook with someone",
                Icon: UserPlus, onSelect: () => { setSheet(null); setShowInvite(true); } },
              { id: "upload", label: "Add a source", description: "Upload a file, or write or paste a note",
                Icon: Paperclip, onSelect: () => { setSheet(null); setShowUpload(true); } },
              { id: "pdf", label: "Save as PDF", description: "Print or download these notes",
                Icon: FileDown, onSelect: () => { setSheet(null); exportPdf(); } },
              { id: "delete", label: "Delete notebook", description: "This cannot be undone",
                Icon: Trash2, danger: true, onSelect: () => { setSheet(null); setConfirmDelete(true); } },
            ]}
          />
        </ToolModal>
      )}

      {/* Scholr 2.0 — every study tool opens in one spacious, dismissible shell */}
      {activeTool && NB_TOOL_META[activeTool] && (
        <ToolModal
          open
          onClose={() => setActiveTool(null)}
          title={NB_TOOL_META[activeTool].title}
          subtitle={NB_TOOL_META[activeTool].subtitle}
          Icon={NB_TOOL_META[activeTool].Icon}
        >
          <Suspense fallback={<ToolPanelFallback />}>
          {activeTool === "sources" && (
            <UnitSources nb={nb} currentUserId={currentUserId} members={members} refreshKey={sourcesVersion}
              isOwner={members.find(m => m.user_id === currentUserId)?.role === "owner"}
              onAdd={() => setShowUpload(true)} onToast={onToast} />
          )}
          {NB_TOOL_META[activeTool]?.panel === "forge" && (
            <TheForge nb={nb} initialAction={NB_TOOL_META[activeTool].forgeAction} onToast={onToast} onUpgradeNeeded={onUpgradeNeeded} />
          )}
          {activeTool === "flashcards" && (
            <FlashcardsPanel nb={nb} onToast={onToast} onUpgradeNeeded={onUpgradeNeeded} />
          )}
          {activeTool === "podcast" && (
            <PodcastPanel nb={nb} onToast={onToast} onUpgradeNeeded={onUpgradeNeeded} />
          )}
          {activeTool === "feynman" && (
            <FeynmanPanel key={feynmanConcept ?? ""} nb={nb} me={me} initialConcept={feynmanConcept} onToast={onToast} onUpgradeNeeded={onUpgradeNeeded} />
          )}
          {activeTool === "brain" && (
            <BrainPanel nb={nb} members={members} currentUserId={currentUserId} onToast={onToast} onUpgradeNeeded={onUpgradeNeeded}
              onExplain={(c) => { setFeynmanConcept(c); setActiveTool("feynman"); }}
              onAsk={(text) => { setActiveTool(null); setQuery(text); setTimeout(() => inputRef.current?.focus(), 0); }} />
          )}
          </Suspense>
        </ToolModal>
      )}

    </div>
  );
}
