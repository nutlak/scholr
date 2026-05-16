import { useState, useEffect, useRef } from "react";
import { api } from "./api.js";
import { supabase } from "./supabase.js";
import AuthModal from "./AuthModal.jsx";
import LandingPage from "./LandingPage.jsx";
import NewNotebookModal from "./NewNotebookModal.jsx";
import UploadNotesModal from "./UploadNotesModal.jsx";
import "./App.css";

function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const FONT = `system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif`;
const MONO = `ui-monospace, "SF Mono", Consolas, monospace`;

function Avatar({ name, size = 28 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "#A78BFA",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 600, color: "#fff",
      fontFamily: FONT, flexShrink: 0,
      border: "1.5px solid #0A0A0A",
    }}>
      {name[0].toUpperCase()}
    </div>
  );
}

function AvatarStack({ names }) {
  return (
    <div style={{ display: "flex" }}>
      {names.slice(0, 3).map((n, i) => (
        <div key={n} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: names.length - i }}>
          <Avatar name={n} size={22} />
        </div>
      ))}
      {names.length > 3 && (
        <div style={{
          marginLeft: -6, width: 22, height: 22, borderRadius: "50%",
          background: "#1A1A1A", border: "1.5px solid #0A0A0A",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: FONT,
        }}>+{names.length - 3}</div>
      )}
    </div>
  );
}

function NotebookCard({ nb, onClick, starred = false, onToggleStar }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#1A1A1A" : "#111111",
        border: `1px solid ${hovered ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 6,
        padding: "16px",
        cursor: "pointer",
        transition: "background 0.1s, border-color 0.1s",
        position: "relative",
      }}
    >
      {onToggleStar && (
        <button
          onClick={e => { e.stopPropagation(); onToggleStar(); }}
          title={starred ? "Remove star" : "Star this notebook"}
          style={{
            position: "absolute", top: 12, right: 12, zIndex: 10,
            background: "none", border: "none", cursor: "pointer",
            padding: "2px 4px", fontSize: 14,
            color: starred ? "#A78BFA" : "rgba(255,255,255,0.3)",
            opacity: starred ? 1 : hovered ? 1 : 0,
            transition: "color 0.1s, opacity 0.1s", lineHeight: 1,
          }}
          onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = "#A78BFA"; }}
          onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.color = starred ? "#A78BFA" : "rgba(255,255,255,0.3)"; }}
        >
          {starred ? "★" : "☆"}
        </button>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{
          fontSize: 10, fontWeight: 500, letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.4)", textTransform: "uppercase",
          fontFamily: MONO,
        }}>{nb.notes} notes</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: FONT, paddingRight: 20 }}>{nb.updated}</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 500, color: "#FAFAFA", fontFamily: FONT, marginBottom: 4, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
        {nb.title}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: FONT, marginBottom: 12 }}>
        {nb.topic}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <AvatarStack names={nb.contributors} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: FONT }}>
            {nb.contributors.length} member{nb.contributors.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{
          fontSize: 11, color: "#A78BFA", fontFamily: FONT,
          opacity: hovered ? 1 : 0, transition: "opacity 0.1s",
        }}>Open →</div>
      </div>
    </div>
  );
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
          style={{ position: "relative", marginLeft: i === 0 ? 0 : -8, zIndex: visible.length - i, cursor: "default" }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "#A78BFA",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 600, color: "#fff",
            fontFamily: FONT, border: "1.5px solid #0A0A0A",
            userSelect: "none",
          }}>
            {m.email[0].toUpperCase()}
          </div>
          {hoveredIdx === i && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
              transform: "translateX(-50%)",
              background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6, padding: "6px 10px",
              fontSize: 11, color: "#FAFAFA",
              fontFamily: FONT, whiteSpace: "nowrap", zIndex: 100,
              boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            }}>
              <div style={{ fontWeight: 500 }}>{m.email}</div>
              <div style={{ color: m.role === "owner" ? "#A78BFA" : "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 2, textTransform: "capitalize" }}>
                {m.role === "owner" ? "Owner" : "Member"}
              </div>
            </div>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div style={{
          marginLeft: -8, width: 28, height: 28, borderRadius: "50%",
          background: "#1A1A1A", border: "1.5px solid #0A0A0A",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: FONT, zIndex: 0,
        }}>+{overflow}</div>
      )}
    </div>
  );
}

const FORGE_ACTIONS = [
  { id: "study_guide", label: "Study Guide", icon: "📖" },
  { id: "questions",   label: "Questions",   icon: "❓" },
  { id: "flashcards",  label: "Flashcards",  icon: "🃏" },
  { id: "summary",     label: "Summary",     icon: "📝" },
];

function TheForge({ nb, onClose, onToast }) {
  const [action, setAction]         = useState(null);
  const [topic, setTopic]           = useState("");
  const [content, setContent]       = useState("");
  const [generating, setGenerating] = useState(false);

  // Flashcard state
  const [flashcards, setFlashcards]       = useState(null);
  const [cardIdx, setCardIdx]             = useState(0);
  const [isFlipped, setIsFlipped]         = useState(false);
  const [shuffledOrder, setShuffledOrder] = useState(null);
  const [learned, setLearned]             = useState(new Set());

  // UI
  const [copied, setCopied]             = useState(false);
  const [savedOutputs, setSavedOutputs] = useState([]);
  const [showSaved, setShowSaved]       = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    api.listForgeOutputs(nb.id).then(setSavedOutputs).catch(() => {});
  }, [nb.id]);

  useEffect(() => {
    if (contentRef.current && !flashcards)
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
  }, [content, flashcards]);

  async function autoSave(fullContent, selectedAction) {
    console.log("autoSave called:", { notebookId: nb.id, selectedAction, contentLength: fullContent?.length });
    try {
      console.log("calling api.saveForgeOutput");
      const out = await api.saveForgeOutput(nb.id, selectedAction, fullContent, topic);
      console.log("autoSave succeeded:", out?.id);
      setSavedOutputs(prev => [out, ...prev]);
      onToast?.(`Saved to ${nb.title}`);
    } catch (err) {
      console.error("autoSave failed:", err);
    }
  }

  async function generate(selectedAction) {
    setAction(selectedAction);
    setContent(""); setFlashcards(null);
    setCardIdx(0); setIsFlipped(false); setShuffledOrder(null); setLearned(new Set());
    setGenerating(true);

    let full = "";
    try {
      await api.forge(
        nb.id, selectedAction, topic,
        (chunk) => { full += chunk; /* buffer silently — don't update UI mid-stream */ },
        () => {
          // Reveal content all at once, then auto-save in background
          if (selectedAction === "flashcards") {
            try {
              const m = full.match(/\[[\s\S]*\]/);
              if (m) {
                const cards = JSON.parse(m[0]);
                setFlashcards(cards);
                setShuffledOrder(cards.map((_, i) => i));
              } else { setContent(full); }
            } catch { setContent(full); }
          } else {
            setContent(full);
          }
          setGenerating(false);
          autoSave(full, selectedAction); // fire-and-forget
        },
        (err) => { setContent(`Error: ${err}`); setGenerating(false); }
      );
    } catch (err) {
      setContent(`Error: ${err.message}`);
      setGenerating(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    const label = FORGE_ACTIONS.find(a => a.id === action)?.label ?? action;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${nb.title} - ${label}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeleteSaved(id) {
    try { await api.deleteForgeOutput(id); setSavedOutputs(p => p.filter(o => o.id !== id)); } catch {}
  }

  function loadSaved(o) {
    setAction(o.type); setContent(o.content); setGenerating(false); setShowSaved(false);
    if (o.type === "flashcards") {
      try {
        const m = o.content.match(/\[[\s\S]*\]/);
        if (m) { const cards = JSON.parse(m[0]); setFlashcards(cards); setShuffledOrder(cards.map((_, i) => i)); setCardIdx(0); setIsFlipped(false); setLearned(new Set()); return; }
      } catch {}
    }
    setFlashcards(null);
  }

  // Flashcard navigation
  const currentOrder = shuffledOrder ?? (flashcards?.map((_, i) => i) ?? []);
  const currentCard  = flashcards?.[currentOrder[cardIdx]];
  const totalCards   = flashcards?.length ?? 0;
  const realIdx      = currentOrder[cardIdx];

  function goNext() { if (cardIdx >= totalCards - 1) return; setIsFlipped(false); setTimeout(() => setCardIdx(i => i + 1), 120); }
  function goPrev() { if (cardIdx <= 0) return; setIsFlipped(false); setTimeout(() => setCardIdx(i => i - 1), 120); }
  function handleShuffle() {
    setCardIdx(0); setIsFlipped(false);
    const arr = [...currentOrder];
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    setShuffledOrder(arr);
  }
  function toggleLearned() { setLearned(p => { const n = new Set(p); n.has(realIdx) ? n.delete(realIdx) : n.add(realIdx); return n; }); }

  const showCards = action === "flashcards" && flashcards && !generating;

  return (
    <div style={{
      width: "44%", display: "flex", flexDirection: "column",
      borderLeft: "1px solid rgba(255,255,255,0.06)",
      background: "#0A0A0A",
      paddingLeft: 16, marginLeft: 12,
      height: "100%", minHeight: 0, flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingBottom: 12, marginBottom: 12,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#FAFAFA", fontFamily: FONT }}>The Forge</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setShowSaved(v => !v)}
            style={{
              background: showSaved ? "rgba(167,139,250,0.1)" : "none",
              border: `1px solid ${showSaved ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: 4, padding: "3px 8px", cursor: "pointer",
              fontSize: 10, fontWeight: 500, letterSpacing: "0.06em",
              color: showSaved ? "#A78BFA" : "rgba(255,255,255,0.4)",
              fontFamily: FONT, transition: "all 0.1s",
            }}
            onMouseEnter={e => { if (!showSaved) { e.currentTarget.style.color = "#FAFAFA"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}}
            onMouseLeave={e => { if (!showSaved) { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}}
          >SAVED{savedOutputs.length > 0 ? ` (${savedOutputs.length})` : ""}</button>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1, padding: "2px 4px",
            transition: "color 0.1s",
          }}
            onMouseEnter={e => e.currentTarget.style.color = "#FAFAFA"}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}
          >✕</button>
        </div>
      </div>

      {/* Saved outputs panel */}
      {showSaved && (
        <div style={{
          background: "#111111", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 6, padding: "4px", marginBottom: 12,
          maxHeight: 180, overflowY: "auto",
        }}>
          {savedOutputs.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: FONT, padding: "10px 8px", textAlign: "center" }}>No saved outputs yet</div>
          ) : savedOutputs.map(o => {
            const typeIcon = { study_guide: "📖", questions: "❓", flashcards: "🃏", summary: "📝" }[o.type] ?? "📄";
            return (
              <div key={o.id} className="forge-saved-item">
                <span style={{ fontSize: 14, flexShrink: 0 }}>{typeIcon}</span>
                <div onClick={() => loadSaved(o)} style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#FAFAFA", fontFamily: FONT, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.title}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: MONO, marginTop: 2 }}>{new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                </div>
                <button className="forge-del" onClick={e => { e.stopPropagation(); handleDeleteSaved(o.id); }}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Action buttons — 2×2 grid */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {FORGE_ACTIONS.map(a => (
          <button
            key={a.id}
            onClick={() => generate(a.id)}
            disabled={generating}
            className={`forge-action-btn${action === a.id ? " forge-active" : ""}`}
          >
            <div style={{ fontSize: 18, lineHeight: 1 }}>{a.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 500, fontFamily: FONT }}>{a.label}</div>
          </button>
        ))}
      </div>

      {/* Topic input */}
      <input
        value={topic}
        onChange={e => setTopic(e.target.value)}
        onKeyDown={e => e.key === "Enter" && action && !generating && generate(action)}
        placeholder="Focus on a specific topic (optional)"
        disabled={generating}
        className="forge-topic-input"
        style={{
          width: "100%", background: "#111111",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 6, padding: "0 12px",
          height: 36,
          color: "#FAFAFA", fontSize: 13,
          fontFamily: FONT,
          outline: "none", marginBottom: 10,
          boxSizing: "border-box",
          transition: "border-color 0.1s",
        }}
      />

      {/* ── Flashcard view ── */}
      {showCards && currentCard ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: MONO }}>{cardIdx + 1} / {totalCards}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "center", margin: "0 8px" }}>{nb.title}</div>
            <div style={{ fontSize: 11, color: learned.size > 0 ? "#4ADE80" : "rgba(255,255,255,0.2)", fontFamily: MONO, flexShrink: 0 }}>{learned.size}/{totalCards}</div>
          </div>

          <div style={{ perspective: "1400px", cursor: "pointer", flex: 1, minHeight: 0 }} onClick={() => setIsFlipped(f => !f)}>
            <div className={`forge-card${isFlipped ? " flipped" : ""}`} style={{ width: "100%", height: "100%", position: "relative", minHeight: 160 }}>
              <div className="forge-face" style={{ position: "absolute", inset: 0, background: "#111111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
                <div style={{ fontSize: 14, color: "#FAFAFA", textAlign: "center", lineHeight: 1.6, fontFamily: FONT, fontWeight: 500 }}>{currentCard.question}</div>
                <div style={{ position: "absolute", bottom: 10, fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: MONO, letterSpacing: "0.06em" }}>CLICK TO FLIP</div>
              </div>
              <div className="forge-face forge-back" style={{ position: "absolute", inset: 0, background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
                <div style={{ fontSize: 13, color: "#A78BFA", textAlign: "center", lineHeight: 1.6, fontFamily: FONT }}>{currentCard.answer}</div>
                <div style={{ position: "absolute", bottom: 10, fontSize: 10, color: "rgba(167,139,250,0.3)", fontFamily: MONO, letterSpacing: "0.06em" }}>CLICK TO FLIP BACK</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 }}>
            <button onClick={goPrev} disabled={cardIdx === 0} style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "6px 14px", color: cardIdx === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)", cursor: cardIdx === 0 ? "not-allowed" : "pointer", fontSize: 14, transition: "all 0.1s" }}>←</button>
            <button onClick={handleShuffle} title="Shuffle" style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "6px 10px", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 12, transition: "all 0.1s" }}
              onMouseEnter={e => e.currentTarget.style.color = "#A78BFA"} onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}>⇄</button>
            <button onClick={toggleLearned} style={{ background: learned.has(realIdx) ? "rgba(74,222,128,0.08)" : "#111111", border: `1px solid ${learned.has(realIdx) ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.06)"}`, borderRadius: 6, padding: "6px 10px", color: learned.has(realIdx) ? "#4ADE80" : "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 11, fontFamily: FONT, fontWeight: 500, transition: "all 0.1s", whiteSpace: "nowrap" }}>
              {learned.has(realIdx) ? "✓ Learned" : "Mark learned"}
            </button>
            <button onClick={goNext} disabled={cardIdx === totalCards - 1} style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "6px 14px", color: cardIdx === totalCards - 1 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)", cursor: cardIdx === totalCards - 1 ? "not-allowed" : "pointer", fontSize: 14, transition: "all 0.1s" }}>→</button>
          </div>
        </div>

      ) : (
        <>
          <div ref={contentRef} style={{
            flex: 1, overflowY: "auto", minHeight: 240,
            background: "#0A0A0A",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 6,
            padding: "16px",
            fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6,
            fontFamily: FONT, whiteSpace: "pre-wrap",
          }}>
            {!action && !content && (
              <div style={{ textAlign: "center", paddingTop: 40 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.2)", marginBottom: 8, fontFamily: FONT }}>The Forge</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", lineHeight: 1.6 }}>Pick a type above to generate study content.</div>
              </div>
            )}
            {generating && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, minHeight: 200 }}>
                <div className="forge-spinner" />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: FONT }}>Generating…</span>
              </div>
            )}
            {!generating && content && <span>{content}</span>}
          </div>

          {content && !generating && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button onClick={handleCopy} style={{ flex: 1, background: "#111111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "7px", color: copied ? "#4ADE80" : "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontFamily: FONT, transition: "all 0.1s" }}
                onMouseEnter={e => { if (!copied) { e.currentTarget.style.color = "#A78BFA"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.3)"; }}}
                onMouseLeave={e => { if (!copied) { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}}
              >{copied ? "✓ Copied" : "Copy"}</button>
              <button onClick={handleDownload} style={{ flex: 1, background: "#111111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "7px", color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontFamily: FONT, transition: "all 0.1s" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#A78BFA"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.3)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}>Download</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NotebookView({ nb, onBack, onDeleted, currentUserId, onToast }) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [members, setMembers]       = useState([]);
  const [showForge, setShowForge]   = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    api.listMembers(nb.id).then(setMembers).catch(() => {});
  }, [nb.id]);

  // Load persistent chat history from backend on open
  useEffect(() => {
    api.getMessages(nb.id)
      .then(rows => {
        if (rows.length > 0) {
          setMessages(rows.map(r => ({ id: r.id, role: r.role, text: r.content, createdBy: r.created_by })));
        } else {
          // First-ever open: show the welcome message (don't persist it)
          setMessages([{ role: "assistant", text: `Hey! I've read all the notes in this notebook. Ask me anything about ${nb.title}.` }]);
        }
        setHistoryLoaded(true);
      })
      .catch(() => {
        // Fallback to welcome message if fetch fails
        setMessages([{ role: "assistant", text: `Hey! I've read all the notes in this notebook. Ask me anything about ${nb.title}.` }]);
        setHistoryLoaded(true);
      });
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

  // Surface note list in chat only when there's no prior history (first open)
  useEffect(() => {
    if (!historyLoaded) return;
    // If there's already a real conversation (more than the welcome placeholder), skip
    const hasHistory = messages.some(m => m.id);
    if (hasHistory) return;

    api.listNotes(nb.id).then(notes => {
      if (notes.length === 0) return;
      const list = notes.map(n => `• ${n.title}`).join("\n");
      setMessages(m => [...m, {
        role: "assistant",
        text: `📚 ${notes.length} note${notes.length !== 1 ? "s" : ""} in this notebook:\n${list}\n\nAsk me anything about them!`,
      }]);
    }).catch(() => {});
  }, [historyLoaded]);

  // Debug: log messages and currentUserId whenever they change
  useEffect(() => {
    console.log("currentUserId prop:", currentUserId);
    console.log("rendering messages:", messages.map(m => ({ role: m.role, createdBy: m.createdBy, text: m.text?.slice(0, 40) })));
  }, [messages, currentUserId]);

  // Scroll to latest message whenever messages or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function ask() {
    const text = query.trim();
    if (!text || loading) return;

    setQuery("");
    setLoading(true);

    // Optimistically show the user message immediately
    setMessages(m => [...m, { role: "user", text, createdBy: currentUserId }]);

    // Persist the user message (fire-and-forget; don't block the AI call)
    console.log("calling addMessage:", { notebookId: nb.id, role: "user", content: text });
    api.addMessage(nb.id, "user", text)
      .catch(err => console.error("addMessage failed (user):", err));

    try {
      const data = await api.query(nb.id, text);
      if (data.error) throw new Error(data.error);
      setMessages(m => [...m, { role: "assistant", text: data.answer, createdBy: null }]);
      // Persist the assistant reply
      console.log("calling addMessage:", { notebookId: nb.id, role: "assistant", content: data.answer.slice(0, 80) });
      api.addMessage(nb.id, "assistant", data.answer)
        .catch(err => console.error("addMessage failed (assistant):", err));
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0, overflow: "hidden" }}>
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
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000, padding: 16,
        }}>
          <div style={{
            background: "#111111", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6, width: "100%", maxWidth: 380,
            padding: "24px", boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
            animation: "fadeIn 0.15s ease",
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#FAFAFA", fontFamily: FONT, marginBottom: 8 }}>
              Delete this notebook?
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontFamily: FONT, marginBottom: 20, lineHeight: 1.5 }}>
              <strong style={{ color: "#FAFAFA" }}>{nb.title}</strong> and all its notes will be permanently deleted.
            </div>
            {deleteError && (
              <div style={{
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6,
                padding: "8px 12px", marginBottom: 16,
                fontSize: 12, color: "#EF4444", fontFamily: FONT,
              }}>{deleteError}</div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setConfirmDelete(false); setDeleteError(""); }}
                disabled={deleting}
                style={{
                  background: "transparent", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 6, padding: "0 16px", height: 32, color: "rgba(255,255,255,0.6)",
                  fontSize: 13, cursor: "pointer", fontFamily: FONT,
                  opacity: deleting ? 0.5 : 1, transition: "all 0.1s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#FAFAFA"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
              >Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  background: "#EF4444", border: "none",
                  borderRadius: 6, padding: "0 16px", height: 32, color: "#fff",
                  fontWeight: 500, fontSize: 13, cursor: deleting ? "not-allowed" : "pointer",
                  fontFamily: FONT, opacity: deleting ? 0.6 : 1, transition: "opacity 0.1s",
                }}
              >{deleting ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
        paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)",
          borderRadius: 6, padding: "0 12px", height: 32, cursor: "pointer",
          fontFamily: FONT, fontSize: 12, transition: "all 0.1s",
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#FAFAFA"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
        >← Back</button>
        <button
          onClick={() => setConfirmDelete(true)}
          title="Delete notebook"
          style={{
            background: "transparent", border: "1px solid rgba(239,68,68,0.15)", color: "rgba(239,68,68,0.5)",
            borderRadius: 6, padding: "0 10px", height: 32, cursor: "pointer",
            fontFamily: FONT, fontSize: 13, transition: "all 0.1s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; e.currentTarget.style.color = "#EF4444"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.15)"; e.currentTarget.style.color = "rgba(239,68,68,0.5)"; }}
        >🗑</button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#FAFAFA", fontFamily: FONT, letterSpacing: "-0.01em" }}>{nb.title}</div>
          {nb.topic && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: FONT }}>{nb.topic}</div>}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => setShowForge(f => !f)}
            title="Toggle The Forge"
            style={{
              background: showForge ? "rgba(167,139,250,0.1)" : "transparent",
              border: `1px solid ${showForge ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: 6, padding: "0 12px", height: 32, cursor: "pointer",
              fontFamily: FONT, fontSize: 12,
              color: showForge ? "#A78BFA" : "rgba(255,255,255,0.5)",
              fontWeight: 500, transition: "all 0.1s",
            }}
            onMouseEnter={e => { if (!showForge) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#FAFAFA"; }}}
            onMouseLeave={e => { if (!showForge) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}}
          >Forge</button>
          <button
            onClick={() => setShowUpload(true)}
            style={{
              background: "transparent", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 6, padding: "0 12px", height: 32, cursor: "pointer",
              fontFamily: FONT, fontSize: 12,
              color: "rgba(255,255,255,0.5)", fontWeight: 500, transition: "all 0.1s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#FAFAFA"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
          >Upload</button>
          <button
            onClick={() => setShowInvite(true)}
            title="Invite collaborators"
            style={{
              background: "transparent", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 6, padding: "0 12px", height: 32, cursor: "pointer",
              fontFamily: FONT, fontSize: 12,
              color: "rgba(255,255,255,0.5)", fontWeight: 500, transition: "all 0.1s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#FAFAFA"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
          >Invite</button>
          {members.length > 0 && <MemberAvatarStack members={members} />}
        </div>
      </div>

      {/* Chat + Forge split */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 0 }}>
      {/* Chat column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

      {/* Message list */}
      <div style={{
        flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
        gap: 8, marginBottom: 12,
      }}>
        {messages.map((m, i) => {
          console.log("message:", { role: m.role, createdBy: m.createdBy, currentUserId, text: m.text?.slice(0, 40) });
          const isOwn = m.role === "user" && (m.createdBy === currentUserId || (!m.createdBy && m.role === "user"));
          const isOtherMember = m.role === "user" && m.createdBy && m.createdBy !== currentUserId;
          const isAssistant = m.role === "assistant";

          const senderInfo = isOtherMember ? members.find(mem => mem.user_id === m.createdBy) : null;
          const senderLabel = isAssistant
            ? "Derek"
            : isOtherMember
              ? (senderInfo?.first_name?.trim() || senderInfo?.email?.split("@")[0] || "Member")
              : null;

          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" }}>
              {senderLabel && (
                <div style={{
                  fontSize: 10, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase",
                  color: isAssistant ? "#A78BFA" : "rgba(255,255,255,0.4)",
                  fontFamily: FONT, marginBottom: 4,
                }}>
                  {senderLabel}
                </div>
              )}
              <div style={{
                maxWidth: "72%",
                background: m.isError
                  ? "rgba(239,68,68,0.08)"
                  : isOwn
                    ? "#A78BFA"
                    : "#111111",
                color: m.isError ? "#EF4444" : "#FAFAFA",
                borderRadius: 6,
                padding: "10px 12px",
                fontSize: 13, lineHeight: 1.6,
                fontFamily: FONT,
                border: !isOwn ? `1px solid ${m.isError ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}` : "none",
                whiteSpace: "pre-wrap",
                animation: isOwn
                  ? "slideInUp 150ms ease both"
                  : "slideInLeft 150ms ease both",
              }}>
                {m.text}
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <div style={{
              fontSize: 10, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase",
              color: "#A78BFA", fontFamily: FONT, marginBottom: 4,
            }}>Derek</div>
            <div style={{
              background: "#111111", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 6, padding: "10px 14px",
              display: "flex", gap: 5, alignItems: "center",
              animation: "slideInLeft 150ms ease both",
            }}>
              <span style={{
                fontSize: 12, color: "rgba(255,255,255,0.35)", fontStyle: "italic",
                fontFamily: FONT, marginRight: 4,
              }}>Derek is thinking…</span>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.3)",
                  animation: `pulse 1s ease-in-out ${i * 0.2}s infinite`,
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
            flex: 1, background: "#111111", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 6, padding: "0 12px", height: 44,
            color: "#FAFAFA", fontSize: 13, fontFamily: FONT,
            outline: "none", transition: "border-color 0.1s",
          }}
          onFocus={e => e.target.style.borderColor = "#A78BFA"}
          onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
        />
        <button
          onClick={ask}
          disabled={loading || !query.trim()}
          style={{
            background: "#A78BFA", border: "none", borderRadius: 6,
            padding: "0 16px", height: 44, fontSize: 15, fontWeight: 500,
            color: "#fff", transition: "background 0.1s",
            cursor: loading || !query.trim() ? "not-allowed" : "pointer",
            opacity: loading || !query.trim() ? 0.4 : 1,
          }}
          onMouseEnter={e => { if (!loading && query.trim()) e.currentTarget.style.background = "#7C3AED"; }}
          onMouseLeave={e => e.currentTarget.style.background = "#A78BFA"}
        >
          {loading ? "…" : "↑"}
        </button>
      </div>

      </div>{/* end chat column */}

      {/* Forge panel */}
      {showForge && (
        <TheForge nb={nb} onClose={() => setShowForge(false)} onToast={onToast} />
      )}

      </div>{/* end chat+forge split */}
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
    width: "100%", background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 6, padding: "0 12px", height: 36, color: "#FAFAFA", fontSize: 13,
    fontFamily: FONT, outline: "none", transition: "border-color 0.1s",
  };
  const label = {
    fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: FONT,
    letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6,
    fontWeight: 500,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#111111", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6, width: "100%", maxWidth: 420,
        padding: "24px", boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
        animation: "fadeIn 0.15s ease",
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#FAFAFA", fontFamily: FONT, marginBottom: 4, letterSpacing: "-0.01em" }}>
          Set a new password
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 20, fontFamily: FONT, lineHeight: 1.5 }}>
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
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
            />
          </div>
          <div>
            <label style={label}>Confirm password</label>
            <input
              type="password" required
              value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Same password again" style={inputBase}
              onFocus={e => e.target.style.borderColor = "#A78BFA"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
            />
          </div>
          {error && (
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6,
              padding: "8px 12px", fontSize: 12, color: "#EF4444", fontFamily: FONT,
            }}>{error}</div>
          )}
          <button type="submit" disabled={loading} style={{
            width: "100%", background: "#A78BFA", border: "none", borderRadius: 6,
            height: 36, color: "#fff", fontWeight: 500, fontSize: 13,
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: FONT, opacity: loading ? 0.6 : 1, marginTop: 4, transition: "opacity 0.1s",
          }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#7C3AED"; }}
            onMouseLeave={e => e.currentTarget.style.background = "#A78BFA"}
          >
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
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#111111", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6, width: "100%", maxWidth: 400,
        padding: "24px", boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
        animation: "fadeIn 0.15s ease",
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#FAFAFA", fontFamily: FONT, marginBottom: 6 }}>
          Delete your account?
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: FONT, marginBottom: 20, lineHeight: 1.5 }}>
          All notebooks, notes, and data will be <span style={{ color: "#EF4444" }}>permanently deleted</span>. This cannot be undone.
        </div>

        <form onSubmit={handleConfirm} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{
              fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: FONT,
              letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6, fontWeight: 500,
            }}>
              Type <span style={{ color: "#EF4444", letterSpacing: "0.08em" }}>DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder="DELETE"
              autoFocus
              spellCheck={false}
              style={{
                width: "100%", background: "#0A0A0A",
                border: `1px solid ${confirmed ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 6, padding: "0 12px", height: 36,
                color: confirmed ? "#EF4444" : "#FAFAFA",
                fontSize: 13, fontFamily: MONO,
                outline: "none", transition: "border-color 0.1s, color 0.1s",
                letterSpacing: "0.08em",
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 6, padding: "8px 12px",
              fontSize: 12, color: "#EF4444", fontFamily: FONT,
            }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                background: "transparent", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6, padding: "0 16px", height: 32, color: "rgba(255,255,255,0.6)",
                fontSize: 13, cursor: "pointer", fontFamily: FONT,
                opacity: loading ? 0.5 : 1, transition: "all 0.1s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#FAFAFA"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            >Cancel</button>
            <button
              type="submit"
              disabled={!confirmed || loading}
              style={{
                background: confirmed ? "#EF4444" : "#1A1A1A",
                border: `1px solid ${confirmed ? "#EF4444" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 6, padding: "0 16px", height: 32,
                color: confirmed ? "#fff" : "rgba(255,255,255,0.2)",
                fontWeight: 500, fontSize: 13,
                cursor: confirmed && !loading ? "pointer" : "not-allowed",
                fontFamily: FONT, transition: "all 0.1s",
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
        padding: "0 12px", height: 44,
        background: hovered ? "#1A1A1A" : "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: "pointer", transition: "background 0.1s",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 400, color: "#FAFAFA", fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {unit.title}
        </div>
        {unit.topic && (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: FONT }}>{unit.topic}</div>
        )}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: MONO, flexShrink: 0 }}>
        {unit.notes}
      </div>
      {hovered && <div style={{ fontSize: 11, color: "#A78BFA", flexShrink: 0 }}>→</div>}
    </div>
  );
}

function ConfirmDeleteClassModal({ cls, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setLoading(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#111111", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6, width: "100%", maxWidth: 380,
        padding: "24px", boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
        animation: "fadeIn 0.15s ease",
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#FAFAFA", fontFamily: FONT, marginBottom: 6 }}>
          Delete "{cls.title}"?
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: FONT, lineHeight: 1.5, marginBottom: 20 }}>
          All units and notes inside will be permanently deleted.
        </div>
        {error && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#EF4444", fontFamily: FONT, marginBottom: 16 }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button" onClick={onClose}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "0 16px", height: 32, color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", fontFamily: FONT, transition: "all 0.1s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#FAFAFA"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
          >Cancel</button>
          <button
            type="button" onClick={handleConfirm} disabled={loading}
            style={{ background: "#EF4444", border: "none", borderRadius: 6, padding: "0 16px", height: 32, color: "#fff", fontWeight: 500, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", fontFamily: FONT, opacity: loading ? 0.6 : 1, transition: "opacity 0.1s" }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#DC2626"; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#EF4444"; }}
          >{loading ? "Deleting…" : "Delete class"}</button>
        </div>
      </div>
    </div>
  );
}

function ClassCard({ cls, expanded, units, onToggle, onOpenUnit, onNewUnit, onDeleteClass }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{
      background: "#111111",
      border: `1px solid ${expanded ? "rgba(255,255,255,0.12)" : hovered ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)"}`,
      borderLeft: expanded ? "2px solid #A78BFA" : `2px solid ${hovered ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 6, overflow: "hidden",
      transition: "border-color 0.1s",
    }}>
      <div
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: "0 12px", height: 44, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 10,
          background: hovered ? "#1A1A1A" : "transparent",
          transition: "background 0.1s",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#FAFAFA", fontFamily: FONT, letterSpacing: "-0.01em" }}>
            {cls.title}
          </div>
        </div>

        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: MONO, flexShrink: 0 }}>
          {units === null ? "" : `${units.length} unit${units.length !== 1 ? "s" : ""}`}
        </div>

        {onDeleteClass && (
          <button
            onClick={e => { e.stopPropagation(); onDeleteClass(); }}
            title="Delete class"
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "2px 4px", fontSize: 12,
              color: "rgba(255,255,255,0.3)", opacity: hovered ? 1 : 0,
              transition: "opacity 0.1s, color 0.1s", flexShrink: 0,
            }}
            onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = "#EF4444"; }}
            onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
          >✕</button>
        )}

        <div style={{
          fontSize: 9, color: expanded ? "#A78BFA" : "rgba(255,255,255,0.3)",
          transition: "transform 0.15s, color 0.1s",
          transform: expanded ? "rotate(90deg)" : "none", flexShrink: 0,
        }}>▶</div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {units === null ? (
            <div style={{ padding: "12px 16px", fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: FONT }}>Loading…</div>
          ) : units.length === 0 ? (
            <div style={{ padding: "12px 16px", fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: FONT }}>No units yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {units.map(unit => (
                <UnitRow key={unit.id} unit={unit} color={cls.color} onClick={() => onOpenUnit(unit)} />
              ))}
            </div>
          )}
          <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <button
              onClick={onNewUnit}
              style={{
                width: "100%", background: "transparent",
                border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 6,
                padding: "7px", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 500,
                cursor: "pointer", fontFamily: FONT, transition: "all 0.1s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(167,139,250,0.3)"; e.currentTarget.style.color = "#A78BFA"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
            >+ New Unit</button>
          </div>
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
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#111111", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6, width: "100%", maxWidth: 420,
        padding: "24px", boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
        animation: "fadeIn 0.15s ease",
      }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#FAFAFA", fontFamily: FONT, marginBottom: 4, letterSpacing: "-0.01em" }}>New Class</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: FONT }}>A class holds your units and notes for one course</div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. AP World History" maxLength={80}
            style={{ width: "100%", background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "0 12px", height: 36, color: "#FAFAFA", fontSize: 13, fontFamily: FONT, outline: "none", transition: "border-color 0.1s" }}
            onFocus={e => e.target.style.borderColor = "#A78BFA"}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
          />
          {error && <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#EF4444", fontFamily: FONT }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "0 16px", height: 32, color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", fontFamily: FONT, transition: "all 0.1s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#FAFAFA"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            >Cancel</button>
            <button type="submit" disabled={loading || !title.trim()} style={{ background: "#A78BFA", border: "none", borderRadius: 6, padding: "0 16px", height: 32, color: "#fff", fontWeight: 500, fontSize: 13, cursor: loading || !title.trim() ? "not-allowed" : "pointer", fontFamily: FONT, opacity: loading || !title.trim() ? 0.45 : 1, transition: "background 0.1s, opacity 0.1s" }}
              onMouseEnter={e => { if (!loading && title.trim()) e.currentTarget.style.background = "#7C3AED"; }}
              onMouseLeave={e => e.currentTarget.style.background = "#A78BFA"}
            >{loading ? "Creating…" : "Create Class"}</button>
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

  const inp = { width: "100%", background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "0 12px", height: 36, color: "#FAFAFA", fontSize: 13, fontFamily: FONT, outline: "none", transition: "border-color 0.1s" };
  const lbl = { fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: FONT, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6, fontWeight: 500 };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#111111", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6, width: "100%", maxWidth: 420,
        padding: "24px", boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
        animation: "fadeIn 0.15s ease",
      }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#FAFAFA", fontFamily: FONT, marginBottom: 4, letterSpacing: "-0.01em" }}>New Unit</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: FONT }}>Adding to <span style={{ color: "#A78BFA" }}>{classTitle}</span></div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={lbl}>Unit name *</label>
            <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Unit 5 — Revolutions" maxLength={80} style={inp} onFocus={e => e.target.style.borderColor = "#A78BFA"} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.06)"} />
          </div>
          <div>
            <label style={lbl}>Topic / description</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Industrial Revolution, causes and effects" maxLength={120} style={inp} onFocus={e => e.target.style.borderColor = "#A78BFA"} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.06)"} />
          </div>
          {error && <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#EF4444", fontFamily: FONT }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "0 16px", height: 32, color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", fontFamily: FONT, transition: "all 0.1s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#FAFAFA"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            >Cancel</button>
            <button type="submit" disabled={loading || !title.trim()} style={{ background: "#A78BFA", border: "none", borderRadius: 6, padding: "0 16px", height: 32, color: "#fff", fontWeight: 500, fontSize: 13, cursor: loading || !title.trim() ? "not-allowed" : "pointer", fontFamily: FONT, opacity: loading || !title.trim() ? 0.45 : 1, transition: "background 0.1s, opacity 0.1s" }}
              onMouseEnter={e => { if (!loading && title.trim()) e.currentTarget.style.background = "#7C3AED"; }}
              onMouseLeave={e => e.currentTarget.style.background = "#A78BFA"}
            >{loading ? "Creating…" : "Create Unit"}</button>
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
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#111111", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6, width: "100%", maxWidth: 420,
        padding: "24px", boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
        animation: "fadeIn 0.15s ease",
      }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#FAFAFA", fontFamily: FONT, marginBottom: 4, letterSpacing: "-0.01em" }}>Invite a collaborator</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: FONT }}>They'll get an email with a link to join this unit</div>
        </div>

        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 20, marginBottom: 8, color: "#4ADE80" }}>✓</div>
            <div style={{ fontSize: 13, color: "#4ADE80", fontFamily: FONT, fontWeight: 500 }}>
              Invite sent to {sentTo}!
            </div>
          </div>
        ) : (
          <>
            <input
              type="email"
              placeholder="friend@school.edu"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); setStatus("idle"); }}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              autoFocus
              style={{
                width: "100%", background: "#0A0A0A",
                border: `1px solid ${error ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 6, padding: "0 12px", height: 36, color: "#FAFAFA",
                fontSize: 13, fontFamily: FONT,
                outline: "none", boxSizing: "border-box", marginBottom: 8,
                transition: "border-color 0.1s",
              }}
              onFocus={e => { if (!error) e.target.style.borderColor = "#A78BFA"; }}
              onBlur={e => { if (!error) e.target.style.borderColor = "rgba(255,255,255,0.06)"; }}
            />
            {error && (
              <div style={{ fontSize: 12, color: "#EF4444", fontFamily: FONT, marginBottom: 8 }}>{error}</div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={{
                background: "transparent", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6, padding: "0 16px", height: 32, color: "rgba(255,255,255,0.6)", fontSize: 13,
                cursor: "pointer", fontFamily: FONT, transition: "all 0.1s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#FAFAFA"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
              >Cancel</button>
              <button
                onClick={handleSend}
                disabled={status === "sending"}
                style={{
                  background: "#A78BFA", border: "none", borderRadius: 6,
                  padding: "0 16px", height: 32, color: "#fff", fontWeight: 500, fontSize: 13,
                  cursor: status === "sending" ? "not-allowed" : "pointer",
                  fontFamily: FONT, opacity: status === "sending" ? 0.6 : 1,
                  transition: "background 0.1s, opacity 0.1s",
                }}
                onMouseEnter={e => { if (status !== "sending") e.currentTarget.style.background = "#7C3AED"; }}
                onMouseLeave={e => e.currentTarget.style.background = "#A78BFA"}
              >{status === "sending" ? "Sending…" : "Send Invite"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InviteLanding({ inviteInfo, onSignIn }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#0A0A0A",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 16, padding: 32, fontFamily: FONT,
    }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: "#FAFAFA", letterSpacing: "-0.02em" }}>
        schol<span style={{ color: "#A78BFA" }}>r</span>
      </div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", textAlign: "center" }}>
        You've been invited to join a unit
      </div>
      {inviteInfo ? (
        <div style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "16px 24px", textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#FAFAFA", fontFamily: FONT, marginBottom: 4 }}>{inviteInfo.notebook_title}</div>
          {inviteInfo.class_title && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>in {inviteInfo.class_title}</div>}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Loading invite info…</div>
      )}
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>Sign in or create an account to join</div>
      <button
        onClick={onSignIn}
        style={{
          background: "#A78BFA", border: "none", borderRadius: 6,
          padding: "0 24px", height: 36, color: "#fff", fontWeight: 500,
          fontSize: 13, cursor: "pointer", fontFamily: FONT,
          transition: "background 0.1s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "#7C3AED"; }}
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
  const [notebooks, setNotebooks] = useState([]);          // all memberships (used as base)
  const [ownedNotebooks, setOwnedNotebooks] = useState([]);   // notebooks user created
  const [sharedNotebooks, setSharedNotebooks] = useState([]); // notebooks user was invited to
  const [starredNotebooks, setStarredNotebooks] = useState([]); // starred by user
  const [starredIds, setStarredIds] = useState(new Set());    // Set<notebookId> for O(1) lookup
  const [notifications, setNotifications] = useState([]);     // unread notifications for dashboard
  const [classes, setClasses] = useState([]);              // class folders for dashboard
  const [expandedClassId, setExpandedClassId] = useState(null);
  const [classUnitsCache, setClassUnitsCache] = useState({}); // { classId: unit[] }
  const [showNewClassModal, setShowNewClassModal] = useState(false);
  const [newUnitFor, setNewUnitFor] = useState(null);      // { classId, classTitle }
  const [toast, setToast] = useState("");
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteClassTarget, setDeleteClassTarget] = useState(null); // cls object to confirm-delete
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
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
    // Force a session refresh so the JWT in the Supabase client is current
    // before we make any authenticated API calls (guards against a race
    // where onAuth fires before the token is stored in the client).
    supabase.auth.getSession()
      .then(() => api.acceptInvite(token))
      .then(({ notebook_id }) => {
        console.log("[invite] accepted, fetching shared notebooks after invite accept");
        return Promise.all([
          api.listNotebooks(getDisplayName(user)),
          api.listSharedNotebooks(getDisplayName(user)),
        ]).then(([nbs, shared]) => {
          console.log("[invite] listSharedNotebooks returned", shared.length, "notebooks");
          setNotebooks(nbs);
          setSharedNotebooks(shared);
          const nb = shared.find(n => n.id === notebook_id) ?? nbs.find(n => n.id === notebook_id);
          if (nb) { setActiveNb(nb); setActiveView("dashboard"); }
        });
      })
      .catch(console.error);
  }, [pendingInviteToken, user, authReady]);

  // Only fetch data once auth is fully confirmed (authReady prevents JWT-empty race)
  useEffect(() => {
    if (!user || !authReady) return;
    const name = getDisplayName(user);
    api.listNotebooks(name).then(setNotebooks).catch(console.error);
    api.listOwnedNotebooks(name).then(setOwnedNotebooks).catch(console.error);
    console.log("[shared] fetching shared notebooks on auth ready");
    api.listSharedNotebooks(name)
      .then(shared => { console.log("[shared] listSharedNotebooks returned", shared.length, "notebooks"); setSharedNotebooks(shared); })
      .catch(err => { console.error("[shared] listSharedNotebooks error:", err); });
    api.getStarredNotebooks(name)
      .then(starred => {
        setStarredNotebooks(starred);
        setStarredIds(new Set(starred.map(n => n.id)));
      })
      .catch(console.error);
    api.listClasses().then(setClasses).catch(console.error);
    api.getNotifications().then(setNotifications).catch(console.error);
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

  async function handleToggleStar(nb) {
    console.log("star clicked:", nb.id, "currently starred:", starredIds.has(nb.id));
    const isStarred = starredIds.has(nb.id);
    // Optimistic update
    setStarredIds(prev => { const next = new Set(prev); isStarred ? next.delete(nb.id) : next.add(nb.id); return next; });
    setStarredNotebooks(prev => isStarred ? prev.filter(n => n.id !== nb.id) : [...prev, nb]);
    console.log("calling toggleStar with:", nb.id);
    try {
      const { starred } = await api.toggleStar(nb.id);
      console.log("toggleStar response:", { starred });
      // Sync to actual server result
      setStarredIds(prev => { const next = new Set(prev); starred ? next.add(nb.id) : next.delete(nb.id); return next; });
      if (!starred) setStarredNotebooks(prev => prev.filter(n => n.id !== nb.id));
    } catch (err) {
      console.error("star toggle failed:", err);
      // Revert on failure
      setStarredIds(prev => { const next = new Set(prev); isStarred ? next.add(nb.id) : next.delete(nb.id); return next; });
      setStarredNotebooks(prev => isStarred ? [...prev, nb] : prev.filter(n => n.id !== nb.id));
    }
  }

  async function handleDeleteClass(classId) {
    await api.deleteClass(classId);
    setClasses(prev => prev.filter(c => c.id !== classId));
    setClassUnitsCache(prev => { const next = { ...prev }; delete next[classId]; return next; });
    if (expandedClassId === classId) setExpandedClassId(null);
    setToast("Class deleted");
    setTimeout(() => setToast(""), 3000);
  }

  async function handleDeleteAccount() {
    await api.deleteAccount();
    localStorage.clear();
    await supabase.auth.signOut();
    setUser(null); setNotebooks([]); setOwnedNotebooks([]); setSharedNotebooks([]);
    setStarredNotebooks([]); setStarredIds(new Set()); setNotifications([]);
    setClasses([]); setClassUnitsCache({});
    setActiveNb(null); setActiveView("dashboard");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null); setActiveNb(null); setNotebooks([]); setOwnedNotebooks([]);
    setSharedNotebooks([]); setStarredNotebooks([]); setStarredIds(new Set());
    setNotifications([]); setClasses([]); setClassUnitsCache({}); setActiveView("dashboard");
  }

  const displayName = getDisplayName(user);

  // Dashboard: filter classes by search
  const filteredClasses = classes.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  // My Notes / Shared / Starred: pick the right source list
  const viewBase = activeView === "my-notes" ? ownedNotebooks
    : activeView === "shared"   ? sharedNotebooks
    : activeView === "starred"  ? starredNotebooks
    : notebooks;

  const filtered = viewBase.filter(n => {
    const q = search.toLowerCase();
    return n.title.toLowerCase().includes(q) || (n.topic || "").toLowerCase().includes(q);
  });

  const viewLabel = NAV.find(n => n.id === activeView)?.label ?? "Dashboard";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A0A0A; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-3px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {pendingInviteToken && authReady && !user && (
        <InviteLanding inviteInfo={inviteInfo} onSignIn={() => setShowInviteAuth(true)} />
      )}

      {authReady && !user && !showPasswordReset && !pendingInviteToken && !showAuth && (
        <LandingPage onSignIn={() => setShowAuth(true)} />
      )}

      {authReady && !user && !showPasswordReset && (showAuth || showInviteAuth) && (
        <AuthModal onAuth={(u) => { setShowAuth(false); setShowInviteAuth(false); setUser(u); }} />
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

      {deleteClassTarget && (
        <ConfirmDeleteClassModal
          cls={deleteClassTarget}
          onClose={() => setDeleteClassTarget(null)}
          onConfirm={() => handleDeleteClass(deleteClassTarget.id)}
        />
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#111111", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 6, padding: "0 16px", height: 36,
          fontSize: 13, color: "#4ADE80", fontWeight: 500,
          fontFamily: FONT,
          boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          zIndex: 2000, animation: "fadeIn 0.15s ease",
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

      {/* Dashboard — only rendered when authenticated */}
      <div style={{
        height: "100vh", overflow: "hidden", background: "#0A0A0A",
        display: user ? "flex" : "none", fontFamily: FONT,
      }}>
        {/* Sidebar */}
        <div style={{
          width: 240, background: "#0A0A0A",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          padding: "24px 12px", display: "flex", flexDirection: "column", gap: 2,
          flexShrink: 0, height: "100vh", overflowY: "auto",
          position: "sticky", top: 0,
        }}>
          <div style={{
            fontSize: 18, fontWeight: 600,
            color: "#FAFAFA", marginBottom: 24, paddingLeft: 8, letterSpacing: "-0.02em",
            fontFamily: FONT,
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
                  padding: "0 12px", height: 34, borderRadius: 6,
                  display: "flex", alignItems: "center", gap: 8,
                  background: active ? "rgba(167,139,250,0.08)" : "transparent",
                  color: active ? "#A78BFA" : "rgba(255,255,255,0.5)",
                  fontSize: 13, fontWeight: active ? 500 : 400,
                  cursor: "pointer", transition: "background 0.1s, color 0.1s",
                  userSelect: "none",
                  borderLeft: active ? "2px solid #A78BFA" : "2px solid transparent",
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "#1A1A1A"; e.currentTarget.style.color = "#FAFAFA"; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; } }}
              >
                <span style={{ fontSize: 12, opacity: active ? 1 : 0.6 }}>{icon}</span>
                {label}
              </div>
            );
          })}

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px",
            }}>
              <Avatar name={displayName} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 500, color: "#FAFAFA",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{displayName}</div>
                <div style={{
                  fontSize: 10, color: "rgba(255,255,255,0.3)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{user?.email}</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              style={{
                width: "100%", background: "transparent",
                border: "none", borderRadius: 6,
                padding: "0 8px", height: 30, color: "rgba(255,255,255,0.25)", fontSize: 12,
                cursor: "pointer", fontFamily: FONT,
                transition: "color 0.1s", textAlign: "left",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.25)"; }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: "40px 48px 40px 40px", overflowY: "auto", display: "flex", flexDirection: "column", height: "100vh" }}>
          {activeNb ? (
            <div style={{ height: "100%", animation: "fadeIn 0.3s ease" }}>
              <NotebookView
                nb={activeNb}
                currentUserId={user?.id}
                onBack={() => setActiveNb(null)}
                onToast={msg => { setToast(msg); setTimeout(() => setToast(""), 3000); }}
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
            <div style={{ animation: "fadeIn 0.15s ease", maxWidth: 480 }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: "#FAFAFA", fontFamily: FONT, letterSpacing: "-0.02em", marginBottom: 4 }}>
                Settings
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: FONT, marginBottom: 32, textTransform: "uppercase", letterSpacing: "0.08em" }}>ACCOUNT</div>

              <div style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.3)", fontFamily: FONT, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                Account
              </div>
              <div style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "16px", marginBottom: 32 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: FONT, marginBottom: 4 }}>Signed in as</div>
                <div style={{ fontSize: 13, color: "#FAFAFA", fontWeight: 500, fontFamily: FONT }}>{user?.email}</div>
              </div>

              <div style={{ fontSize: 10, fontWeight: 500, color: "rgba(239,68,68,0.6)", fontFamily: FONT, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                Danger zone
              </div>
              <div style={{ background: "#111111", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 6, padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#FAFAFA", fontFamily: FONT, marginBottom: 2 }}>Delete my account</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: FONT }}>This action cannot be undone.</div>
                </div>
                <button
                  onClick={() => setShowDeleteAccount(true)}
                  style={{
                    background: "transparent", border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: 6, padding: "0 12px", height: 32, color: "#EF4444",
                    fontSize: 12, fontWeight: 500, cursor: "pointer",
                    fontFamily: FONT,
                    transition: "all 0.1s", whiteSpace: "nowrap", flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.25)"; }}
                >Delete account</button>
              </div>
            </div>

          ) : (
            <div style={{ animation: "fadeIn 0.15s ease" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: "#FAFAFA", fontFamily: FONT, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                    {activeView === "dashboard" ? displayName.split(" ")[0] : viewLabel}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.3)", fontFamily: FONT, marginTop: 2, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {activeView === "dashboard" ? "DASHBOARD" : `${filtered.length} notebook${filtered.length !== 1 ? "s" : ""}`}
                  </div>
                </div>
                {activeView === "dashboard" && (
                  <button
                    onClick={() => setShowNewClassModal(true)}
                    style={{ background: "#A78BFA", border: "none", borderRadius: 6, padding: "0 12px", height: 32, color: "#fff", fontWeight: 500, fontSize: 13, cursor: "pointer", fontFamily: FONT, transition: "background 0.1s", flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#7C3AED"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#A78BFA"; }}
                  >+ New Class</button>
                )}
              </div>

              {/* Search */}
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={activeView === "dashboard" ? "Search…" : `Search…`}
                style={{ width: "100%", background: "#111111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "0 12px", height: 36, color: "#FAFAFA", fontSize: 13, fontFamily: FONT, outline: "none", marginBottom: 24, transition: "border-color 0.1s" }}
                onFocus={e => e.target.style.borderColor = "#A78BFA"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
              />

              {/* Dashboard: class cards */}
              {activeView === "dashboard" ? (
                filteredClasses.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", gap: 8 }}>
                    <div style={{ fontSize: 13, fontFamily: FONT, color: "rgba(255,255,255,0.3)" }}>
                      {search ? "No classes match your search" : "No classes yet — create one to get started"}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 40 }}>
                    {filteredClasses.map(cls => (
                      <ClassCard
                        key={cls.id}
                        cls={cls}
                        expanded={expandedClassId === cls.id}
                        units={classUnitsCache[cls.id] ?? null}
                        onToggle={() => handleToggleClass(cls.id)}
                        onOpenUnit={unit => setActiveNb(unit)}
                        onNewUnit={() => setNewUnitFor({ classId: cls.id, classTitle: cls.title })}
                        onDeleteClass={() => setDeleteClassTarget(cls)}
                      />
                    ))}
                  </div>
                )

              ) : filtered.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", gap: 8 }}>
                  <div style={{ fontSize: 13, fontFamily: FONT, color: "rgba(255,255,255,0.3)" }}>
                    {search ? "No notebooks match your search"
                      : activeView === "starred" ? "No starred notebooks yet"
                      : "No notebooks here yet"}
                  </div>
                  {activeView === "starred" && !search && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: FONT }}>
                      Click ★ on any notebook card to star it
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.3)", fontFamily: FONT, letterSpacing: "0.08em", marginBottom: 12, textTransform: "uppercase" }}>
                    {viewLabel}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8, marginBottom: 40 }}>
                    {filtered.map(nb => (
                      <NotebookCard
                        key={nb.id}
                        nb={nb}
                        onClick={() => setActiveNb(nb)}
                        starred={starredIds.has(nb.id)}
                        onToggleStar={() => handleToggleStar(nb)}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Notifications — dashboard only */}
              {activeView === "dashboard" && (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.3)", fontFamily: FONT, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Notifications {notifications.length > 0 && <span style={{ color: "#A78BFA" }}>· {notifications.length}</span>}
                    </div>
                    {notifications.length > 0 && (
                      <button
                        onClick={async () => {
                          setNotifications([]);
                          try { await api.clearAllNotifications(); } catch { /* silent */ }
                        }}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: FONT,
                          padding: "2px 6px", borderRadius: 4, transition: "color 0.1s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = "#A78BFA"}
                        onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: "4px 0", fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: FONT }}>
                      No new notifications
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {notifications.map(n => (
                        <div key={n.id} style={{
                          display: "flex", alignItems: "center", gap: 12,
                          background: "#111111", border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 6, padding: "10px 12px",
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: FONT, lineHeight: 1.4 }}>
                              {n.activities?.description ?? n.activities?.action}
                            </div>
                            {n.activities?.notebooks?.title && (
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: FONT, marginTop: 2 }}>
                                in {n.activities.notebooks.title}
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: MONO, flexShrink: 0 }}>
                            {timeAgo(n.created_at)}
                          </div>
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
