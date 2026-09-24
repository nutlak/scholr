import { FONT, FONT_HEADING } from "../../lib/theme.js";
import { useEscape } from "../../ui/useEscape.js";
import { useState } from "react";


export function StreakMilestoneModal({ day, onClose }) {
  useEscape(onClose);
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      await navigator.clipboard.writeText(`I'm on a ${day}-day study streak on Scholr! scholr.dev`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, maxWidth: 380, width: "100%", textAlign: "center", animation: "onbSlide 0.3s ease" }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>🔥</div>
        <div style={{ fontFamily: FONT_HEADING, fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{day}-day streak!</div>
        <div style={{ fontFamily: FONT, fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>You're on fire. Keep it up.</div>
        <button onClick={share} aria-live="polite" style={{ width: "100%", height: 44, borderRadius: 10, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-primary)", fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}>{copied ? "Copied! ✓" : "Share my streak"}</button>
        <button onClick={onClose} style={{ width: "100%", height: 44, borderRadius: 10, border: "none", background: "var(--acc)", color: "var(--on-acc)", fontFamily: FONT, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Keep going →</button>
      </div>
    </div>
  );
}
