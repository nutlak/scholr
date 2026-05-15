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

function NotebookCard({ nb, onClick, starred = false, onToggleStar }) {
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
        overflow: "visible",
      }}
    >
      {/* Color accent bar — keep inside a clipped wrapper so it doesn't bleed */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: nb.color, borderRadius: "16px 16px 0 0",
        opacity: hovered ? 1 : 0.5, transition: "opacity 0.2s",
        overflow: "hidden",
      }} />

      {/* Star button — absolutely positioned so it's always clickable */}
      {onToggleStar && (
        <button
          onClick={e => { e.stopPropagation(); onToggleStar(); }}
          title={starred ? "Remove star" : "Star this notebook"}
          style={{
            position: "absolute", top: 10, right: 12,
            zIndex: 10,
            background: "none", border: "none", cursor: "pointer",
            padding: "4px 6px",
            fontSize: 16,
            color: starred ? "#A78BFA" : "#6060A0",
            opacity: starred ? 1 : hovered ? 1 : 0.6,
            transition: "color 0.15s, opacity 0.15s",
            lineHeight: 1,
          }}
          onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = "#A78BFA"; e.currentTarget.style.opacity = "1"; }}
          onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.color = starred ? "#A78BFA" : "#6060A0"; e.currentTarget.style.opacity = starred ? "1" : "0.6"; }}
        >
          {starred ? "★" : "☆"}
        </button>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
          color: nb.color, textTransform: "uppercase",
          fontFamily: "'DM Mono', monospace"
        }}>{nb.notes} notes</div>
        <div style={{ fontSize: 11, color: "#4A4A60", fontFamily: "'Plus Jakarta Sans', sans-serif", paddingRight: 24 }}>{nb.updated}</div>
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
    try {
      const out = await api.saveForgeOutput(nb.id, selectedAction, fullContent, topic);
      setSavedOutputs(prev => [out, ...prev]);
      onToast?.(`Saved to ${nb.title}`);
    } catch { /* silent — auto-save failure shouldn't block the user */ }
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
      width: "48%", display: "flex", flexDirection: "column",
      borderLeft: "1px solid rgba(255,255,255,0.06)",
      paddingLeft: 20, marginLeft: 16,
      height: "100%", minHeight: 0, flexShrink: 0,
    }}>
      {/* Flip animation CSS */}
      <style>{`
        .forge-card { transition: transform 0.5s cubic-bezier(0.4,0.2,0.2,1); transform-style: preserve-3d; }
        .forge-card.flipped { transform: rotateY(180deg); }
        .forge-face { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        .forge-back { transform: rotateY(180deg); }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 17 }}>🔨</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#C4B5FD", fontFamily: "'Nunito', sans-serif", letterSpacing: "-0.01em" }}>The Forge</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setShowSaved(v => !v)}
            style={{ background: showSaved ? "rgba(167,139,250,0.12)" : "none", border: `1px solid ${showSaved ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.07)"}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 10, color: showSaved ? "#C4B5FD" : "#404060", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: "0.04em", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#C4B5FD"; }}
            onMouseLeave={e => { if (!showSaved) e.currentTarget.style.color = "#404060"; }}
          >SAVED {savedOutputs.length > 0 && `(${savedOutputs.length})`}</button>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#404060", fontSize: 16, lineHeight: 1, padding: "2px 4px" }}
            onMouseEnter={e => e.currentTarget.style.color = "#D0D0E8"} onMouseLeave={e => e.currentTarget.style.color = "#404060"}>✕</button>
        </div>
      </div>

      {/* Saved outputs panel */}
      {showSaved && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 10px", marginBottom: 10, maxHeight: 160, overflowY: "auto" }}>
          {savedOutputs.length === 0 ? (
            <div style={{ fontSize: 11, color: "#303050", fontFamily: "'Plus Jakarta Sans', sans-serif", padding: "4px 0" }}>No saved outputs yet</div>
          ) : savedOutputs.map(o => (
            <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div onClick={() => loadSaved(o)} style={{ flex: 1, cursor: "pointer", minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#A0A0C0", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.title}</div>
                <div style={{ fontSize: 10, color: "#303050", fontFamily: "'DM Mono', monospace" }}>{new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
              </div>
              <button onClick={() => handleDeleteSaved(o.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#303050", fontSize: 12, padding: "2px 4px", flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = "#F87171"} onMouseLeave={e => e.currentTarget.style.color = "#303050"}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
        {FORGE_ACTIONS.map(a => (
          <button key={a.id} onClick={() => generate(a.id)} disabled={generating} style={{ flex: 1, padding: "7px 2px", borderRadius: 8, cursor: generating ? "not-allowed" : "pointer", background: action === a.id ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.03)", border: `1px solid ${action === a.id ? "rgba(167,139,250,0.45)" : "rgba(255,255,255,0.07)"}`, color: action === a.id ? "#C4B5FD" : "#505068", fontSize: 10, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, transition: "all 0.15s", opacity: generating ? 0.55 : 1, lineHeight: 1.4 }}
            onMouseEnter={e => { if (!generating && action !== a.id) { e.currentTarget.style.background = "rgba(167,139,250,0.1)"; e.currentTarget.style.color = "#A78BFA"; }}}
            onMouseLeave={e => { if (!generating && action !== a.id) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#505068"; }}}>
            <div style={{ fontSize: 14, marginBottom: 1 }}>{a.icon}</div>
            <div>{a.label}</div>
          </button>
        ))}
      </div>

      {/* Topic input */}
      <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === "Enter" && action && !generating && generate(action)} placeholder="Focus on a specific topic (optional)…" disabled={generating}
        style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 12px", color: "#D0D0E8", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", marginBottom: 10, boxSizing: "border-box", transition: "border-color 0.15s" }}
        onFocus={e => e.target.style.borderColor = "rgba(167,139,250,0.3)"} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.06)"} />

      {/* ── Quizlet-style flashcard view ── */}
      {showCards && currentCard ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Counter + meta */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#505070", fontFamily: "'DM Mono', monospace" }}>{cardIdx + 1} / {totalCards}</div>
            <div style={{ fontSize: 11, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "center", margin: "0 10px" }}>{nb.title}</div>
            <div style={{ fontSize: 11, color: learned.size > 0 ? "#34D399" : "#303050", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{learned.size}/{totalCards}</div>
          </div>

          {/* Big flip card */}
          <div style={{ perspective: "1400px", cursor: "pointer", flex: 1, minHeight: 0 }} onClick={() => setIsFlipped(f => !f)}>
            <div className={`forge-card${isFlipped ? " flipped" : ""}`} style={{ width: "100%", height: "100%", position: "relative", minHeight: 180 }}>
              {/* Front */}
              <div className="forge-face" style={{ position: "absolute", inset: 0, background: "rgba(20,20,40,0.95)", border: "1px solid rgba(167,139,250,0.18)", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 24px" }}>
                <div style={{ fontSize: 15, color: "#E8E8F4", textAlign: "center", lineHeight: 1.65, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>{currentCard.question}</div>
                <div style={{ position: "absolute", bottom: 12, fontSize: 10, color: "#303050", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.05em" }}>CLICK TO FLIP</div>
              </div>
              {/* Back */}
              <div className="forge-face forge-back" style={{ position: "absolute", inset: 0, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.35)", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 24px" }}>
                <div style={{ fontSize: 14, color: "#C4B5FD", textAlign: "center", lineHeight: 1.65, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{currentCard.answer}</div>
                <div style={{ position: "absolute", bottom: 12, fontSize: 10, color: "#504060", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.05em" }}>CLICK TO FLIP BACK</div>
              </div>
            </div>
          </div>

          {/* Navigation row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12 }}>
            <button onClick={goPrev} disabled={cardIdx === 0} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 18px", color: cardIdx === 0 ? "#202030" : "#7070A0", cursor: cardIdx === 0 ? "not-allowed" : "pointer", fontSize: 16, transition: "all 0.15s" }}>←</button>
            <button onClick={handleShuffle} title="Shuffle cards" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 12px", color: "#505070", cursor: "pointer", fontSize: 13, transition: "all 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "#A78BFA"} onMouseLeave={e => e.currentTarget.style.color = "#505070"}>🔀</button>
            <button onClick={toggleLearned} style={{ background: learned.has(realIdx) ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${learned.has(realIdx) ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.07)"}`, borderRadius: 8, padding: "8px 12px", color: learned.has(realIdx) ? "#34D399" : "#505070", cursor: "pointer", fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, transition: "all 0.15s", whiteSpace: "nowrap" }}>
              {learned.has(realIdx) ? "✓ Learned" : "Mark learned"}
            </button>
            <button onClick={goNext} disabled={cardIdx === totalCards - 1} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 18px", color: cardIdx === totalCards - 1 ? "#202030" : "#7070A0", cursor: cardIdx === totalCards - 1 ? "not-allowed" : "pointer", fontSize: 16, transition: "all 0.15s" }}>→</button>
          </div>

        </div>

      ) : (
        /* ── Text content (study guide / questions / summary) ── */
        <>
          <div ref={contentRef} style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#C0C0DC", lineHeight: 1.8, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "pre-wrap" }}>
            {/* Empty state */}
            {!action && !content && (
              <div style={{ textAlign: "center", paddingTop: 48 }}>
                <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.35 }}>🔨</div>
                <div style={{ fontWeight: 700, color: "#404060", marginBottom: 6, fontFamily: "'Nunito', sans-serif", fontSize: 14 }}>The Forge</div>
                <div style={{ fontSize: 12, color: "#282840", lineHeight: 1.7 }}>Pick a material type above to generate study content from your notebook notes.</div>
              </div>
            )}
            {/* Loading state — centered, no streamed text */}
            {generating && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14 }}>
                <div style={{ display: "flex", gap: 5 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#A78BFA", animation: `pulse 1s ease-in-out ${i*0.25}s infinite` }} />)}
                </div>
                <span style={{ fontSize: 12, color: "#606080", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.04em" }}>Generating…</span>
              </div>
            )}
            {/* Final text — only shown after generation completes */}
            {!generating && content && <span>{content}</span>}
          </div>

          {/* Action bar */}
          {content && !generating && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button onClick={handleCopy} style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "7px", color: copied ? "#34D399" : "#505068", fontSize: 11, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
                onMouseEnter={e => { if (!copied) { e.currentTarget.style.color = "#A78BFA"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.3)"; }}}
                onMouseLeave={e => { if (!copied) { e.currentTarget.style.color = "#505068"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}}
              >{copied ? "✓ Copied" : "📋 Copy"}</button>
              <button onClick={handleDownload} style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "7px", color: "#505068", fontSize: 11, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#A78BFA"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.3)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#505068"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}>⬇ Download</button>
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
          {/* Forge toggle */}
          <button
            onClick={() => setShowForge(f => !f)}
            title="Toggle The Forge"
            style={{
              background: showForge ? "rgba(167,139,250,0.18)" : "transparent",
              border: `1px solid ${showForge ? "rgba(167,139,250,0.5)" : "rgba(167,139,250,0.25)"}`,
              borderRadius: 8, padding: "6px 12px", cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12,
              color: showForge ? "#C4B5FD" : "#7060A0", fontWeight: 600, transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 5,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(167,139,250,0.18)"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.5)"; e.currentTarget.style.color = "#C4B5FD"; }}
            onMouseLeave={e => {
              if (!showForge) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.25)"; e.currentTarget.style.color = "#7060A0"; }
            }}
          >🔨 Forge</button>
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

      {/* Chat + Forge split */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 0 }}>
      {/* Chat column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

      {/* Message list */}
      <div style={{
        flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
        gap: 12, marginBottom: 16, paddingRight: 4
      }}>
        {messages.map((m, i) => {
          console.log("message:", { role: m.role, createdBy: m.createdBy, currentUserId, text: m.text?.slice(0, 40) });
          // Own message: sent by current user (role=user, createdBy matches)
          const isOwn = m.role === "user" && (m.createdBy === currentUserId || (!m.createdBy && m.role === "user"));
          // Another member's message: role=user but different user
          const isOtherMember = m.role === "user" && m.createdBy && m.createdBy !== currentUserId;
          const isAssistant = m.role === "assistant";

          // Label shown above the bubble
          const senderInfo = isOtherMember ? members.find(mem => mem.user_id === m.createdBy) : null;
          const senderLabel = isAssistant
            ? "🤖 Derek"
            : isOtherMember
              ? (senderInfo?.first_name?.trim() || senderInfo?.email?.split("@")[0] || "Member")
              : null;

          const alignRight = isOwn;

          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: alignRight ? "flex-end" : "flex-start" }}>
              {senderLabel && (
                <div style={{
                  fontSize: 10, fontWeight: 600,
                  color: isAssistant ? "#A78BFA" : "#7070A0",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  marginBottom: 3, paddingLeft: 4,
                  letterSpacing: "0.03em",
                }}>
                  {senderLabel}
                </div>
              )}
              <div style={{
                maxWidth: "75%",
                background: m.isError ? "#2A1A1A" : isOwn ? "#A78BFA" : "#1A1A28",
                color: m.isError ? "#F87171" : isOwn ? "#0A0A0F" : "#D0D0E8",
                borderRadius: isOwn ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                padding: "10px 14px",
                fontSize: 13, lineHeight: 1.6,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                border: !isOwn ? `1px solid ${m.isError ? "#5A2020" : "#2A2A38"}` : "none",
                whiteSpace: "pre-wrap",
              }}>
                {m.text}
              </div>
            </div>
          );
        })}

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
      position: "fixed", inset: 0, background: "rgba(10,10,15,0.8)",
      backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#111118", border: "1px solid #2A2A38",
        borderRadius: 20, width: "100%", maxWidth: 400,
        padding: "32px 28px", boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
        animation: "fadeIn 0.2s ease",
      }}>
        <div style={{ fontSize: 22, marginBottom: 12 }}>🗑️</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif", marginBottom: 8 }}>
          Delete "{cls.title}"?
        </div>
        <div style={{ fontSize: 13, color: "#606080", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.5, marginBottom: 24 }}>
          This will delete the class and all units and notes inside it. This cannot be undone.
        </div>
        {error && (
          <div style={{ background: "#2A1A1A", border: "1px solid #5A2020", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#F87171", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 16 }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button" onClick={onClose}
            style={{ flex: 1, background: "transparent", border: "1px solid #2A2A38", borderRadius: 10, padding: "11px", color: "#606080", fontSize: 13, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#3A3A50"; e.currentTarget.style.color = "#A0A0C0"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#2A2A38"; e.currentTarget.style.color = "#606080"; }}
          >Cancel</button>
          <button
            type="button" onClick={handleConfirm} disabled={loading}
            style={{ flex: 1, background: loading ? "#5A1A1A" : "#7F1D1D", border: "1px solid #991B1B", borderRadius: 10, padding: "11px", color: "#FCA5A5", fontWeight: 700, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s", opacity: loading ? 0.7 : 1 }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#991B1B"; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#7F1D1D"; }}
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
      background: hovered || expanded ? "rgba(255,255,255,0.03)" : "transparent",
      border: `1px solid ${expanded ? cls.color + "40" : hovered ? "#2A2A3A" : "#18181E"}`,
      borderRadius: 14, overflow: "hidden",
      transition: "background 0.2s, border-color 0.2s",
    }}>
      <div
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: "14px 18px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 12,
          position: "relative",
          transition: "background 0.15s",
        }}
      >
        {/* Color strip on left edge */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
          background: cls.color, borderRadius: "14px 0 0 14px",
          opacity: expanded ? 1 : hovered ? 0.6 : 0.3,
          transition: "opacity 0.2s",
        }} />

        <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#D8D8EC", fontFamily: "'Nunito', sans-serif", letterSpacing: "-0.01em" }}>
            {cls.title}
          </div>
          <div style={{ fontSize: 11, color: "#404060", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 1 }}>
            {units === null ? "…" : `${units.length} unit${units.length !== 1 ? "s" : ""}`}
          </div>
        </div>

        {/* Delete button — visible on hover */}
        {onDeleteClass && (
          <button
            onClick={e => { e.stopPropagation(); onDeleteClass(); }}
            title="Delete class"
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "4px 6px", borderRadius: 6, fontSize: 13,
              color: "#404060", opacity: hovered ? 1 : 0,
              transition: "opacity 0.15s, color 0.15s",
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = "#F87171"; }}
            onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.color = "#404060"; }}
          >🗑️</button>
        )}

        <div style={{
          fontSize: 10, color: expanded ? cls.color : "#404060",
          transition: "transform 0.2s, color 0.2s",
          transform: expanded ? "rotate(90deg)" : "none",
          flexShrink: 0,
        }}>▶</div>
      </div>

      {expanded && (
        <div style={{ padding: "8px 18px 16px 18px", paddingLeft: 25 }}>
          {units === null ? (
            <div style={{ padding: "10px 0", fontSize: 12, color: "#404060", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Loading…</div>
          ) : units.length === 0 ? (
            <div style={{ padding: "10px 0", fontSize: 12, color: "#404060", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>No units yet — add one below</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
              {units.map(unit => (
                <UnitRow key={unit.id} unit={unit} color={cls.color} onClick={() => onOpenUnit(unit)} />
              ))}
            </div>
          )}
          <button
            onClick={onNewUnit}
            style={{
              width: "100%", background: "transparent",
              border: `1px dashed ${cls.color}44`, borderRadius: 8,
              padding: "8px", color: cls.color, fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
              transition: "all 0.15s", marginTop: 2,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = cls.color + "12"; e.currentTarget.style.borderColor = cls.color + "80"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = cls.color + "44"; }}
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

      {/* Dashboard — only rendered when authenticated */}
      <div style={{
        height: "100vh", overflow: "hidden", background: "#0A0A0F",
        display: user ? "flex" : "none", fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        {/* Sidebar — same bg as page, no seam */}
        <div style={{
          width: 210, background: "#0A0A0F",
          padding: "28px 14px", display: "flex", flexDirection: "column", gap: 2,
          flexShrink: 0, height: "100vh", overflowY: "auto",
          position: "sticky", top: 0,
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
                  padding: "8px 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 9,
                  background: active ? "rgba(167,139,250,0.1)" : "transparent",
                  color: active ? "#C4B5FD" : "#505068",
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  cursor: "pointer", transition: "background 0.15s, color 0.15s",
                  userSelect: "none",
                  borderLeft: active ? "2px solid #A78BFA" : "2px solid transparent",
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#8080A0"; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#505068"; } }}
              >
                <span style={{ fontSize: 13, opacity: active ? 1 : 0.5 }}>{icon}</span>
                {label}
              </div>
            );
          })}

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "9px 10px", borderRadius: 8,
              background: "rgba(255,255,255,0.03)",
            }}>
              <Avatar name={displayName} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: "#C0C0DC",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                }}>{displayName}</div>
                <div style={{
                  fontSize: 10, color: "#383850",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                }}>{user?.email}</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              style={{
                width: "100%", background: "transparent",
                border: "none", borderRadius: 8,
                padding: "8px 12px", color: "#3A3A58", fontSize: 12,
                cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: "color 0.15s", textAlign: "left",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "#F87171"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#3A3A58"; }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Main — full bleed, no border */}
        <div style={{ flex: 1, padding: "40px 48px 40px 36px", overflowY: "auto", display: "flex", flexDirection: "column", height: "100vh" }}>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#EEEEFA", fontFamily: "'Nunito', sans-serif", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                    {activeView === "dashboard" ? getGreeting(displayName) : viewLabel}
                  </div>
                  {activeView !== "dashboard" && (
                    <div style={{ fontSize: 12, color: "#404060", marginTop: 4, fontFamily: "'DM Mono', monospace", letterSpacing: "0.05em" }}>
                      {`${filtered.length} notebook${filtered.length !== 1 ? "s" : ""}`}
                    </div>
                  )}
                </div>
                {activeView === "dashboard" && (
                  <button
                    onClick={() => setShowNewClassModal(true)}
                    style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 10, padding: "9px 18px", color: "#C4B5FD", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s", flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(167,139,250,0.25)"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.6)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(167,139,250,0.15)"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.3)"; }}
                  >+ New Class</button>
                )}
              </div>

              {/* Search */}
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={activeView === "dashboard" ? "Search classes…" : `Search ${viewLabel.toLowerCase()}…`}
                style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "11px 16px", color: "#D0D0E8", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", marginBottom: 28, transition: "border-color 0.15s" }}
                onFocus={e => e.target.style.borderColor = "rgba(167,139,250,0.3)"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
              />

              {/* Dashboard: class cards */}
              {activeView === "dashboard" ? (
                filteredClasses.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 12 }}>
                    <div style={{ fontSize: 36, opacity: 0.4 }}>📁</div>
                    <div style={{ fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#404060" }}>
                      {search ? "No classes match your search" : "No classes yet — create one to get started"}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 40 }}>
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

              /* My Notes / Shared / Starred: flat notebook list */
              ) : filtered.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 12 }}>
                  <div style={{ fontSize: 36, opacity: 0.4 }}>{activeView === "starred" ? "★" : "📓"}</div>
                  <div style={{ fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#404060" }}>
                    {search ? "No notebooks match your search"
                      : activeView === "starred" ? "No starred notebooks yet"
                      : "No notebooks here yet"}
                  </div>
                  {activeView === "starred" && !search && (
                    <div style={{ fontSize: 12, color: "#2A2A40", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      Click ★ on any notebook card to star it
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 10, color: "#303050", fontFamily: "'DM Mono', monospace", letterSpacing: "0.12em", marginBottom: 16, textTransform: "uppercase" }}>
                    {viewLabel}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12, marginBottom: 40 }}>
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: "#303050", fontFamily: "'DM Mono', monospace", letterSpacing: "0.12em", textTransform: "uppercase" }}>
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
                          fontSize: 11, color: "#404060", fontFamily: "'Plus Jakarta Sans', sans-serif",
                          padding: "2px 6px", borderRadius: 6, transition: "color 0.15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = "#A78BFA"}
                        onMouseLeave={e => e.currentTarget.style.color = "#404060"}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: "8px 0", fontSize: 13, color: "#303048", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      No new notifications
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {notifications.map(n => (
                        <div key={n.id} style={{
                          display: "flex", alignItems: "center", gap: 12,
                          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                          borderRadius: 10, padding: "12px 16px",
                        }}>
                          <div style={{ fontSize: 16, flexShrink: 0, opacity: 0.6 }}>📎</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: "#A0A0C0", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.4 }}>
                              {n.activities?.description ?? n.activities?.action}
                            </div>
                            {n.activities?.notebooks?.title && (
                              <div style={{ fontSize: 11, color: "#404060", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>
                                in {n.activities.notebooks.title}
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "#303050", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
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
