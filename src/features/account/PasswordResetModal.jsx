import { FONT, FONT_HEADING } from "../../lib/theme.js";
import { supabase } from "../../supabase.js";
import { useState } from "react";

export function PasswordResetModal({ onDone }) {
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
    width: "100%", background: "var(--s1)", border: "1px solid var(--border)",
    borderRadius: 10, padding: "0 14px", height: 42, color: "var(--t1)", fontSize: 14,
    fontFamily: FONT, outline: "none", transition: "all 0.18s", letterSpacing: "-0.01em",
  };
  const label = {
    fontSize: 11, color: "var(--t2)", fontFamily: FONT,
    letterSpacing: "0.04em", textTransform: "uppercase", display: "block",
    marginBottom: 7, fontWeight: 600,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
      backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
        border: "1px solid var(--border)",
        borderRadius: 18, width: "100%", maxWidth: 440,
        padding: "28px 26px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px var(--acc-bg)",
        animation: "fadeIn 0.2s ease",
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--t1)", fontFamily: FONT_HEADING, marginBottom: 5, letterSpacing: "-0.02em" }}>
          Set a new password
        </div>
        <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 22, fontFamily: FONT, lineHeight: 1.55 }}>
          Choose a strong password for your account.
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={label}>New password</label>
            <input
              type="password" required autoFocus
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Min 6 characters" style={inputBase}
              onFocus={e => { e.target.style.borderColor = "var(--acc)"; e.target.style.boxShadow = "0 0 0 3px var(--acc-bg-h)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
            />
          </div>
          <div>
            <label style={label}>Confirm password</label>
            <input
              type="password" required
              value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Same password again" style={inputBase}
              onFocus={e => { e.target.style.borderColor = "var(--acc)"; e.target.style.boxShadow = "0 0 0 3px var(--acc-bg-h)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
            />
          </div>
          {error && (
            <div style={{
              background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)",
              borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "#F87171", fontFamily: FONT,
            }}>{error}</div>
          )}
          <button type="submit" disabled={loading} style={{
            width: "100%", background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
            border: "none", borderRadius: 10, height: 42, color: "#fff",
            fontWeight: 600, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
            fontFamily: FONT, opacity: loading ? 0.65 : 1, marginTop: 4,
            transition: "transform 0.15s, box-shadow 0.2s, opacity 0.18s",
            boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
            letterSpacing: "-0.01em",
          }}>
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
