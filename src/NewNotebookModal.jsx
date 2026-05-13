import { useState, useRef, useEffect } from "react";

const inputStyle = {
  width: "100%",
  background: "#0D0D14",
  border: "1px solid #2A2A38",
  borderRadius: 10,
  padding: "12px 14px",
  color: "#E8E8F0",
  fontSize: 13,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  outline: "none",
  transition: "border-color 0.15s",
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
        position: "fixed", inset: 0, background: "rgba(10,10,15,0.75)",
        backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 1000, padding: 16,
      }}
    >
      <div style={{
        background: "#111118", border: "1px solid #2A2A38",
        borderRadius: 20, width: "100%", maxWidth: 420,
        padding: "32px 28px", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        animation: "fadeIn 0.2s ease",
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 18, fontWeight: 700, color: "#E8E8F0",
            fontFamily: "'Nunito', sans-serif", marginBottom: 4,
          }}>New Notebook</div>
          <div style={{ fontSize: 12, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Create a shared space for notes and AI Q&amp;A
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{
              fontSize: 11, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif",
              letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6,
            }}>Title *</label>
            <input
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="AP World History"
              maxLength={80}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#A78BFA"}
              onBlur={e => e.target.style.borderColor = "#2A2A38"}
            />
          </div>

          <div>
            <label style={{
              fontSize: 11, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif",
              letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6,
            }}>Topic / Subject</label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Industrial Revolution, Unit 5"
              maxLength={120}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#A78BFA"}
              onBlur={e => e.target.style.borderColor = "#2A2A38"}
            />
          </div>

          {error && (
            <div style={{
              background: "#2A1A1A", border: "1px solid #5A2020",
              borderRadius: 8, padding: "10px 12px",
              fontSize: 12, color: "#F87171",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, background: "transparent", border: "1px solid #2A2A38",
                borderRadius: 10, padding: "11px", color: "#505070",
                fontSize: 13, cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              style={{
                flex: 2, background: "#A78BFA", border: "none",
                borderRadius: 10, padding: "11px", color: "#0A0A0F",
                fontWeight: 700, fontSize: 13, cursor: loading || !title.trim() ? "not-allowed" : "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                opacity: loading || !title.trim() ? 0.55 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {loading ? "Creating…" : "Create Notebook"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
