import { useState, useRef } from "react";
import { api } from "./api.js";

const FONT = `system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif`;
const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.md";

const labelStyle = {
  fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: FONT,
  letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 6,
};

const inputBase = {
  width: "100%", background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 6, color: "#FAFAFA", fontSize: 13,
  fontFamily: FONT, outline: "none",
  transition: "border-color 0.1s",
};

export default function UploadNotesModal({ notebookId, accentColor, onClose, onUploaded }) {
  const [mode, setMode]       = useState("text");
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
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 1000, padding: 16,
      }}
    >
      <div style={{
        background: "#111111", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6, width: "100%", maxWidth: 440,
        padding: "24px", boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        animation: "fadeIn 0.15s ease",
      }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#FAFAFA", fontFamily: FONT, marginBottom: 4, letterSpacing: "-0.01em" }}>
            Upload Notes
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: FONT }}>
            Text or files — Claude will have access on your next question.
          </div>
        </div>

        {success ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 10, padding: "20px 0",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}>✓</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#4ADE80", fontFamily: FONT }}>
              Note added!
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: FONT }}>Closing…</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Title */}
            <div>
              <label style={labelStyle}>Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Chapter 5 — Cell Division"
                maxLength={80}
                autoFocus
                style={{ ...inputBase, padding: "0 12px", height: 36 }}
                onFocus={e => e.target.style.borderColor = "#A78BFA"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
              />
            </div>

            {/* Mode toggle */}
            <div style={{
              display: "flex", background: "#0A0A0A",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 6, padding: 3, gap: 3,
            }}>
              {[["text", "Paste text"], ["file", "Upload file"]].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setMode(id); setError(""); }}
                  style={{
                    flex: 1, padding: "6px", border: "none", borderRadius: 4,
                    background: mode === id ? "#1A1A1A" : "transparent",
                    color: mode === id ? "#FAFAFA" : "rgba(255,255,255,0.4)",
                    fontWeight: mode === id ? 600 : 400,
                    fontSize: 13, cursor: "pointer",
                    fontFamily: FONT, transition: "all 0.1s",
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
                    ...inputBase, padding: "10px 12px",
                    resize: "vertical", lineHeight: 1.6,
                  }}
                  onFocus={e => e.target.style.borderColor = "#A78BFA"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
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
                    border: `1px dashed ${file ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 6, padding: "24px 16px",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 8,
                    cursor: "pointer", transition: "border-color 0.1s, background 0.1s",
                    background: file ? "rgba(167,139,250,0.04)" : "transparent",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(167,139,250,0.4)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = file ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.1)"}
                >
                  <div style={{ fontSize: 24 }}>{file ? "📄" : "📁"}</div>
                  {file ? (
                    <>
                      <div style={{ fontSize: 13, color: "#FAFAFA", fontWeight: 600, fontFamily: FONT, textAlign: "center", wordBreak: "break-all" }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: FONT }}>
                        {(file.size / 1024).toFixed(0)} KB · click to change
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: FONT }}>
                        Drop a file or click to browse
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: FONT }}>PDF, image, or text · max 10 MB</div>
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
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 6, padding: "10px 12px",
                fontSize: 12, color: "#EF4444", fontFamily: FONT,
              }}>{error}</div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 6, padding: "0 16px", height: 36,
                  color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer",
                  fontFamily: FONT, transition: "border-color 0.1s, color 0.1s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; e.currentTarget.style.color = "#FAFAFA"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
              >Cancel</button>
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  background: "#A78BFA", border: "none",
                  borderRadius: 6, padding: "0 20px", height: 36,
                  color: "#0A0A0A", fontWeight: 600, fontSize: 13,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  fontFamily: FONT,
                  opacity: canSubmit ? 1 : 0.5, transition: "opacity 0.1s, background 0.1s",
                }}
                onMouseEnter={e => { if (canSubmit) e.currentTarget.style.background = "#7C3AED"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#A78BFA"; }}
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
