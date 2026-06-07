import { useState, useRef } from "react";
import { api } from "../api.js";

const FONT = `"Mulish", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
const FONT_HEADING = `"Playfair Display", Georgia, "Times New Roman", serif`;

const COLORS = ["#A78BFA", "#F87171", "#34D399", "#60A5FA", "#FBBF24", "#F472B6"];

function displayNameOf(user) {
  return user?.user_metadata?.full_name?.trim() || user?.email?.split("@")[0] || "You";
}

export default function OnboardingWizard({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [className, setClassName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notebookId, setNotebookId] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sentInvites, setSentInvites] = useState([]);
  const [uploadName, setUploadName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef(null);

  const name = displayNameOf(user);

  async function finish() {
    try { await api.completeOnboarding(); } catch { /* non-fatal */ }
    onComplete?.();
  }

  // Step 1 — create class + a default "Unit 1" notebook
  async function handleCreateClass() {
    if (!className.trim()) return;
    setLoading(true); setError("");
    try {
      const cls = await api.createClass(className.trim(), color);
      try {
        const nb = await api.createClassNotebook(cls.id, "Unit 1", "", name);
        setNotebookId(nb.id);
      } catch { /* class made; notebook optional */ }
      setStep(2);
    } catch (err) {
      setError(err.message || "Couldn't create the class. Try again.");
    }
    setLoading(false);
  }

  // Step 2 — upload a file or paste text into the new notebook
  async function handleFile(file) {
    if (!file || !notebookId) { setStep(3); return; }
    setLoading(true); setError("");
    try {
      await api.uploadNote(notebookId, { file });
      setUploadName(file.name);
      setTimeout(() => setStep(3), 500);
    } catch (err) {
      setError(err.message || "Upload failed.");
      setLoading(false);
    }
  }
  async function handlePaste() {
    if (!pasteText.trim() || !notebookId) { setStep(3); return; }
    setLoading(true); setError("");
    try {
      await api.uploadNote(notebookId, { title: "My notes", content: pasteText.trim() });
      setStep(3);
    } catch (err) {
      setError(err.message || "Couldn't save notes.");
    }
    setLoading(false);
  }

  // Step 3 — invite study group
  async function handleInvite() {
    const email = inviteEmail.trim();
    if (!email || !email.includes("@") || !notebookId) return;
    setLoading(true); setError("");
    try {
      await api.createInvite(notebookId, email);
      setSentInvites((s) => [...s, email]);
      setInviteEmail("");
    } catch (err) {
      setError(err.message || "Couldn't send invite.");
    }
    setLoading(false);
  }

  return (
    <div
      className="onboarding-overlay"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        className="onboarding-card"
        style={{
          position: "relative", width: "100%", maxWidth: 480,
          background: "var(--card-bg)", border: "1px solid var(--border)",
          borderRadius: 16, padding: "32px 28px",
          boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        {/* Progress dots */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 28 }}>
          {[1, 2, 3].map((n) => (
            <span key={n} style={{
              width: n === step ? 24 : 8, height: 8, borderRadius: 999,
              background: n <= step ? "var(--accent)" : "var(--border-strong, rgba(255,255,255,0.15))",
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>

        <div key={step} className="onboarding-step" style={{ animation: "onbSlide 0.32s ease" }}>
          {step === 1 && (
            <>
              <h2 style={{ fontFamily: FONT_HEADING, fontSize: 26, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px", letterSpacing: "-0.01em" }}>
                Welcome to Scholr 👋
              </h2>
              <div style={{ fontFamily: FONT_HEADING, fontSize: 19, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                Let's set up your first class
              </div>
              <p style={{ fontFamily: FONT, fontSize: 14, color: "var(--text-secondary)", margin: "0 0 22px", lineHeight: 1.5 }}>
                It takes 30 seconds. Promise.
              </p>

              <label style={labelStyle}>Class name</label>
              <input
                autoFocus
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateClass(); }}
                placeholder="AP Biology"
                maxLength={80}
                style={inputStyle}
              />

              <label style={{ ...labelStyle, marginTop: 18 }}>Pick a color</label>
              <div style={{ display: "flex", gap: 12, marginBottom: 26 }}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    aria-label={`color ${c}`}
                    style={{
                      width: 34, height: 34, borderRadius: "50%", background: c, cursor: "pointer",
                      border: color === c ? "3px solid var(--text-primary)" : "3px solid transparent",
                      boxShadow: color === c ? `0 0 0 2px ${c}` : "none",
                      transition: "transform 0.15s",
                    }}
                  />
                ))}
              </div>

              {error && <div style={errStyle}>{error}</div>}

              <button
                onClick={handleCreateClass}
                disabled={loading || !className.trim()}
                style={primaryBtn(loading || !className.trim())}
              >
                {loading ? "Creating…" : "Create class →"}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={headingStyle}>Drop in your notes</h2>
              <p style={subStyle}>PDF, image, or paste text — Derek will analyze them instantly.</p>

              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
                style={{
                  border: "2px dashed var(--border-strong, rgba(255,255,255,0.18))",
                  borderRadius: 12, padding: "28px 18px", textAlign: "center", cursor: "pointer",
                  color: "var(--text-secondary)", fontFamily: FONT, fontSize: 14, marginBottom: 16,
                  background: "var(--bg-subtle, rgba(255,255,255,0.02))",
                }}
              >
                {uploadName ? `✓ ${uploadName}` : (loading ? "Uploading…" : "📄 Click or drop a PDF / image here")}
              </div>
              <input
                ref={fileRef} type="file" hidden
                accept=".pdf,.png,.jpg,.jpeg,.txt,.md,.doc,.docx"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />

              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="…or paste your notes here"
                rows={3}
                style={{ ...inputStyle, height: "auto", padding: "10px 14px", resize: "vertical", fontFamily: FONT }}
              />
              {pasteText.trim() && (
                <button onClick={handlePaste} disabled={loading} style={primaryBtn(loading)}>
                  {loading ? "Saving…" : "Save notes →"}
                </button>
              )}

              {error && <div style={errStyle}>{error}</div>}

              <div style={{ textAlign: "center", marginTop: 16 }}>
                <button onClick={() => setStep(3)} style={linkBtn}>Skip for now →</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 style={headingStyle}>Better with friends</h2>
              <p style={subStyle}>Invite classmates to study together.</p>

              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
                  placeholder="classmate@school.edu"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={handleInvite}
                  disabled={loading || !inviteEmail.includes("@") || !notebookId}
                  style={{ ...primaryBtn(loading || !inviteEmail.includes("@") || !notebookId), width: "auto", padding: "0 18px", marginTop: 0 }}
                >
                  Send
                </button>
              </div>

              {!notebookId && (
                <div style={{ ...subStyle, fontSize: 12.5 }}>Create a notebook first to invite people — you can do this anytime from a notebook.</div>
              )}

              {sentInvites.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  {sentInvites.map((e) => (
                    <span key={e} style={{
                      fontFamily: FONT, fontSize: 12.5, color: "var(--accent)",
                      background: "var(--accent-soft, rgba(167,139,250,0.12))",
                      border: "1px solid var(--accent-soft, rgba(167,139,250,0.2))",
                      borderRadius: 999, padding: "5px 12px",
                    }}>✓ {e}</span>
                  ))}
                </div>
              )}

              {error && <div style={errStyle}>{error}</div>}

              <button onClick={finish} style={{ ...primaryBtn(false), marginTop: 20 }}>
                All done! Let's go →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block", fontFamily: FONT, fontSize: 11, fontWeight: 600,
  color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8,
};
const inputStyle = {
  width: "100%", height: 44, padding: "0 14px", borderRadius: 10,
  background: "var(--bg-subtle, rgba(255,255,255,0.04))", border: "1px solid var(--border)",
  color: "var(--text-primary)", fontSize: 15, fontFamily: FONT, outline: "none", boxSizing: "border-box",
};
const headingStyle = { fontFamily: FONT_HEADING, fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px", letterSpacing: "-0.01em" };
const subStyle = { fontFamily: FONT, fontSize: 14, color: "var(--text-secondary)", margin: "0 0 22px", lineHeight: 1.5 };
const errStyle = { fontFamily: FONT, fontSize: 13, color: "#F87171", margin: "12px 0 0" };
const linkBtn = { background: "none", border: "none", color: "var(--text-secondary)", fontFamily: FONT, fontSize: 14, cursor: "pointer", textDecoration: "none" };
function primaryBtn(disabled) {
  return {
    width: "100%", height: 46, marginTop: 20, borderRadius: 10, border: "none",
    background: disabled ? "var(--border-strong, rgba(167,139,250,0.4))" : "linear-gradient(135deg, #A78BFA, #8B5CF6)",
    color: "#fff", fontFamily: FONT, fontSize: 15, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1, transition: "opacity 0.18s, transform 0.15s",
  };
}
