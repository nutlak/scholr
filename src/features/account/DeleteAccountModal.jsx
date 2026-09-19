import { FONT, MONO } from "../../lib/theme.js";
import { useEscape } from "../../ui/useEscape.js";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

export function DeleteAccountModal({ onClose, onConfirm }) {
  useEscape(onClose);
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
      position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
      backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
        border: "1px solid rgba(248,113,113,0.18)",
        borderRadius: 18, width: "100%", maxWidth: 420,
        padding: "26px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(248,113,113,0.12)",
        animation: "fadeIn 0.2s ease",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.28)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 14, color: "var(--danger)",
        }}><AlertTriangle size={20} strokeWidth={1.75} /></div>
        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--t1)", fontFamily: FONT, marginBottom: 6, letterSpacing: "-0.015em" }}>
          Delete your account?
        </div>
        <div style={{ fontSize: 13, color: "var(--t2)", fontFamily: FONT, marginBottom: 20, lineHeight: 1.6 }}>
          All notebooks, notes, and data will be <span style={{ color: "#F87171", fontWeight: 500 }}>permanently deleted</span>. This cannot be undone.
        </div>

        <form onSubmit={handleConfirm} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{
              fontSize: 11, color: "var(--t2)", fontFamily: FONT,
              letterSpacing: "0.04em", textTransform: "uppercase",
              display: "block", marginBottom: 7, fontWeight: 600,
            }}>
              Type <span style={{ color: "#F87171", letterSpacing: "0.08em" }}>DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder="DELETE"
              autoFocus
              spellCheck={false}
              style={{
                width: "100%", background: "var(--s1)",
                border: `1px solid ${confirmed ? "rgba(248,113,113,0.45)" : "var(--border)"}`,
                borderRadius: 10, padding: "0 14px", height: 42,
                color: confirmed ? "#F87171" : "var(--t1)",
                fontSize: 14, fontFamily: MONO,
                outline: "none", transition: "all 0.18s",
                letterSpacing: "0.08em",
                boxShadow: confirmed ? "0 0 0 3px rgba(248,113,113,0.12)" : "none",
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)",
              borderRadius: 10, padding: "10px 12px",
              fontSize: 12.5, color: "#F87171", fontFamily: FONT,
            }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-press"
              style={{
                background: "transparent", border: "1px solid var(--border-h)",
                borderRadius: 10, padding: "0 16px", height: 36,
                color: "var(--t2)", fontSize: 13, fontWeight: 500,
                cursor: "pointer", fontFamily: FONT, opacity: loading ? 0.5 : 1,
                letterSpacing: "-0.01em",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t1)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t2)"; }}
            >Cancel</button>
            <button
              type="submit"
              disabled={!confirmed || loading}
              className="btn-press"
              style={{
                background: confirmed ? "linear-gradient(135deg, #F87171 0%, #EF4444 100%)" : "var(--s2)",
                border: confirmed ? "none" : "1px solid var(--border)",
                borderRadius: 10, padding: "0 18px", height: 36,
                color: confirmed ? "#fff" : "var(--t4)",
                fontWeight: 600, fontSize: 13,
                cursor: confirmed && !loading ? "pointer" : "not-allowed",
                fontFamily: FONT,
                boxShadow: confirmed ? "0 4px 14px rgba(248,113,113,0.35)" : "none",
                letterSpacing: "-0.01em",
              }}
            >{loading ? "Deleting…" : "Delete account"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
