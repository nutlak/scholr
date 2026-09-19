import { api } from "../../api.js";
import { FONT, FONT_HEADING } from "../../lib/theme.js";
import { FileText } from "lucide-react";
import { useState } from "react";

// ── TermsWall — non-dismissible consent gate for existing users ───────────────
// Shown inside the authed app to users who predate the signup age-gate (no
// accepted-terms record). No ✕, no click-outside, no Esc — they must accept to
// continue. On accept, records consent server-side, then lets them through.
export function TermsWall({ onAccepted }) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAccept() {
    if (!agreed || loading) return;
    setLoading(true); setError("");
    try {
      await api.acceptTerms();
      onAccepted();
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 4000,
      background: "color-mix(in srgb, var(--bg-base) 78%, transparent)",
      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, fontFamily: FONT,
    }}>
      <div style={{
        width: "100%", maxWidth: 460,
        background: "var(--bg-surface-1)",
        border: "1px solid var(--border-default)",
        borderRadius: 18, padding: "28px 26px",
        boxShadow: "var(--sh-modal)",
        animation: "fadeIn 0.2s ease",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: "linear-gradient(135deg, var(--acc) 0%, var(--acc-d) 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", marginBottom: 16,
        }}><FileText size={18} strokeWidth={2} /></div>

        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT_HEADING, letterSpacing: "-0.02em", marginBottom: 8 }}>
          We've updated our Terms &amp; Privacy Policy
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
          Please review and accept to continue using Scholr.
        </div>

        <label style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer", marginBottom: 18 }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--acc)", cursor: "pointer", flexShrink: 0 }}
          />
          <span style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            I am at least 13 years old (or the minimum age required in my jurisdiction) and agree to Scholr's{" "}
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--acc-h)", fontWeight: 600 }}>Terms of Service</a>{" "}
            and{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--acc-h)", fontWeight: 600 }}>Privacy Policy</a>
          </span>
        </label>

        {error && (
          <div style={{
            background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)",
            borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "var(--danger)",
            marginBottom: 14, lineHeight: 1.5,
          }}>{error}</div>
        )}

        <button
          onClick={handleAccept}
          disabled={!agreed || loading}
          className="btn-press"
          style={{
            width: "100%", height: 44, borderRadius: 12, border: "none",
            background: (agreed && !loading) ? "linear-gradient(135deg, var(--acc) 0%, var(--acc-d) 100%)" : "var(--bg-surface-3)",
            color: (agreed && !loading) ? "#fff" : "var(--text-tertiary)",
            fontFamily: FONT, fontSize: 14, fontWeight: 600,
            cursor: (agreed && !loading) ? "pointer" : "not-allowed",
            boxShadow: (agreed && !loading) ? "0 6px 20px var(--acc-bg-h)" : "none",
            transition: "background 150ms ease",
          }}
        >{loading ? "Saving…" : "Continue to Scholr"}</button>
      </div>
    </div>
  );
}
