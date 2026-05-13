import { useState } from "react";
import { supabase } from "./supabase.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

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

const btnPrimary = {
  width: "100%",
  background: "#A78BFA",
  border: "none",
  borderRadius: 10,
  padding: "12px",
  color: "#0A0A0F",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  transition: "opacity 0.15s",
};

const labelStyle = {
  fontSize: 11, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif",
  letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6,
};

function focusPurple(e) { e.target.style.borderColor = "#A78BFA"; }
function blurGray(e)    { e.target.style.borderColor = "#2A2A38"; }

export default function AuthModal({ onAuth }) {
  const [tab, setTab]             = useState("login"); // "login" | "signup" | "forgot"
  const [firstName, setFirstName] = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [resetSent, setResetSent] = useState(false);

  function switchTab(t) { setTab(t); setError(""); setResetSent(false); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: firstName.trim() } },
        });
        if (err) throw err;
        onAuth(data.user ?? data.session?.user);
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        onAuth(data.user);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function handleForgot(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send reset email");
      setResetSent(true);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(10,10,15,0.85)",
      backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#111118", border: "1px solid #2A2A38",
        borderRadius: 20, width: "100%", maxWidth: 420,
        padding: "36px 32px", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        animation: "fadeIn 0.25s ease",
      }}>
        <div style={{
          fontFamily: "'Nunito', sans-serif", fontSize: 28, fontWeight: 900,
          color: "#E8E8F0", marginBottom: 6, letterSpacing: "-0.02em", textAlign: "center",
        }}>
          Schol<span style={{ color: "#A78BFA" }}>r</span>
        </div>
        <div style={{
          fontSize: 12, color: "#505070", textAlign: "center",
          fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 28,
        }}>
          AI-powered collaborative notebooks
        </div>

        {/* ── Forgot password view ── */}
        {tab === "forgot" ? (
          resetSent ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "8px 0 12px" }}>
              <div style={{ fontSize: 36, marginBottom: 4 }}>📬</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif" }}>
                Check your email
              </div>
              <div style={{
                fontSize: 13, color: "#505070", textAlign: "center", lineHeight: 1.6,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>
                We sent a reset link to <strong style={{ color: "#D0D0E8" }}>{email}</strong>.
                Click it to set a new password.
              </div>
              <button
                onClick={() => switchTab("login")}
                style={{
                  marginTop: 8, background: "transparent", border: "none",
                  color: "#A78BFA", fontSize: 13, cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
                }}
              >← Back to login</button>
            </div>
          ) : (
            <>
              <button
                onClick={() => switchTab("login")}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "transparent", border: "none",
                  color: "#505070", fontSize: 12, cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 20, padding: 0,
                }}
              >← Back to login</button>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif", marginBottom: 6 }}>
                Reset your password
              </div>
              <div style={{ fontSize: 12, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 20, lineHeight: 1.6 }}>
                Enter your email and we'll send you a link to set a new password.
              </div>
              <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email" required autoFocus
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@school.edu"
                    style={inputStyle} onFocus={focusPurple} onBlur={blurGray}
                  />
                </div>
                {error && (
                  <div style={{
                    background: "#2A1A1A", border: "1px solid #5A2020",
                    borderRadius: 8, padding: "10px 12px",
                    fontSize: 12, color: "#F87171",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}>{error}</div>
                )}
                <button type="submit" disabled={loading}
                  style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, marginTop: 4 }}>
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </>
          )
        ) : (
          /* ── Login / signup view ── */
          <>
            <div style={{
              display: "flex", background: "#0D0D14", borderRadius: 10,
              padding: 4, marginBottom: 24, gap: 4,
            }}>
              {[["login", "Log in"], ["signup", "Sign up"]].map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchTab(t)}
                  style={{
                    flex: 1, padding: "8px", border: "none", borderRadius: 8,
                    background: tab === t ? "#1E1E2E" : "transparent",
                    color: tab === t ? "#E8E8F0" : "#505070",
                    fontWeight: tab === t ? 600 : 400,
                    fontSize: 13, cursor: "pointer",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    transition: "all 0.15s",
                    boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.4)" : "none",
                  }}
                >{label}</button>
              ))}
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {tab === "signup" && (
                <div>
                  <label style={labelStyle}>First name</label>
                  <input
                    type="text" required autoFocus
                    value={firstName} onChange={e => setFirstName(e.target.value)}
                    placeholder="e.g. Noah" maxLength={32}
                    style={inputStyle} onFocus={focusPurple} onBlur={blurGray}
                  />
                </div>
              )}

              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email" required autoFocus={tab === "login"}
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  style={inputStyle} onFocus={focusPurple} onBlur={blurGray}
                />
              </div>

              <div>
                <label style={labelStyle}>Password</label>
                <input
                  type="password" required
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  style={inputStyle} onFocus={focusPurple} onBlur={blurGray}
                />
                {tab === "login" && (
                  <button
                    type="button"
                    onClick={() => switchTab("forgot")}
                    style={{
                      marginTop: 8, background: "transparent", border: "none",
                      color: "#505070", fontSize: 11, cursor: "pointer",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      padding: 0, transition: "color 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = "#A78BFA"}
                    onMouseLeave={e => e.currentTarget.style.color = "#505070"}
                  >Forgot password?</button>
                )}
              </div>

              {error && (
                <div style={{
                  background: "#2A1A1A", border: "1px solid #5A2020",
                  borderRadius: 8, padding: "10px 12px",
                  fontSize: 12, color: "#F87171",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}>{error}</div>
              )}

              <button type="submit" disabled={loading}
                style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, marginTop: 4 }}>
                {loading ? "Please wait…" : tab === "login" ? "Log in" : "Create account"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
