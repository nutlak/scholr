import { useState, useRef, useEffect } from "react";
import { api } from "./api.js";

const FONT = `"Outfit", "Poppins", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;

// Mirrors the server-side rule: 3–20 chars, lowercase letters/numbers/underscore.
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function UsernameSetupModal({ onDone }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const cleaned = value.trim().toLowerCase();
  const valid = USERNAME_RE.test(cleaned);
  // Live hint as the user types (not an error until they submit).
  const hint = cleaned.length === 0
    ? "Letters, numbers and underscores. 3–20 characters."
    : valid
      ? "Looks good!"
      : "3–20 characters: lowercase letters, numbers, or underscores only.";

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      await api.setMyUsername(cleaned);
      onDone?.(cleaned);
    } catch (err) {
      if (err.status === 409) setError("That username is already taken — try another.");
      else setError(err.message || "Couldn't set username. Try again.");
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(8,8,14,0.82)",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1200, padding: 16,
      }}
    >
      <div className="mobile-sheet" style={{
        position: "relative",
        background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 18, width: "100%", maxWidth: 440,
        padding: "28px 26px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(167,139,250,0.08)",
        animation: "fadeIn 0.2s ease", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -100, right: -60,
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#F5F5FA", fontFamily: FONT, marginBottom: 5, letterSpacing: "-0.02em" }}>
              Choose a username
            </div>
            <div style={{ fontSize: 13, color: "rgba(245,245,250,0.55)", fontFamily: FONT, lineHeight: 1.5 }}>
              This is how friends find and add you. Your email stays private.
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{
              display: "flex", alignItems: "center", gap: 0,
              background: "#14141F",
              border: `1px solid ${error ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.09)"}`,
              borderRadius: 10, paddingLeft: 12, marginBottom: 8,
              transition: "border-color 0.18s, box-shadow 0.18s",
            }}>
              <span style={{ fontSize: 15, color: "rgba(245,245,250,0.4)", fontFamily: FONT }}>@</span>
              <input
                ref={inputRef}
                value={value}
                onChange={e => { setValue(e.target.value); setError(""); }}
                placeholder="yourname"
                maxLength={20}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  padding: "11px 12px", color: "#F5F5FA", fontSize: 14, fontFamily: FONT,
                  letterSpacing: "-0.01em",
                }}
              />
            </div>

            <div style={{
              fontSize: 11.5, fontFamily: FONT, marginBottom: 16,
              color: error ? "#F87171" : valid ? "#6EE7B7" : "rgba(245,245,250,0.45)",
            }}>
              {error || hint}
            </div>

            <button
              type="submit"
              disabled={!valid || saving}
              style={{
                width: "100%", minHeight: 44,
                background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
                border: "none", borderRadius: 10,
                color: "#fff", fontWeight: 600, fontSize: 14, fontFamily: FONT,
                cursor: !valid || saving ? "not-allowed" : "pointer",
                opacity: !valid || saving ? 0.55 : 1,
                boxShadow: "0 4px 14px rgba(167,139,250,0.34)",
                letterSpacing: "-0.01em",
              }}
            >
              {saving ? "Saving…" : "Set username"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
