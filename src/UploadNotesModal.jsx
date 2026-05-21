import { useState, useRef } from "react";
import { api } from "./api.js";
import { CheckCircle, File, Folder } from "lucide-react";

const FONT = `"Outfit", "Poppins", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.md";

const labelStyle = {
  fontSize: 11, color: "rgba(245,245,250,0.55)", fontFamily: FONT,
  letterSpacing: "0.04em", textTransform: "uppercase",
  display: "block", marginBottom: 7, fontWeight: 600,
};

const inputBase = {
  width: "100%",
  background: "#14141F",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 10,
  color: "#F5F5FA",
  fontSize: 14,
  fontFamily: FONT,
  outline: "none",
  transition: "border-color 0.18s, box-shadow 0.18s",
  letterSpacing: "-0.01em",
};

function focusPurple(e) {
  e.target.style.borderColor = "#A78BFA";
  e.target.style.boxShadow = "0 0 0 3px rgba(167,139,250,0.14)";
}
function blurGray(e) {
  e.target.style.borderColor = "rgba(255,255,255,0.09)";
  e.target.style.boxShadow = "none";
}

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
  const accent = "#A78BFA";

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
        borderRadius: 18, width: "100%", maxWidth: 480,
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
            }}>
              Upload Notes
            </div>
            <div style={{ fontSize: 13, color: "rgba(245,245,250,0.55)", fontFamily: FONT, lineHeight: 1.5 }}>
              Text or files — Derek will use them in your next answer.
            </div>
          </div>

          {success ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 14, padding: "32px 0",
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(52,211,153,0.18) 0%, rgba(52,211,153,0.06) 100%)",
                border: "1.5px solid rgba(52,211,153,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#34D399",
                boxShadow: "0 0 24px rgba(52,211,153,0.2)",
              }}><CheckCircle size={28} strokeWidth={1.75} /></div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#34D399", fontFamily: FONT, letterSpacing: "-0.015em" }}>
                Note added!
              </div>
              <div style={{ fontSize: 12, color: "rgba(245,245,250,0.4)", fontFamily: FONT }}>Closing…</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Chapter 5 — Cell Division"
                  maxLength={80}
                  autoFocus
                  style={{ ...inputBase, padding: "0 14px", height: 42 }}
                  onFocus={focusPurple} onBlur={blurGray}
                />
              </div>

              <div style={{
                display: "flex", background: "#0B0B12",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10, padding: 3, gap: 3,
              }}>
                {[["text", "Paste text"], ["file", "Upload file"]].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setMode(id); setError(""); }}
                    style={{
                      flex: 1, padding: "9px", border: "none", borderRadius: 8,
                      background: mode === id
                        ? "linear-gradient(180deg, #252537 0%, #1C1C2A 100%)"
                        : "transparent",
                      color: mode === id ? "#F5F5FA" : "rgba(245,245,250,0.5)",
                      fontWeight: mode === id ? 600 : 500,
                      fontSize: 13, cursor: "pointer",
                      fontFamily: FONT, transition: "all 0.18s",
                      boxShadow: mode === id ? "0 2px 6px rgba(0,0,0,0.35)" : "none",
                      letterSpacing: "-0.01em",
                    }}
                  >{label}</button>
                ))}
              </div>

              {mode === "text" && (
                <div>
                  <label style={labelStyle}>Notes *</label>
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Paste your notes here…"
                    rows={8}
                    style={{
                      ...inputBase, padding: "12px 14px",
                      resize: "vertical", lineHeight: 1.6,
                      minHeight: 140,
                    }}
                    onFocus={focusPurple} onBlur={blurGray}
                  />
                </div>
              )}

              {mode === "file" && (
                <div>
                  <label style={labelStyle}>File *</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDrop}
                    style={{
                      border: `1.5px dashed ${file ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.14)"}`,
                      borderRadius: 12, padding: "28px 18px",
                      display: "flex", flexDirection: "column",
                      alignItems: "center", gap: 10,
                      cursor: "pointer", transition: "all 0.2s ease",
                      background: file
                        ? "linear-gradient(180deg, rgba(167,139,250,0.06) 0%, rgba(167,139,250,0.02) 100%)"
                        : "rgba(255,255,255,0.015)",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(167,139,250,0.5)"; e.currentTarget.style.background = "rgba(167,139,250,0.04)"; }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = file ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.14)";
                      e.currentTarget.style.background = file ? "rgba(167,139,250,0.05)" : "rgba(255,255,255,0.015)";
                    }}
                  >
                    <div style={{ color: file ? "#A78BFA" : "rgba(245,245,250,0.55)", display: "inline-flex" }}>{file ? <File size={30} strokeWidth={1.5} /> : <Folder size={30} strokeWidth={1.5} />}</div>
                    {file ? (
                      <>
                        <div style={{ fontSize: 14, color: "#F5F5FA", fontWeight: 600, fontFamily: FONT, textAlign: "center", wordBreak: "break-all", letterSpacing: "-0.01em" }}>
                          {file.name}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(245,245,250,0.5)", fontFamily: FONT }}>
                          {(file.size / 1024).toFixed(0)} KB · click to change
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 14, color: "rgba(245,245,250,0.65)", fontFamily: FONT, fontWeight: 500 }}>
                          Drop a file or click to browse
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(245,245,250,0.35)", fontFamily: FONT }}>
                          PDF, image, or text · max 10 MB
                        </div>
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
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.22)",
                  borderRadius: 10, padding: "10px 12px",
                  fontSize: 12.5, color: "#F87171", fontFamily: FONT,
                }}>{error}</div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, padding: "0 18px", height: 38,
                    color: "rgba(245,245,250,0.65)", fontSize: 13, fontWeight: 500,
                    cursor: "pointer", fontFamily: FONT, transition: "all 0.18s",
                    letterSpacing: "-0.01em",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "#F5F5FA"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(245,245,250,0.65)"; e.currentTarget.style.background = "transparent"; }}
                >Cancel</button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  style={{
                    background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
                    border: "none",
                    borderRadius: 10, padding: "0 20px", height: 38,
                    color: "#fff", fontWeight: 600, fontSize: 13,
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    fontFamily: FONT,
                    opacity: canSubmit ? 1 : 0.55,
                    transition: "transform 0.15s, box-shadow 0.2s, opacity 0.18s",
                    boxShadow: "0 4px 14px rgba(167,139,250,0.34), 0 0 0 1px rgba(167,139,250,0.4)",
                    letterSpacing: "-0.01em",
                  }}
                  onMouseEnter={e => { if (canSubmit) e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  {loading ? "Uploading…" : "Upload note"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
