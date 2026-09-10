import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { ArrowLeft, BookOpen, Check, ChevronRight, ClipboardList, File, HelpCircle, Layers, RefreshCw, Sparkles, X } from "lucide-react";
import { FONT, MONO } from "../../lib/theme.js";

const FORGE_ACTIONS = [
  { id: "study_guide", label: "Study Guide", Icon: BookOpen,       color: "#34D399", desc: "Comprehensive review" },
  { id: "questions",   label: "Questions",   Icon: HelpCircle,     color: "#FBBF24", desc: "Practice questions"  },
  { id: "flashcards",  label: "Flashcards",  Icon: Layers,         color: "#F472B6", desc: "Quick recall cards"  },
  { id: "summary",     label: "Summary",     Icon: ClipboardList,  color: "#60A5FA", desc: "Concise overview"    },
];
const FORGE_BY_ID = Object.fromEntries(FORGE_ACTIONS.map(a => [a.id, a]));

export function TheForge({ nb, onToast, onUpgradeNeeded }) {
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
        (chunk) => { full += chunk; },
        () => {
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
          autoSave(full, selectedAction);
        },
        (err) => { setContent(`Error: ${err}`); setGenerating(false); }
      );
    } catch (err) {
      if (err.code === "forge_limit_reached") {
        setGenerating(false);
        setAction(null);
        onUpgradeNeeded?.("forge_limit_reached");
        return;
      }
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
    try { await api.deleteForgeOutput(id); setSavedOutputs(p => p.filter(o => o.id !== id)); } catch { /* ignore */ }
  }

  function loadSaved(o) {
    setAction(o.type); setContent(o.content); setGenerating(false); setShowSaved(false);
    if (o.type === "flashcards") {
      try {
        const m = o.content.match(/\[[\s\S]*\]/);
        if (m) { const cards = JSON.parse(m[0]); setFlashcards(cards); setShuffledOrder(cards.map((_, i) => i)); setCardIdx(0); setIsFlipped(false); setLearned(new Set()); return; }
      } catch { /* not JSON — fall through to the plain-text branch */ }
    }
    setFlashcards(null);
  }

  const currentOrder = shuffledOrder ?? (flashcards?.map((_, i) => i) ?? []);
  const currentCard  = flashcards?.[currentOrder[cardIdx]];
  const totalCards   = flashcards?.length ?? 0;
  const realIdx      = currentOrder[cardIdx];

  function goNext() { if (cardIdx >= totalCards - 1) return; setIsFlipped(false); setTimeout(() => setCardIdx(i => i + 1), 140); }
  function goPrev() { if (cardIdx <= 0) return; setIsFlipped(false); setTimeout(() => setCardIdx(i => i - 1), 140); }
  function handleShuffle() {
    setCardIdx(0); setIsFlipped(false);
    const arr = [...currentOrder];
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    setShuffledOrder(arr);
  }
  function toggleLearned() { setLearned(p => { const n = new Set(p); n.has(realIdx) ? n.delete(realIdx) : n.add(realIdx); return n; }); }

  const showCards = action === "flashcards" && flashcards && !generating;
  const activeColor = action ? FORGE_BY_ID[action]?.color ?? "var(--acc)" : "var(--acc)";

  return (
    <div className="tool-content">
      {/* Saved-library toggle (relocated from the old panel header) */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button
          onClick={() => setShowSaved(v => !v)}
          className="btn-press"
          style={{
            background: showSaved ? "var(--acc-bg)" : "transparent",
            border: `1px solid ${showSaved ? "color-mix(in srgb, var(--acc) 35%, transparent)" : "var(--border)"}`,
            borderRadius: 9, padding: "0 12px", height: 32, cursor: "pointer",
            fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
            color: showSaved ? "var(--acc-h)" : "var(--t2)",
            fontFamily: FONT,
            display: "flex", alignItems: "center", gap: 5,
          }}
          onMouseEnter={e => { if (!showSaved) { e.currentTarget.style.color = "var(--t1)"; e.currentTarget.style.borderColor = "var(--border-h)"; }}}
          onMouseLeave={e => { if (!showSaved) { e.currentTarget.style.color = "var(--t2)"; e.currentTarget.style.borderColor = "var(--border)"; }}}
        >
          SAVED
          {savedOutputs.length > 0 && (
            <span style={{
              background: showSaved ? "color-mix(in srgb, var(--acc) 25%, transparent)" : "var(--t4)",
              color: showSaved ? "var(--acc-h)" : "var(--t2)",
              borderRadius: 999, padding: "1px 6px", fontSize: 10, fontWeight: 700,
              letterSpacing: "0",
            }}>{savedOutputs.length}</span>
          )}
        </button>
      </div>

      {/* Saved outputs panel */}
      {showSaved && (
        <div style={{
          background: "var(--s1)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 6, marginBottom: 14,
          maxHeight: 200, overflowY: "auto",
          animation: "fadeIn 0.18s ease",
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        }}>
          {savedOutputs.length === 0 ? (
            <div style={{
              fontSize: 12.5, color: "var(--t3)",
              fontFamily: FONT, padding: "20px 12px", textAlign: "center",
            }}>
              No saved outputs yet. Generate something to start your library.
            </div>
          ) : savedOutputs.map(o => {
            const meta = FORGE_BY_ID[o.type];
            const Icon = meta?.Icon ?? File;
            const color = meta?.color ?? "var(--acc)";
            return (
              <div key={o.id} className="forge-saved-item">
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: `${color}18`, border: `1px solid ${color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color, flexShrink: 0,
                }}><Icon size={15} strokeWidth={1.75} /></div>
                <div onClick={() => loadSaved(o)} style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12.5, color: "var(--t1)", fontFamily: FONT, fontWeight: 500,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    letterSpacing: "-0.01em",
                  }}>{o.title}</div>
                  <div style={{
                    fontSize: 10.5, color: "var(--t3)",
                    fontFamily: FONT, marginTop: 2,
                  }}>
                    {new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
                <button className="forge-del" onClick={e => { e.stopPropagation(); handleDeleteSaved(o.id); }} aria-label="Delete"><X size={12} strokeWidth={2} /></button>
              </div>
            );
          })}
        </div>
      )}

      {/* Action buttons — color-coded grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {FORGE_ACTIONS.map(a => (
          <button
            key={a.id}
            onClick={() => generate(a.id)}
            disabled={generating}
            className={`forge-action-btn${action === a.id ? " forge-active" : ""}`}
            style={{ "--btn-color": a.color }}
          >
            <div className="forge-action-icon"><a.Icon size={16} strokeWidth={1.75} /></div>
            <div style={{
              fontSize: 12, fontWeight: 600, fontFamily: FONT,
              letterSpacing: "-0.01em",
            }}>{a.label}</div>
            <div className="forge-action-desc">{a.desc}</div>
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
          width: "100%", background: "var(--s1)",
          border: "1px solid var(--border)",
          borderRadius: 10, padding: "0 14px",
          height: 40,
          color: "var(--t1)", fontSize: 13,
          fontFamily: FONT,
          outline: "none", marginBottom: 12,
          boxSizing: "border-box",
          transition: "all 0.18s",
          letterSpacing: "-0.01em",
        }}
      />

      {/* Flashcard view */}
      {showCards && currentCard ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <div style={{
              fontSize: 11, color: "var(--t3)", fontFamily: MONO,
              padding: "3px 8px", background: "var(--s2)",
              borderRadius: 6, fontWeight: 600,
            }}>{cardIdx + 1} / {totalCards}</div>
            <div style={{
              fontSize: 11, color: "var(--t3)", fontFamily: FONT,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flex: 1, textAlign: "center", margin: "0 12px",
            }}>{nb.title}</div>
            <div style={{
              fontSize: 11, color: learned.size > 0 ? "#34D399" : "var(--t4)",
              fontFamily: MONO, flexShrink: 0,
              padding: "3px 8px",
              background: learned.size > 0 ? "rgba(52,211,153,0.1)" : "var(--s2)",
              borderRadius: 6, fontWeight: 600,
            }}>{learned.size}/{totalCards}</div>
          </div>

          <div style={{ perspective: "1400px", cursor: "pointer", flex: 1, minHeight: 0 }} onClick={() => setIsFlipped(f => !f)}>
            <div className={`forge-card${isFlipped ? " flipped" : ""}`} style={{ width: "100%", height: "100%", position: "relative", minHeight: 200 }}>
              <div className="forge-face" style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(180deg, #1C1C2A 0%, #14141F 100%)",
                border: "1px solid var(--border-h)",
                borderRadius: 14,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "28px 22px",
                boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
              }}>
                <div style={{
                  fontSize: 15, color: "var(--t1)", textAlign: "center", lineHeight: 1.6,
                  fontFamily: FONT, fontWeight: 500, letterSpacing: "-0.01em",
                }}>{currentCard.question}</div>
                <div style={{
                  position: "absolute", bottom: 12, fontSize: 10,
                  color: "var(--t4)", fontFamily: FONT,
                  letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600,
                }}>Click to flip</div>
              </div>
              <div className="forge-face forge-back" style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(180deg, var(--acc-bg) 0%, rgba(167,139,250,0.04) 100%)",
                border: "1px solid color-mix(in srgb, var(--acc) 30%, transparent)",
                borderRadius: 14,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "28px 22px",
                boxShadow: "0 12px 32px rgba(0,0,0,0.3), 0 0 24px rgba(167,139,250,0.15)",
              }}>
                <div style={{
                  fontSize: 14, color: "var(--acc-h)", textAlign: "center", lineHeight: 1.65,
                  fontFamily: FONT, letterSpacing: "-0.005em",
                }}>{currentCard.answer}</div>
                <div style={{
                  position: "absolute", bottom: 12, fontSize: 10,
                  color: "var(--acc-bg-h)", fontFamily: FONT,
                  letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600,
                }}>Click to flip back</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14 }}>
            <button onClick={goPrev} disabled={cardIdx === 0} className="btn-press" style={{
              background: "var(--s1)", border: "1px solid var(--border)",
              borderRadius: 10, height: 36, width: 44,
              color: cardIdx === 0 ? "var(--t4)" : "var(--t2)",
              cursor: cardIdx === 0 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><ArrowLeft size={15} strokeWidth={1.75} /></button>
            <button onClick={handleShuffle} title="Shuffle" className="btn-press" style={{
              background: "var(--s1)", border: "1px solid var(--border)",
              borderRadius: 10, height: 36, width: 40,
              color: "var(--t3)", cursor: "pointer", fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--acc)"; e.currentTarget.style.borderColor = "color-mix(in srgb, var(--acc) 30%, transparent)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--t3)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            ><RefreshCw size={14} strokeWidth={1.75} /></button>
            <button onClick={toggleLearned} className="btn-press" style={{
              background: learned.has(realIdx) ? "rgba(52,211,153,0.12)" : "var(--s1)",
              border: `1px solid ${learned.has(realIdx) ? "rgba(52,211,153,0.32)" : "var(--border)"}`,
              borderRadius: 10, padding: "0 14px", height: 36,
              color: learned.has(realIdx) ? "#34D399" : "var(--t2)",
              cursor: "pointer", fontSize: 12, fontFamily: FONT, fontWeight: 600,
              whiteSpace: "nowrap", letterSpacing: "-0.005em",
            }}>
              {learned.has(realIdx) ? <><Check size={13} strokeWidth={2} /> Learned</> : "Mark learned"}
            </button>
            <button onClick={goNext} disabled={cardIdx === totalCards - 1} className="btn-press" style={{
              background: "var(--s1)", border: "1px solid var(--border)",
              borderRadius: 10, height: 36, width: 44,
              color: cardIdx === totalCards - 1 ? "var(--t4)" : "var(--t2)",
              cursor: cardIdx === totalCards - 1 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><ChevronRight size={16} strokeWidth={1.75} /></button>
          </div>
        </div>
      ) : (
        <>
          <div ref={contentRef} style={{
            flex: 1, overflowY: "auto", minHeight: 240,
            background: "#0F0F18",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "18px",
            fontSize: 13.5, color: "var(--t1)", lineHeight: 1.7,
            fontFamily: FONT, whiteSpace: "pre-wrap",
            letterSpacing: "-0.005em",
          }}>
            {!action && !content && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", height: "100%", minHeight: 200, gap: 12,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: "linear-gradient(135deg, var(--acc-bg) 0%, rgba(167,139,250,0.04) 100%)",
                  border: "1px solid rgba(167,139,250,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent)",
                }}><Sparkles size={24} strokeWidth={1.5} /></div>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: "var(--t1)", fontFamily: FONT,
                  letterSpacing: "-0.015em",
                }}>Ready to forge</div>
                <div style={{
                  fontSize: 12.5, color: "var(--t3)", lineHeight: 1.55,
                  textAlign: "center", maxWidth: 260,
                }}>
                  Pick a type above to generate study content from your notes.
                </div>
              </div>
            )}
            {generating && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", height: "100%", gap: 14, minHeight: 200,
              }}>
                <div className="forge-spinner" style={{ borderTopColor: activeColor, borderColor: `${activeColor}26` }} />
                <span style={{
                  fontSize: 12.5, color: "var(--t2)", fontFamily: FONT,
                  fontWeight: 500, letterSpacing: "-0.005em",
                }}>
                  Forging your {FORGE_BY_ID[action]?.label.toLowerCase() ?? "output"}…
                </span>
              </div>
            )}
            {!generating && content && <span>{content}</span>}
          </div>

          {content && !generating && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={handleCopy} className="btn-press" style={{
                flex: 1, background: copied ? "rgba(52,211,153,0.1)" : "var(--s1)",
                border: `1px solid ${copied ? "rgba(52,211,153,0.3)" : "var(--border)"}`,
                borderRadius: 10, height: 36,
                color: copied ? "#34D399" : "var(--t2)",
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                letterSpacing: "-0.005em",
              }}
                onMouseEnter={e => { if (!copied) { e.currentTarget.style.color = "var(--t1)"; e.currentTarget.style.borderColor = "var(--border-h)"; }}}
                onMouseLeave={e => { if (!copied) { e.currentTarget.style.color = "var(--t2)"; e.currentTarget.style.borderColor = "var(--border)"; }}}
              >{copied ? <><Check size={13} strokeWidth={2} /> Copied</> : "Copy"}</button>
              <button onClick={handleDownload} className="btn-press" style={{
                flex: 1, background: "var(--s1)",
                border: "1px solid var(--border)",
                borderRadius: 10, height: 36,
                color: "var(--t2)", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: FONT,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                letterSpacing: "-0.005em",
              }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--t1)"; e.currentTarget.style.borderColor = "var(--border-h)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--t2)"; e.currentTarget.style.borderColor = "var(--border)"; }}
              >Download</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
