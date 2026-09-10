import { useEffect, useRef, useState } from "react";
import { CLASS_COLORS, FONT, FONT_HEADING, classTint } from "../../lib/theme.js";
import { ColorSwatchPicker } from "./ClassCard.jsx";

// Pre-built course templates (starter notebooks + note structures).
const CLASS_TEMPLATES = [
  { id: "ap-bio", name: "AP Biology", emoji: "🧬", color: "#34D399", notebooks: [
    { name: "Unit 1 — Chemistry of Life", notes: ["Key Concepts", "Vocabulary", "Practice Questions"] },
    { name: "Unit 2 — Cell Structure", notes: ["Key Concepts", "Vocabulary", "Practice Questions"] },
    { name: "Unit 3 — Cellular Energetics", notes: ["Key Concepts", "Vocabulary", "Practice Questions"] },
    { name: "Unit 4 — Cell Communication", notes: ["Key Concepts", "Vocabulary", "Practice Questions"] },
    { name: "Exam Prep", notes: ["FRQ Practice", "MCQ Review", "Formula Sheet"] },
  ] },
  { id: "ap-calc-ab", name: "AP Calculus AB", emoji: "📐", color: "#60A5FA", notebooks: [
    { name: "Unit 1 — Limits", notes: ["Key Concepts", "Practice Problems", "Common Mistakes"] },
    { name: "Unit 2 — Derivatives", notes: ["Key Concepts", "Practice Problems", "Common Mistakes"] },
    { name: "Unit 3 — Integrals", notes: ["Key Concepts", "Practice Problems", "Common Mistakes"] },
    { name: "Unit 4 — Differential Equations", notes: ["Key Concepts", "Practice Problems"] },
    { name: "Exam Prep", notes: ["FRQ Practice", "Formula Sheet", "Calculator Tips"] },
  ] },
  { id: "ap-us-history", name: "AP US History", emoji: "🇺🇸", color: "#F87171", notebooks: [
    { name: "Period 1-2 (1491–1754)", notes: ["Key Events", "Key Figures", "Essay Outlines"] },
    { name: "Period 3-4 (1754–1848)", notes: ["Key Events", "Key Figures", "Essay Outlines"] },
    { name: "Period 5-6 (1844–1898)", notes: ["Key Events", "Key Figures", "Essay Outlines"] },
    { name: "Period 7-8 (1898–1980)", notes: ["Key Events", "Key Figures", "Essay Outlines"] },
    { name: "Period 9 (1980–Present)", notes: ["Key Events", "Key Figures", "Essay Outlines"] },
    { name: "Exam Prep", notes: ["SAQ Practice", "LEQ Practice", "DBQ Practice", "Key Themes"] },
  ] },
  { id: "ap-chem", name: "AP Chemistry", emoji: "⚗️", color: "#A78BFA", notebooks: [
    { name: "Unit 1 — Atomic Structure", notes: ["Key Concepts", "Practice Problems"] },
    { name: "Unit 2 — Molecular Structure", notes: ["Key Concepts", "Practice Problems"] },
    { name: "Unit 3 — Intermolecular Forces", notes: ["Key Concepts", "Practice Problems"] },
    { name: "Unit 4 — Chemical Reactions", notes: ["Key Concepts", "Practice Problems"] },
    { name: "Unit 5 — Kinetics", notes: ["Key Concepts", "Practice Problems"] },
    { name: "Exam Prep", notes: ["FRQ Practice", "Formula Sheet", "Lab Review"] },
  ] },
  { id: "ap-english", name: "AP English Literature", emoji: "📚", color: "#FBBF24", notebooks: [
    { name: "Poetry Analysis", notes: ["Poems List", "Analysis Notes", "Essay Practice"] },
    { name: "Prose Fiction", notes: ["Reading Notes", "Literary Devices", "Essay Practice"] },
    { name: "Drama", notes: ["Play Notes", "Themes", "Essay Practice"] },
    { name: "Exam Prep", notes: ["Free Response Practice", "Essay Outlines", "Key Terms"] },
  ] },
  { id: "ap-physics", name: "AP Physics 1", emoji: "⚡", color: "#F472B6", notebooks: [
    { name: "Unit 1 — Kinematics", notes: ["Key Concepts", "Practice Problems", "Formulas"] },
    { name: "Unit 2 — Forces", notes: ["Key Concepts", "Practice Problems", "Formulas"] },
    { name: "Unit 3 — Energy", notes: ["Key Concepts", "Practice Problems", "Formulas"] },
    { name: "Unit 4 — Waves", notes: ["Key Concepts", "Practice Problems", "Formulas"] },
    { name: "Exam Prep", notes: ["FRQ Practice", "Formula Sheet", "Lab Skills"] },
  ] },
  { id: "blank", name: "Start blank", emoji: "✨", color: "#6B7280", notebooks: [] },
];

export function NewClassModal({ onClose, onCreate }) {
  const [step, setStep] = useState(1); // 1 = template picker, 2 = name + color
  const [template, setTemplate] = useState(null);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(CLASS_COLORS[0].hue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const tint = classTint(color);
  const hasTemplate = template && template.id !== "blank" && template.notebooks.length > 0;

  function advance(t) {
    setTemplate(t);
    if (t.id !== "blank") { setTitle(t.name); if (t.color) setColor(t.color); }
    setStep(2);
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError("Class name is required."); return; }
    setError(""); setLoading(true);
    try { await onCreate(title.trim(), color, template); onClose(); }
    catch (err) { setError(err.message); setLoading(false); }
  }

  const inp = {
    width: "100%", background: "var(--s1)", border: "1px solid var(--border)",
    borderRadius: 10, padding: "0 14px", height: 42, color: "var(--t1)", fontSize: 14,
    fontFamily: FONT, outline: "none", transition: "all 0.18s", letterSpacing: "-0.01em",
  };
  const lbl = {
    fontSize: 11, color: "var(--t2)", fontFamily: FONT,
    letterSpacing: "0.5px", textTransform: "uppercase",
    display: "block", marginBottom: 9, fontWeight: 600,
  };

  return (
    <div className="mobile-sheet-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
      backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div className="mobile-sheet" style={{
        position: "relative",
        background: "linear-gradient(180deg, var(--bg-surface-1) 0%, var(--bg-surface-2) 100%)",
        border: "1px solid var(--border-default)",
        borderRadius: 18, width: "100%", maxWidth: 440,
        padding: "28px 26px",
        boxShadow: `var(--sh-modal), 0 0 0 1px ${tint.hue}22`,
        animation: "fadeIn 0.2s ease", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -100, right: -60,
          width: 200, height: 200, borderRadius: "50%",
          background: `radial-gradient(circle, ${tint.hue}28 0%, transparent 70%)`,
          pointerEvents: "none", transition: "background 0.25s",
        }} />
        <div style={{ position: "relative" }}>
          {step === 1 ? (
            <>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 19, fontWeight: 600, color: "var(--t1)", fontFamily: FONT_HEADING, marginBottom: 5, letterSpacing: "-0.01em" }}>Start with a template</div>
                <div style={{ fontSize: 13, color: "var(--t2)", fontFamily: FONT, lineHeight: 1.6 }}>Pre-built notebooks &amp; notes for common courses — or start blank.</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxHeight: 340, overflowY: "auto", marginBottom: 18 }}>
                {CLASS_TEMPLATES.map(t => {
                  const sel = template?.id === t.id;
                  return (
                    <button key={t.id} type="button" onClick={() => setTemplate(t)} className="btn-press" style={{
                      textAlign: "left", background: sel ? `${t.color}1f` : "var(--s1)",
                      border: `1.5px solid ${sel ? t.color : "var(--border)"}`,
                      borderRadius: 12, padding: "13px 14px", cursor: "pointer", fontFamily: FONT,
                      display: "flex", flexDirection: "column", gap: 3,
                    }}>
                      <span style={{ fontSize: 22 }}>{t.emoji}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.01em" }}>{t.name}</span>
                      <span style={{ fontSize: 11.5, color: "var(--t3)", fontFamily: FONT }}>{t.notebooks.length ? `${t.notebooks.length} notebooks` : "Empty"}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" onClick={onClose} className="btn-press" style={{
                  background: "transparent", border: "1px solid var(--border-h)", borderRadius: 10,
                  padding: "0 16px", height: 38, color: "var(--t2)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: FONT,
                }}>Cancel</button>
                <button type="button" disabled={!template} onClick={() => advance(template)} className="btn-press" style={{
                  background: template ? `linear-gradient(135deg, ${tint.hue} 0%, ${tint.deep} 100%)` : "var(--s2)",
                  border: "none", borderRadius: 10, padding: "0 22px", height: 38, color: "#fff", fontWeight: 600, fontSize: 13,
                  cursor: template ? "pointer" : "not-allowed", opacity: template ? 1 : 0.5, fontFamily: FONT, letterSpacing: "-0.01em",
                }}>Next →</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 19, fontWeight: 600, color: "var(--t1)", fontFamily: FONT_HEADING, marginBottom: 5, letterSpacing: "-0.01em" }}>New Class</div>
                <div style={{ fontSize: 13, color: "var(--t2)", fontFamily: FONT, lineHeight: 1.6 }}>
                  {hasTemplate ? `${template.notebooks.length} starter notebooks will be added automatically` : "A class holds your units and notes for one course"}
                </div>
              </div>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={lbl}>Class Name</label>
                  <input
                    ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. AP World History" maxLength={80}
                    style={inp}
                    onFocus={e => { e.target.style.borderColor = tint.hue; e.target.style.boxShadow = `0 0 0 3px ${tint.hue}22`; }}
                    onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
                <div>
                  <label style={lbl}>Color</label>
                  <ColorSwatchPicker value={color} onChange={setColor} />
                </div>
                {error && <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "#F87171", fontFamily: FONT }}>{error}</div>}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                  <button type="button" onClick={() => setStep(1)} className="btn-press" style={{
                    background: "transparent", border: "1px solid var(--border-h)",
                    borderRadius: 10, padding: "0 16px", height: 38,
                    color: "var(--t2)", fontSize: 13, fontWeight: 500,
                    cursor: "pointer", fontFamily: FONT, letterSpacing: "-0.01em",
                  }}>← Back</button>
                  <button type="submit" disabled={loading || !title.trim()} className="btn-press" style={{
                    background: `linear-gradient(135deg, ${tint.hue} 0%, ${tint.deep} 100%)`,
                    border: "none", borderRadius: 10, padding: "0 20px", height: 38,
                    color: "#fff", fontWeight: 600, fontSize: 13,
                    cursor: loading || !title.trim() ? "not-allowed" : "pointer",
                    fontFamily: FONT, opacity: loading || !title.trim() ? 0.55 : 1,
                    boxShadow: `0 4px 14px ${tint.hue}55, 0 0 0 1px ${tint.hue}66`,
                    letterSpacing: "-0.01em", transition: "all 0.18s",
                  }}>{loading ? (hasTemplate ? "Setting up your class…" : "Creating…") : "Create Class"}</button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
export function NewUnitModal({ classTitle, onClose, onCreate }) {
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

  const inp = {
    width: "100%", background: "var(--s1)", border: "1px solid var(--border)",
    borderRadius: 10, padding: "0 14px", height: 42, color: "var(--t1)", fontSize: 14,
    fontFamily: FONT, outline: "none", transition: "all 0.18s", letterSpacing: "-0.01em",
  };
  const lbl = {
    fontSize: 11, color: "var(--t2)", fontFamily: FONT,
    letterSpacing: "0.04em", textTransform: "uppercase", display: "block",
    marginBottom: 7, fontWeight: 600,
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
      backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        position: "relative",
        background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
        border: "1px solid var(--border)",
        borderRadius: 18, width: "100%", maxWidth: 440,
        padding: "28px 26px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px var(--acc-bg)",
        animation: "fadeIn 0.2s ease", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -100, right: -60,
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--t1)", fontFamily: FONT_HEADING, marginBottom: 5, letterSpacing: "-0.02em" }}>New Unit</div>
            <div style={{ fontSize: 13, color: "var(--t2)", fontFamily: FONT, lineHeight: 1.55 }}>
              Adding to <span style={{ color: "var(--acc)", fontWeight: 500 }}>{classTitle}</span>
            </div>
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={lbl}>Unit name *</label>
              <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Unit 5 — Revolutions" maxLength={80} style={inp}
                onFocus={e => { e.target.style.borderColor = "var(--acc)"; e.target.style.boxShadow = "0 0 0 3px var(--acc-bg-h)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
              />
            </div>
            <div>
              <label style={lbl}>Topic / description</label>
              <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Industrial Revolution, causes and effects" maxLength={120} style={inp}
                onFocus={e => { e.target.style.borderColor = "var(--acc)"; e.target.style.boxShadow = "0 0 0 3px var(--acc-bg-h)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
              />
            </div>
            {error && <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "#F87171", fontFamily: FONT }}>{error}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <button type="button" onClick={onClose} className="btn-press" style={{
                background: "transparent", border: "1px solid var(--border-h)",
                borderRadius: 10, padding: "0 16px", height: 38,
                color: "var(--t2)", fontSize: 13, fontWeight: 500,
                cursor: "pointer", fontFamily: FONT, letterSpacing: "-0.01em",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t1)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t2)"; }}
              >Cancel</button>
              <button type="submit" disabled={loading || !title.trim()} className="btn-press" style={{
                background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
                border: "none", borderRadius: 10, padding: "0 20px", height: 38,
                color: "#fff", fontWeight: 600, fontSize: 13,
                cursor: loading || !title.trim() ? "not-allowed" : "pointer",
                fontFamily: FONT, opacity: loading || !title.trim() ? 0.55 : 1,
                boxShadow: "0 4px 14px rgba(167,139,250,0.34), 0 0 0 1px var(--acc-bg-h)",
                letterSpacing: "-0.01em",
              }}>{loading ? "Creating…" : "Create Unit"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
