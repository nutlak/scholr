import { useState, useRef } from "react";
import { api } from "./api.js";

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.md";

const labelStyle = {
  fontSize: 11, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif",
  letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6,
};

const inputBase = {
  width: "100%", background: "#0D0D14", border: "1px solid #2A2A38",
  borderRadius: 10, color: "#E8E8F0", fontSize: 13,
  fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
  transition: "border-color 0.15s",
};

export default function UploadNotesModal({ notebookId, accentColor, onClose, onUploaded }) {
  const [mode, setMode]       = useState("text");   // "text" | "file"
  const [title, setTitle]     = useState("");
  const [content, setContent] = useState("");
  const [file, setFile]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState("");
  const fileRef               = useRef(null);

  const canSubmit = title.trim() && (mode === "text" ? content.trim() : file) && !loading;

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setError(""); }
  }

  function handleDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) { setFile(f); setError(""); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      const note = await api.uploadNote(notebookId, {
        title:   title.trim(),
        content: mode === "text" ? content.trim() : undefined,
        file:    mode === "file" ? file : undefined,
      });
      setSuccess(true);
      onUploaded(note);
      setTimeout(onClose, 1400);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: "fixed", inset: 0, background: "rgba(10,10,15,0.78)",
        backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 1000, padding: 16,
      }}
    >
      <div style={{
        background: "#111118", border: "1px solid #2A2A38",
        borderRadius: 20, width: "100%", maxWidth: 460,
        padding: "32px 28px", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        animation: "fadeIn 0.2s ease",
      }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif", marginBottom: 4 }}>
            Upload Notes
          </div>
          <div style={{ fontSize: 12, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Text or files — Claude will have access on your next question.
          </div>
        </div>

        {success ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 12, padding: "24px 0",
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "#1A2E1A", border: "1px solid #2A5A2A",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
            }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#4ADE80", fontFamily: "'Nunito', sans-serif" }}>
              Note added!
            </div>
            <div style={{ fontSize: 12, color: "#505070" }}>Closing…</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Title */}
            <div>
              <label style={labelStyle}>Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Chapter 5 — Cell Division"
                maxLength={80}
                autoFocus
                style={{ ...inputBase, padding: "11px 13px" }}
                onFocus={e => e.target.style.borderColor = accentColor}
                onBlur={e => e.target.style.borderColor = "#2A2A38"}
              />
            </div>

            {/* Mode toggle */}
            <div style={{
              display: "flex", background: "#0D0D14", borderRadius: 10,
              padding: 4, gap: 4,
            }}>
              {[["text", "Paste text"], ["file", "Upload file"]].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setMode(id); setError(""); }}
                  style={{
                    flex: 1, padding: "8px", border: "none", borderRadius: 8,
                    background: mode === id ? "#1E1E2E" : "transparent",
                    color: mode === id ? "#E8E8F0" : "#505070",
                    fontWeight: mode === id ? 600 : 400,
                    fontSize: 13, cursor: "pointer",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    transition: "all 0.15s",
                    boxShadow: mode === id ? "0 1px 4px rgba(0,0,0,0.4)" : "none",
                  }}
                >{label}</button>
              ))}
            </div>

            {/* Text area */}
            {mode === "text" && (
              <div>
                <label style={labelStyle}>Notes *</label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Paste your notes here…"
                  rows={8}
                  style={{
                    ...inputBase, padding: "11px 13px",
                    resize: "vertical", lineHeight: 1.6,
                  }}
                  onFocus={e => e.target.style.borderColor = accentColor}
                  onBlur={e => e.target.style.borderColor = "#2A2A38"}
                />
              </div>
            )}

            {/* File drop zone */}
            {mode === "file" && (
              <div>
                <label style={labelStyle}>File *</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${file ? accentColor + "88" : "#2A2A38"}`,
                    borderRadius: 12, padding: "28px 16px",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 8,
                    cursor: "pointer", transition: "border-color 0.15s",
                    background: file ? accentColor + "0A" : "transparent",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = accentColor + "66"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = file ? accentColor + "88" : "#2A2A38"}
                >
                  <div style={{ fontSize: 28 }}>{file ? "📄" : "📁"}</div>
                  {file ? (
                    <>
                      <div style={{ fontSize: 13, color: "#D0D0E8", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "center", wordBreak: "break-all" }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: 11, color: "#505070" }}>
                        {(file.size / 1024).toFixed(0)} KB · click to change
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, color: "#606080", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        Drop a file or click to browse
                      </div>
                      <div style={{ fontSize: 11, color: "#404060" }}>PDF, image, or text · max 10 MB</div>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED}
                  onChange={handleFile}
                  style={{ display: "none" }}
                />
              </div>
            )}

            {error && (
              <div style={{
                background: "#2A1A1A", border: "1px solid #5A2020",
                borderRadius: 8, padding: "10px 12px",
                fontSize: 12, color: "#F87171",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>{error}</div>
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
              >Cancel</button>
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  flex: 2, background: accentColor, border: "none",
                  borderRadius: 10, padding: "11px", color: "#0A0A0F",
                  fontWeight: 700, fontSize: 13,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  opacity: canSubmit ? 1 : 0.5, transition: "opacity 0.15s",
                }}
              >
                {loading ? "Uploading…" : "Upload note"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
