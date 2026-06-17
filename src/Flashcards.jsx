import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api.js";

const FONT = `"Outfit", "Poppins", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;

// Rating buttons → SM-2 quality. Again=1, Hard=3, Good=4, Easy=5.
const RATINGS = [
  { key: "1", label: "Again", quality: 1, color: "#F87171" },
  { key: "2", label: "Hard",  quality: 3, color: "#FBBF24" },
  { key: "3", label: "Good",  quality: 4, color: "#60A5FA" },
  { key: "4", label: "Easy",  quality: 5, color: "#34D399" },
];

// ── FlashcardReview ───────────────────────────────────────────────────────────
// Focused full-screen review. Tap/Space flips; 1-4 rate; advances through `cards`.
export function FlashcardReview({ cards, onDone, title }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const done = index >= cards.length;
  const card = cards[index];

  const rate = useCallback(async (quality) => {
    if (submitting || !card) return;
    setSubmitting(true);
    try { await api.reviewFlashcard(card.id, quality); } catch { /* keep advancing */ }
    setReviewed(r => r + 1);
    setFlipped(false);
    setIndex(i => i + 1);
    setSubmitting(false);
  }, [submitting, card]);

  // Keyboard: Space flips; 1-4 rate once flipped.
  useEffect(() => {
    function onKey(e) {
      if (done) return;
      if (e.code === "Space") { e.preventDefault(); setFlipped(f => !f); return; }
      if (flipped) {
        const r = RATINGS.find(x => x.key === e.key);
        if (r) { e.preventDefault(); rate(r.quality); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, done, rate]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1200,
      background: "var(--bg-base, #0B0B12)",
      display: "flex", flexDirection: "column",
      padding: "calc(16px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom))",
    }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: "var(--text-tertiary)", fontFamily: FONT, fontWeight: 600 }}>
          {done ? "Session complete" : `${Math.min(index + 1, cards.length)} / ${cards.length}`}
        </div>
        <button
          onClick={onDone}
          aria-label="Close review"
          style={{
            background: "transparent", border: "1px solid var(--border-default)",
            borderRadius: 8, width: 36, height: 36, cursor: "pointer",
            color: "var(--text-secondary)", fontSize: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >✕</button>
      </div>

      {/* Progress bar */}
      {!done && (
        <div style={{ height: 4, borderRadius: 2, background: "var(--bg-surface-3, #222)", overflow: "hidden", marginBottom: 20 }}>
          <div style={{
            height: "100%", borderRadius: 2,
            width: `${(index / cards.length) * 100}%`,
            background: "linear-gradient(90deg, #A78BFA, #8B5CF6)", transition: "width 0.25s ease",
          }} />
        </div>
      )}

      {done ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT, letterSpacing: "-0.02em" }}>
            Reviewed {reviewed} card{reviewed === 1 ? "" : "s"}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-tertiary)", fontFamily: FONT }}>
            Nice work. Come back when more are due.
          </div>
          <button
            onClick={onDone}
            style={{
              marginTop: 8, minHeight: 48, padding: "0 28px",
              background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
              border: "none", borderRadius: 12, color: "#fff", fontWeight: 600, fontSize: 15,
              cursor: "pointer", fontFamily: FONT, boxShadow: "0 6px 18px rgba(167,139,250,0.36)",
            }}
          >Done</button>
        </div>
      ) : (
        <>
          {/* Card */}
          <button
            onClick={() => setFlipped(f => !f)}
            style={{
              flex: 1, width: "100%", maxWidth: 640, margin: "0 auto",
              background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
              border: "1px solid var(--border-default)", borderRadius: 18,
              padding: "28px 24px", cursor: "pointer", textAlign: "center",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
              fontFamily: FONT, color: "var(--text-primary)",
            }}
          >
            <div style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
              color: flipped ? "#6EE7B7" : "var(--text-tertiary)",
            }}>{flipped ? "Answer" : "Question"}</div>
            <div style={{ fontSize: flipped ? 18 : 20, fontWeight: flipped ? 400 : 600, lineHeight: 1.5, letterSpacing: "-0.01em", whiteSpace: "pre-wrap" }}>
              {flipped ? card.back : card.front}
            </div>
            {!flipped && (
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6 }}>
                Tap to flip <span className="nb-desktop-only">· Space</span>
              </div>
            )}
          </button>

          {/* Ratings */}
          <div style={{ maxWidth: 640, margin: "16px auto 0", width: "100%" }}>
            {flipped ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {RATINGS.map(r => (
                  <button
                    key={r.key}
                    onClick={() => rate(r.quality)}
                    disabled={submitting}
                    style={{
                      minHeight: 52, borderRadius: 12, cursor: submitting ? "default" : "pointer",
                      background: `color-mix(in srgb, ${r.color} 14%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${r.color} 40%, transparent)`,
                      color: r.color, fontWeight: 700, fontSize: 14, fontFamily: FONT,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                    }}
                  >
                    {r.label}
                    <span className="nb-desktop-only" style={{ fontSize: 10, opacity: 0.7, fontWeight: 500 }}>{r.key}</span>
                  </button>
                ))}
              </div>
            ) : (
              <button
                onClick={() => setFlipped(true)}
                style={{
                  width: "100%", minHeight: 52, borderRadius: 12,
                  background: "var(--bg-surface-2)", border: "1px solid var(--border-default)",
                  color: "var(--text-primary)", fontWeight: 600, fontSize: 15, cursor: "pointer", fontFamily: FONT,
                }}
              >Show answer</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── FlashcardsPanel ───────────────────────────────────────────────────────────
// Manager rendered inside the shared ToolModal: list, generate, edit, delete,
// and launch a review session for this notebook.
export function FlashcardsPanel({ nb, onToast, onUpgradeNeeded }) {
  const [cards, setCards] = useState(null); // null = loading
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(null); // card being edited
  const [review, setReview] = useState(null);    // cards array for an active session

  const load = useCallback(async () => {
    try { setCards(await api.getFlashcards(nb.id)); }
    catch { setCards([]); }
  }, [nb.id]);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    setGenerating(true);
    try {
      const { cards: created } = await api.generateFlashcards(nb.id);
      onToast?.(`Generated ${created.length} flashcards`);
      await load();
    } catch (err) {
      if (err.code === "forge_limit_reached" || err.status === 403) { onUpgradeNeeded?.("forge_limit_reached"); }
      else onToast?.(err.message || "Failed to generate flashcards");
    }
    setGenerating(false);
  }

  async function remove(id) {
    setCards(prev => prev.filter(c => c.id !== id));
    try { await api.deleteFlashcard(id); } catch { load(); }
  }

  async function startReview() {
    try {
      const { cards: due } = await api.getDueFlashcards(nb.id);
      if (due.length) { setReview(due); return; }
      // None due — offer to review all.
      if (cards && cards.length) {
        onToast?.("No cards due — reviewing all");
        setReview(cards);
      } else {
        onToast?.("No cards yet — generate some first");
      }
    } catch {
      onToast?.("Couldn't start review");
    }
  }

  if (review) {
    return <FlashcardReview cards={review} title={nb.title} onDone={() => { setReview(null); load(); }} />;
  }

  return (
    <div className="tool-content" style={{ display: "flex", flexDirection: "column", minHeight: 0, fontFamily: FONT }}>
      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          onClick={generate}
          disabled={generating}
          className="btn-press"
          style={{
            minHeight: 44, padding: "0 16px", borderRadius: 10,
            background: generating ? "var(--bg-surface-2)" : "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
            border: "none", color: "#fff", fontWeight: 600, fontSize: 13.5, fontFamily: FONT,
            cursor: generating ? "default" : "pointer", opacity: generating ? 0.7 : 1,
            boxShadow: generating ? "none" : "0 4px 14px rgba(167,139,250,0.34)",
          }}
        >{generating ? "Generating…" : "Generate from notes"}</button>
        <button
          onClick={startReview}
          disabled={generating}
          className="btn-press"
          style={{
            minHeight: 44, padding: "0 16px", borderRadius: 10,
            background: "transparent", border: "1px solid var(--border-strong)",
            color: "var(--text-primary)", fontWeight: 600, fontSize: 13.5, fontFamily: FONT, cursor: "pointer",
          }}
        >Start review</button>
      </div>

      {/* List */}
      {cards === null ? (
        <div style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "8px 2px" }}>Loading…</div>
      ) : cards.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "8px 2px", lineHeight: 1.5 }}>
          No flashcards yet. Tap “Generate from notes” to create a set from this notebook’s notes.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", minHeight: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
            {cards.length} card{cards.length === 1 ? "" : "s"}
          </div>
          {cards.map(c => (
            <div key={c.id} style={{
              background: "var(--bg-surface-1)", border: "1px solid var(--border-subtle)",
              borderRadius: 10, padding: "11px 13px",
            }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.45 }}>{c.front}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.45 }}>{c.back}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button
                  onClick={() => setEditing(c)}
                  style={{ minHeight: 32, padding: "0 12px", borderRadius: 7, background: "var(--bg-surface-2)", border: "1px solid var(--border-default)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}
                >Edit</button>
                <button
                  onClick={() => remove(c.id)}
                  style={{ minHeight: 32, padding: "0 12px", borderRadius: 7, background: "transparent", border: "1px solid rgba(248,113,113,0.28)", color: "#F87171", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}
                >Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditCardModal
          card={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => { setCards(prev => prev.map(c => c.id === updated.id ? updated : c)); setEditing(null); }}
        />
      )}
    </div>
  );
}

function EditCardModal({ card, onClose, onSaved }) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!front.trim() || !back.trim() || saving) return;
    setSaving(true);
    try {
      const updated = await api.updateFlashcard(card.id, { front: front.trim(), back: back.trim() });
      onSaved(updated);
    } catch { setSaving(false); }
  }

  const field = {
    width: "100%", background: "#14141F", border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 10, padding: "10px 12px", color: "#F5F5FA", fontSize: 14, fontFamily: FONT,
    outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5,
  };

  return (
    <div
      className="mobile-sheet-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1300, padding: 16,
      }}
    >
      <div className="mobile-sheet" style={{
        background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
        border: "1px solid rgba(255,255,255,0.09)", borderRadius: 18,
        width: "100%", maxWidth: 440, padding: "24px 22px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6)", animation: "fadeIn 0.2s ease",
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#F5F5FA", fontFamily: FONT, marginBottom: 16, letterSpacing: "-0.02em" }}>Edit card</div>
        <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(245,245,250,0.55)", fontFamily: FONT, textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 6 }}>Front</label>
        <textarea value={front} onChange={e => setFront(e.target.value)} rows={2} style={{ ...field, marginBottom: 14 }} />
        <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(245,245,250,0.55)", fontFamily: FONT, textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 6 }}>Back</label>
        <textarea value={back} onChange={e => setBack(e.target.value)} rows={3} style={{ ...field, marginBottom: 18 }} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ minHeight: 44, padding: "0 16px", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(245,245,250,0.65)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}>Cancel</button>
          <button
            onClick={save}
            disabled={saving || !front.trim() || !back.trim()}
            style={{
              minHeight: 44, padding: "0 20px", borderRadius: 10,
              background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)", border: "none",
              color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT,
              opacity: saving || !front.trim() || !back.trim() ? 0.6 : 1,
            }}
          >{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
