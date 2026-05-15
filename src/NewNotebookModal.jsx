import { useState, useRef, useEffect } from "react";

const FONT = `system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif`;

const inputStyle = {
  width: "100%",
  background: "#0A0A0A",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 6,
  padding: "0 12px",
  height: 36,
  color: "#FAFAFA",
  fontSize: 13,
  fontFamily: FONT,
  outline: "none",
  transition: "border-color 0.1s",
};

const labelStyle = {
  fontSize: 11,
  color: "rgba(255,255,255,0.4)",
  fontFamily: FONT,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  display: "block",
  marginBottom: 6,
};

export default function NewNotebookModal({ onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setError("");
    setLoading(true);
    try {
      await onCreate(title.trim(), topic.trim());
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 1000, padding: 16,
      }}
    >
      <div style={{
        background: "#111111", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6, width: "100%", maxWidth: 400,
        padding: "24px", boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        animation: "fadeIn 0.15s ease",
      }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 15, fontWeight: 600, color: "#FAFAFA",
            fontFamily: FONT, marginBottom: 4, letterSpacing: "-0.01em",
          }}>New Notebook</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: FONT }}>
            Create a shared space for notes and AI Q&amp;A
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Title *</label>
            <input
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="AP World History"
              maxLength={80}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#A78BFA"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
            />
          </div>

          <div>
            <label style={labelStyle}>Topic / Subject</label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Industrial Revolution, Unit 5"
              maxLength={120}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#A78BFA"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 6, padding: "10px 12px",
              fontSize: 12, color: "#EF4444", fontFamily: FONT,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6, padding: "0 16px", height: 36, color: "rgba(255,255,255,0.5)",
                fontSize: 13, cursor: "pointer", fontFamily: FONT,
                transition: "border-color 0.1s, color 0.1s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; e.currentTarget.style.color = "#FAFAFA"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              style={{
                background: "#A78BFA", border: "none",
                borderRadius: 6, padding: "0 20px", height: 36,
                color: "#0A0A0A", fontWeight: 600, fontSize: 13,
                cursor: loading || !title.trim() ? "not-allowed" : "pointer",
                fontFamily: FONT,
                opacity: loading || !title.trim() ? 0.5 : 1,
                transition: "opacity 0.1s, background 0.1s",
              }}
              onMouseEnter={e => { if (!loading && title.trim()) e.currentTarget.style.background = "#7C3AED"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#A78BFA"; }}
            >
              {loading ? "Creating…" : "Create Notebook"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
