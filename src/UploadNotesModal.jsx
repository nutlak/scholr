import { useState, useRef } from "react";
import { api } from "./api.js";
import { CheckCircle, File, Folder } from "lucide-react";
import { useEscape } from "./ui/useEscape.js";
import { FONT } from "./lib/theme.js";

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.md";

const labelStyle = {
  fontSize: 11, color: "var(--text-secondary)", fontFamily: FONT,
  letterSpacing: "0.04em", textTransform: "uppercase",
  display: "block", marginBottom: 7, fontWeight: 600,
};

const inputBase = {
  width: "100%",
  background: "var(--bg-surface-1)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 10,
  color: "var(--text-primary)",
  fontSize: 14,
  fontFamily: FONT,
  outline: "none",
  transition: "border-color 0.18s, box-shadow 0.18s",
  letterSpacing: "-0.01em",
};

function focusPurple(e) {
  e.target.style.borderColor = "var(--acc)";
  e.target.style.boxShadow = "0 0 0 3px rgba(167,139,250,0.14)";
}
function blurGray(e) {
  e.target.style.borderColor = "var(--border-subtle)";
  e.target.style.boxShadow = "none";
}

export default function UploadNotesModal({ notebookId, onClose, onUploaded }) {
  useEscape(onClose);
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
        position: "fixed", inset: 0, background: "var(--overlay)",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 1000, padding: 16,
      }}
    >
      <div style={{
        position: "relative",
        background: "var(--bg-surface-1)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 18, width: "100%", maxWidth: 480,
        padding: "28px 26px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        animation: "fadeIn 0.2s ease",
        overflow: "hidden",
      }}>
        <div style={{ position: "relative" }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{
              fontSize: 18, fontWeight: 600, color: "var(--text-primary)",
              fontFamily: FONT, marginBottom: 5, letterSpacing: "-0.02em",
            }}>
              Add a source
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: FONT, lineHeight: 1.5 }}>
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
                background: "var(--bg-surface-2)",
                border: "1.5px solid rgba(52,211,153,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--success)",
                boxShadow: "0 0 24px rgba(52,211,153,0.2)",
              }}><CheckCircle size={28} strokeWidth={1.75} /></div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--success)", fontFamily: FONT, letterSpacing: "-0.015em" }}>
                Note added!
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: FONT }}>Closing…</div>
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
                display: "flex", background: "var(--bg-surface-1)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 10, padding: 3, gap: 3,
              }}>
                {[["text", "Write or paste"], ["file", "Upload a file"]].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setMode(id); setError(""); }}
                    style={{
                      flex: 1, padding: "9px", border: "none", borderRadius: 8,
                      background: mode === id
                        ? "var(--acc-bg-h)"
                        : "transparent",
                      color: mode === id ? "var(--acc)" : "var(--text-secondary)",
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
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (canSubmit) handleSubmit(e);
                      }
                    }}
                    placeholder="Write or paste your notes here…"
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
                      border: `1.5px dashed ${file ? "var(--acc)" : "var(--border-default)"}`,
                      borderRadius: 12, padding: "28px 18px",
                      display: "flex", flexDirection: "column",
                      alignItems: "center", gap: 10,
                      cursor: "pointer", transition: "all 0.2s ease",
                      background: file
                        ? "var(--acc-bg)"
                        : "rgba(255,255,255,0.015)",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--acc)"; e.currentTarget.style.background = "var(--acc-bg)"; }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = file ? "var(--acc)" : "var(--border-default)";
                      e.currentTarget.style.background = file ? "var(--acc-bg)" : "var(--bg-surface-2)";
                    }}
                  >
                    <div style={{ color: file ? "var(--acc)" : "var(--text-secondary)", display: "inline-flex" }}>{file ? <File size={30} strokeWidth={1.5} /> : <Folder size={30} strokeWidth={1.5} />}</div>
                    {file ? (
                      <>
                        <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600, fontFamily: FONT, textAlign: "center", wordBreak: "break-all", letterSpacing: "-0.01em" }}>
                          {file.name}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: FONT }}>
                          {(file.size / 1024).toFixed(0)} KB · click to change
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 14, color: "var(--text-secondary)", fontFamily: FONT, fontWeight: 500 }}>
                          Drop a file or click to browse
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: FONT }}>
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
                  fontSize: 12.5, color: "var(--danger)", fontFamily: FONT,
                }}>{error}</div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-default)",
                    borderRadius: 10, padding: "0 18px", height: 38,
                    color: "var(--text-secondary)", fontSize: 13, fontWeight: 500,
                    cursor: "pointer", fontFamily: FONT, transition: "all 0.18s",
                    letterSpacing: "-0.01em",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--bg-surface-2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "transparent"; }}
                >Cancel</button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  style={{
                    background: "var(--acc)",
                    border: "none",
                    borderRadius: 10, padding: "0 20px", height: 38,
                    color: "var(--on-acc)", fontWeight: 600, fontSize: 13,
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    fontFamily: FONT,
                    opacity: canSubmit ? 1 : 0.55,
                    transition: "transform 0.15s, box-shadow 0.2s, opacity 0.18s",
                    boxShadow: "none",
                    letterSpacing: "-0.01em",
                  }}
                  onMouseEnter={e => { if (canSubmit) e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  {loading ? "Adding…" : "Add source"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
