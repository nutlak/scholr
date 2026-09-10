import { useState } from "react";
import { api } from "../../api.js";
import { AlertTriangle, ArrowRight, CheckCircle, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { FONT } from "../../lib/theme.js";
import { feynmanScoreColor } from "../../lib/format.js";

const fmField = {
  width: "100%", background: "var(--bg-surface-1)", border: "1px solid var(--border-default)",
  borderRadius: 10, padding: "10px 12px", fontSize: 14, color: "var(--text-primary)",
  fontFamily: FONT, outline: "none", boxSizing: "border-box",
};

// ── FeynmanPanel ──────────────────────────────────────────────────────────────
// Active-recall tool: the user explains a concept in plain words and Claude
// grades genuine understanding. Mirrors TheForge/PodcastPanel layout so it
// slots into the same desktop side-panel + mobile overlay containers. Grading
// runs server-side via /api/feynman (key + model stay on the server).
const FEYNMAN_SAMPLES = ["Recursion", "Supply & demand", "Photosynthesis", "Entropy"];

const fmLabel = {
  display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.08em", color: "var(--text-tertiary)", marginBottom: 7, fontFamily: FONT,
};

function FeynmanScoreRing({ score }) {
  const r = 34, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score | 0));
  const offset = c - (pct / 100) * c;
  const color = feynmanScoreColor(pct);
  return (
    <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
      <svg width="88" height="88" viewBox="0 0 80 80" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--bg-surface-3)" strokeWidth="7" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.7,.3,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 23, fontWeight: 700, color, fontFamily: FONT, lineHeight: 1 }}>{pct}</span>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 1 }}>/ 100</span>
      </div>
    </div>
  );
}
function FeynmanSection({ title, items, Icon, color, delay = 0 }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{
      background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)",
      borderRadius: 14, padding: "14px 16px", animation: `slideInUp 0.4s ease ${delay}s both`,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
        fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.06em", color: "var(--text-tertiary)",
      }}>
        <Icon size={14} strokeWidth={2} style={{ color, flexShrink: 0 }} /> {title}
      </div>
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8, margin: 0, padding: 0 }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.5, color: "var(--text-secondary)" }}>
            <span style={{ marginTop: 7, width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0, opacity: 0.85 }} />
            <span style={{ minWidth: 0 }}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
export function FeynmanPanel({ nb, onToast, onUpgradeNeeded }) {
  const [concept, setConcept] = useState(nb?.topic || nb?.title || "");
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const trimmed = explanation.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const canGrade = concept.trim().length > 1 && trimmed.length >= 20 && !loading;

  const sampleChips = [nb?.topic, ...FEYNMAN_SAMPLES]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 4);

  async function grade() {
    if (!canGrade) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const r = await api.feynman({ concept: concept.trim(), explanation: trimmed });
      setResult(r);
      onToast?.(`Scored ${r.score}/100`);
    } catch (e) {
      if (e.code === "message_limit") { onUpgradeNeeded?.("message_limit"); return; }
      setError(e.message || "Couldn't grade that one — try again in a sec.");
    } finally {
      setLoading(false);
    }
  }

  function reset() { setResult(null); setError(""); setExplanation(""); }

  return (
    <div className="tool-content feynman-content">
      {/* Input card */}
      <div style={{
        background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)",
        borderRadius: 14, padding: 18,
      }}>
        <label style={fmLabel}>Concept</label>
        <input
          className="fm-field"
          value={concept}
          onChange={e => setConcept(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (canGrade) grade();
            }
          }}
          placeholder="What are you trying to understand?"
          style={fmField}
        />
        {!result && sampleChips.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {sampleChips.map(c => (
              <button key={c} onClick={() => setConcept(c)} className="btn-press" style={{
                fontSize: 12, padding: "5px 10px", borderRadius: 999,
                border: "1px solid var(--border-default)", background: "transparent",
                color: "var(--text-secondary)", cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap",
              }}>{c}</button>
            ))}
          </div>
        )}

        <label style={{ ...fmLabel, marginTop: 16 }}>Your explanation</label>
        <textarea
          className="fm-field"
          value={explanation}
          onChange={e => setExplanation(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canGrade) grade();
            }
          }}
          rows={6}
          placeholder="Explain it in plain words, as if teaching a curious 12-year-old. No jargon you can't unpack."
          style={{ ...fmField, resize: "none", lineHeight: 1.55, minHeight: 124 }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
            {trimmed.length < 20 ? "A little more detail unlocks grading" : `${words} word${words === 1 ? "" : "s"}`}
          </span>
          <button onClick={grade} disabled={!canGrade} className="btn-press" style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            borderRadius: 10, padding: "0 16px", height: 38, border: "none",
            background: canGrade ? "var(--acc)" : "var(--bg-surface-3)",
            color: canGrade ? "#fff" : "var(--text-tertiary)",
            fontFamily: FONT, fontSize: 13, fontWeight: 600,
            cursor: canGrade ? "pointer" : "not-allowed",
            boxShadow: canGrade ? "0 4px 14px var(--acc-bg-h)" : "none",
            transition: "background 150ms ease, box-shadow 150ms ease",
            flexShrink: 0,
          }}>
            {loading
              ? <><span className="forge-spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} /> Grading…</>
              : <><Sparkles size={14} strokeWidth={2} /> Grade my understanding</>}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--danger)", display: "flex", alignItems: "flex-start", gap: 6 }}>
            <XCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{error}</span>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          {/* Score + verdict */}
          <div style={{
            background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)",
            borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 16,
            animation: "slideInUp 0.4s ease both",
          }}>
            <FeynmanScoreRing score={result.score} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={fmLabel}>Verdict</div>
              <p style={{ fontSize: 14.5, color: "var(--text-primary)", marginTop: 2, lineHeight: 1.4 }}>{result.verdict}</p>
            </div>
          </div>

          {/* AI disclaimer on results — Feynman grades understanding, not academic fact */}
          <div style={{
            fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT,
            textAlign: "center", lineHeight: 1.4, padding: "0 4px",
          }}>
            AI feedback — not a final grade. Review independently for accuracy.
          </div>

          <FeynmanSection title="What you nailed" items={result.nailed} Icon={CheckCircle} color="var(--success)" delay={0.05} />
          <FeynmanSection title="Gaps to close" items={result.gaps} Icon={AlertTriangle} color="var(--warning)" delay={0.1} />
          <FeynmanSection title="Watch out — misconceptions" items={result.misconceptions} Icon={XCircle} color="var(--danger)" delay={0.15} />

          {result.followup && (
            <div style={{
              background: "var(--accent-soft)", border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)",
              borderRadius: 14, padding: 16, animation: "slideInUp 0.4s ease 0.2s both",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--acc-h)",
              }}>
                <ArrowRight size={13} strokeWidth={2.4} /> Push further
              </div>
              <p style={{ fontSize: 14, color: "var(--text-primary)", marginTop: 8, lineHeight: 1.45 }}>{result.followup}</p>
            </div>
          )}

          <button onClick={reset} className="btn-press" style={{
            alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7,
            background: "transparent", border: "none", color: "var(--text-secondary)",
            cursor: "pointer", fontFamily: FONT, fontSize: 13, padding: "6px 2px",
          }}><RotateCcw size={14} strokeWidth={2} /> Try another explanation</button>
        </div>
      )}
    </div>
  );
}
