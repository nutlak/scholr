import { useState, useRef, useEffect } from "react";

const FONT = `"Outfit", "Poppins", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;

const inputStyle = {
  width: "100%",
  background: "#14141F",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 10,
  padding: "0 14px",
  height: 42,
  color: "#F5F5FA",
  fontSize: 14,
  fontFamily: FONT,
  outline: "none",
  transition: "border-color 0.18s, box-shadow 0.18s",
  letterSpacing: "-0.01em",
};

const labelStyle = {
  fontSize: 11,
  color: "rgba(245,245,250,0.55)",
  fontFamily: FONT,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  display: "block",
  marginBottom: 7,
  fontWeight: 600,
};

function focusPurple(e) {
  e.target.style.borderColor = "#A78BFA";
  e.target.style.boxShadow = "0 0 0 3px rgba(167,139,250,0.14)";
}
function blurGray(e) {
  e.target.style.borderColor = "rgba(255,255,255,0.09)";
  e.target.style.boxShadow = "none";
}

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
        position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 1000, padding: 16,
      }}
    >
      <div style={{
        position: "relative",
        background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 18, width: "100%", maxWidth: 440,
        padding: "28px 26px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(167,139,250,0.08)",
        animation: "fadeIn 0.2s ease",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -100, right: -60,
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{
              fontSize: 18, fontWeight: 600, color: "#F5F5FA",
              fontFamily: FONT, marginBottom: 5, letterSpacing: "-0.02em",
            }}>New Notebook</div>
            <div style={{ fontSize: 13, color: "rgba(245,245,250,0.55)", fontFamily: FONT, lineHeight: 1.5 }}>
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
                onFocus={focusPurple} onBlur={blurGray}
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
                onFocus={focusPurple} onBlur={blurGray}
              />
            </div>

            {error && (
              <div style={{
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.22)",
                borderRadius: 10, padding: "10px 12px",
                fontSize: 12.5, color: "#F87171", fontFamily: FONT,
              }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, padding: "0 18px", height: 38,
                  color: "rgba(245,245,250,0.65)",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                  fontFamily: FONT, transition: "all 0.18s",
                  letterSpacing: "-0.01em",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "#F5F5FA"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(245,245,250,0.65)"; e.currentTarget.style.background = "transparent"; }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !title.trim()}
                style={{
                  background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
                  border: "none",
                  borderRadius: 10, padding: "0 20px", height: 38,
                  color: "#fff", fontWeight: 600, fontSize: 13,
                  cursor: loading || !title.trim() ? "not-allowed" : "pointer",
                  fontFamily: FONT,
                  opacity: loading || !title.trim() ? 0.55 : 1,
                  transition: "transform 0.15s, box-shadow 0.2s, opacity 0.18s",
                  boxShadow: "0 4px 14px rgba(167,139,250,0.34), 0 0 0 1px rgba(167,139,250,0.4)",
                  letterSpacing: "-0.01em",
                }}
                onMouseEnter={e => { if (!loading && title.trim()) e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {loading ? "Creating…" : "Create Notebook"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
