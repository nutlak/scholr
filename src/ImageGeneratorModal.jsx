import { useState, useRef, useEffect } from "react";
import { api } from "./api.js";

const FONT = `"Outfit", "Poppins", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;

const inputStyle = {
  width: "100%",
  background: "#14141F",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 10,
  padding: "10px 14px",
  color: "#F5F5FA",
  fontSize: 14,
  fontFamily: FONT,
  outline: "none",
  transition: "border-color 0.18s, box-shadow 0.18s",
  letterSpacing: "-0.01em",
  resize: "vertical",
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

const SIZES = [
  { value: "1024x1024", label: "Square" },
  { value: "1024x1536", label: "Portrait" },
  { value: "1536x1024", label: "Landscape" },
];

function focusPurple(e) {
  e.target.style.borderColor = "#A78BFA";
  e.target.style.boxShadow = "0 0 0 3px rgba(167,139,250,0.14)";
}
function blurGray(e) {
  e.target.style.borderColor = "rgba(255,255,255,0.09)";
  e.target.style.boxShadow = "none";
}

// Convert a base64 image payload into a blob and trigger a Save-As dialog.
async function downloadImage(b64, filename) {
  try {
    const blob = await fetch(`data:image/png;base64,${b64}`).then(r => r.blob());
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Fallback: open the data URI in a new tab so the user can right-click → save
    window.open(`data:image/png;base64,${b64}`, "_blank", "noopener,noreferrer");
  }
}

export default function ImageGeneratorModal({ notebookId, onClose }) {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [n, setN] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState([]); // [{ b64_json, revised_prompt }]
  // Per-image save state, keyed by image index: "idle" | "saving" | "saved" | "error"
  const [saveState, setSaveState] = useState({});
  const promptRef = useRef(null);

  async function handleSave(idx, b64) {
    if (!notebookId) {
      setSaveState(s => ({ ...s, [idx]: "error" }));
      return;
    }
    setSaveState(s => ({ ...s, [idx]: "saving" }));
    try {
      await api.saveImageToNotebook(notebookId, b64);
      setSaveState(s => ({ ...s, [idx]: "saved" }));
    } catch {
      setSaveState(s => ({ ...s, [idx]: "error" }));
    }
  }

  useEffect(() => { promptRef.current?.focus(); }, []);

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget && !loading) onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (trimmed.length < 3) { setError("Prompt must be at least 3 characters."); return; }
    if (trimmed.length > 1000) { setError("Prompt must be 1000 characters or fewer."); return; }

    setError("");
    setLoading(true);
    setImages([]);
    setSaveState({});
    try {
      const { images: out } = await api.generateImage({ prompt: trimmed, size, n });
      setImages(out ?? []);
    } catch (err) {
      if (err.status === 429) {
        setError(err.message || "You're going too fast. Wait a moment and try again.");
      } else if (err.status === 400) {
        setError(err.message || "OpenAI rejected that prompt. Try rewording it.");
      } else {
        setError(err.message || "Image generation failed. Try again.");
      }
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
        borderRadius: 18, width: "100%", maxWidth: 560,
        maxHeight: "92vh", overflowY: "auto",
        padding: "28px 26px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(167,139,250,0.08)",
        animation: "fadeIn 0.2s ease",
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
            }}>Generate Image</div>
            <div style={{ fontSize: 13, color: "rgba(245,245,250,0.55)", fontFamily: FONT, lineHeight: 1.5 }}>
              Describe the image you want.
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Prompt *</label>
              <textarea
                ref={promptRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="A watercolor diagram of the water cycle, soft pastels"
                maxLength={1000}
                rows={3}
                style={inputStyle}
                onFocus={focusPurple} onBlur={blurGray}
                disabled={loading}
              />
              <div style={{
                fontSize: 11, color: "rgba(245,245,250,0.4)",
                fontFamily: FONT, marginTop: 4, textAlign: "right",
              }}>
                {prompt.length}/1000
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Size</label>
                <select
                  value={size}
                  onChange={e => setSize(e.target.value)}
                  disabled={loading}
                  style={{ ...inputStyle, height: 42, padding: "0 14px", cursor: "pointer" }}
                  onFocus={focusPurple} onBlur={blurGray}
                >
                  {SIZES.map(s => (
                    <option key={s.value} value={s.value}>{s.label} — {s.value}</option>
                  ))}
                </select>
              </div>
              <div style={{ width: 110 }}>
                <label style={labelStyle}>Count</label>
                <select
                  value={n}
                  onChange={e => setN(parseInt(e.target.value, 10))}
                  disabled={loading}
                  style={{ ...inputStyle, height: 42, padding: "0 14px", cursor: "pointer" }}
                  onFocus={focusPurple} onBlur={blurGray}
                >
                  {[1, 2, 3, 4].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
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
                disabled={loading}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, padding: "0 18px", height: 38,
                  color: "rgba(245,245,250,0.65)",
                  fontSize: 13, fontWeight: 500,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: FONT, transition: "all 0.18s",
                  letterSpacing: "-0.01em",
                  opacity: loading ? 0.5 : 1,
                }}
              >
                Close
              </button>
              <button
                type="submit"
                disabled={loading || prompt.trim().length < 3}
                style={{
                  background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
                  border: "none",
                  borderRadius: 10, padding: "0 20px", height: 38,
                  color: "#fff", fontWeight: 600, fontSize: 13,
                  cursor: loading || prompt.trim().length < 3 ? "not-allowed" : "pointer",
                  fontFamily: FONT,
                  opacity: loading || prompt.trim().length < 3 ? 0.55 : 1,
                  transition: "transform 0.15s, box-shadow 0.2s, opacity 0.18s",
                  boxShadow: "0 4px 14px rgba(167,139,250,0.34), 0 0 0 1px rgba(167,139,250,0.4)",
                  letterSpacing: "-0.01em",
                }}
              >
                {loading ? "Generating…" : "Generate"}
              </button>
            </div>
          </form>

          {images.length > 0 && (
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              {images.map((img, i) => (
                <div key={i} style={{
                  background: "#0F0F18",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12, overflow: "hidden",
                }}>
                  <img
                    src={`data:image/png;base64,${img.b64_json}`}
                    alt={prompt.trim().slice(0, 60)}
                    style={{ width: "100%", display: "block" }}
                  />
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 12px", gap: 10,
                  }}>
                    <div style={{
                      fontSize: 11, color: "rgba(245,245,250,0.45)",
                      fontFamily: FONT, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {img.revised_prompt || `Image ${i + 1}`}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {(() => {
                        const state = saveState[i] ?? "idle";
                        const saved = state === "saved";
                        const saving = state === "saving";
                        const failed = state === "error";
                        const label = saved ? "Saved!" : saving ? "Saving…" : failed ? "Retry save" : "Save to Notebook";
                        return (
                          <button
                            type="button"
                            onClick={() => handleSave(i, img.b64_json)}
                            disabled={saving || saved}
                            style={{
                              background: saved ? "rgba(52,211,153,0.14)" : "rgba(167,139,250,0.12)",
                              border: saved ? "1px solid rgba(52,211,153,0.32)" : "1px solid rgba(167,139,250,0.3)",
                              borderRadius: 8, padding: "6px 12px",
                              color: saved ? "#6EE7B7" : "#C4B5FD",
                              fontWeight: 600, fontSize: 12,
                              cursor: saving || saved ? "default" : "pointer",
                              fontFamily: FONT,
                              opacity: saving ? 0.7 : 1,
                              transition: "all 0.18s",
                            }}
                          >
                            {label}
                          </button>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => downloadImage(
                          img.b64_json,
                          `image-${Date.now()}-${i + 1}.png`,
                        )}
                        style={{
                          background: "rgba(167,139,250,0.12)",
                          border: "1px solid rgba(167,139,250,0.3)",
                          borderRadius: 8, padding: "6px 12px",
                          color: "#C4B5FD", fontWeight: 600, fontSize: 12,
                          cursor: "pointer", fontFamily: FONT,
                        }}
                      >
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
