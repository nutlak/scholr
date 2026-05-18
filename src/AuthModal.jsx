import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import OtpInput from "./OtpInput.jsx";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

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
  transition: "border-color 0.18s, box-shadow 0.18s, background 0.18s",
  letterSpacing: "-0.01em",
};

const btnPrimary = {
  width: "100%",
  background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
  border: "none",
  borderRadius: 10,
  height: 42,
  color: "#fff",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  fontFamily: FONT,
  transition: "transform 0.15s, box-shadow 0.2s, opacity 0.18s",
  boxShadow: "0 4px 14px rgba(167,139,250,0.34), 0 0 0 1px rgba(167,139,250,0.4)",
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

const errorBox = {
  background: "rgba(248,113,113,0.08)",
  border: "1px solid rgba(248,113,113,0.22)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 12.5,
  color: "#F87171",
  fontFamily: FONT,
  lineHeight: 1.5,
};

function focusPurple(e) {
  e.target.style.borderColor = "#A78BFA";
  e.target.style.boxShadow = "0 0 0 3px rgba(167,139,250,0.14)";
}
function blurGray(e) {
  e.target.style.borderColor = "rgba(255,255,255,0.09)";
  e.target.style.boxShadow = "none";
}

export default function AuthModal({ onAuth }) {
  const [tab, setTab]     = useState("login");
  const [screen, setScreen]   = useState(null);
  const [otpFlow, setOtpFlow] = useState(null);

  const [firstName, setFirstName] = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");

  const [pendingEmail,    setPendingEmail]    = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [pendingName,     setPendingName]     = useState("");

  const [otp, setOtp]                       = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const [resetToken,       setResetToken]       = useState("");
  const [newPassword,      setNewPassword]      = useState("");
  const [confirmPassword,  setConfirmPassword]  = useState("");

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (resendCooldown === 0) return;
    const id = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  function switchTab(t) {
    setTab(t); setScreen(null); setError(""); setOtp("");
  }
  function goBackToTab() {
    setScreen(null); setError(""); setOtp("");
  }

  async function apiPost(path, body) {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
    return data;
  }
  async function sendOtp(emailAddr, type) {
    return apiPost("/api/auth/send-otp", { email: emailAddr, type });
  }

  function enterOtpScreen(emailAddr, flow, pwd = "", name = "") {
    setPendingEmail(emailAddr);
    setPendingPassword(pwd);
    setPendingName(name);
    setOtp("");
    setOtpFlow(flow);
    setScreen("otp");
    setResendCooldown(60);
  }

  async function handleLogin(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      onAuth(data.user);
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  async function handleSignup(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      await sendOtp(email, "signup");
      enterOtpScreen(email, "signup", password, firstName.trim());
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  async function handleForgot(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      await sendOtp(email, "password_reset");
      enterOtpScreen(email, "password_reset");
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (otp.length < 6) return;
    setError(""); setLoading(true);
    try {
      const body = { email: pendingEmail, code: otp, type: otpFlow };
      if (otpFlow === "signup") {
        body.password = pendingPassword;
        body.fullName = pendingName;
      }
      const data = await apiPost("/api/auth/verify-otp", body);

      if (otpFlow === "signup") {
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email: pendingEmail, password: pendingPassword,
        });
        if (authErr) throw authErr;
        onAuth(authData.user);
      } else {
        setResetToken(data.resetToken);
        setNewPassword(""); setConfirmPassword("");
        setScreen("reset-password");
      }
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  async function handleResend() {
    if (resendCooldown > 0 || loading) return;
    setError("");
    try {
      await sendOtp(pendingEmail, otpFlow);
      setOtp(""); setResendCooldown(60);
    } catch (err) { setError(err.message); }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError("Passwords don't match."); return; }
    if (newPassword.length < 6)          { setError("Password must be at least 6 characters."); return; }
    setError(""); setLoading(true);
    try {
      await apiPost("/api/auth/reset-password", { resetToken, newPassword });
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: pendingEmail, password: newPassword,
      });
      if (authErr) throw authErr;
      onAuth(authData.user);
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  const shell = (children) => (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(8,8,14,0.78)",
      backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
      display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        position: "relative",
        background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 18, width: "100%", maxWidth: 420,
        padding: "32px 28px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(167,139,250,0.08)",
        animation: "fadeIn 0.2s ease",
        overflow: "hidden",
      }}>
        {/* Soft accent glow */}
        <div style={{
          position: "absolute", top: -120, left: "50%", transform: "translateX(-50%)",
          width: 280, height: 280, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            marginBottom: 6,
          }}>
            <img src="/scholr-logo-final.png" alt="scholr" width="48" height="48" style={{ borderRadius: 12, marginBottom: 12, display: "block", objectFit: "cover" }} />
            <div style={{
              fontFamily: FONT, fontSize: 22, fontWeight: 700,
              color: "#F5F5FA", letterSpacing: "-0.03em",
            }}>
              schol<span style={{ color: "#A78BFA" }}>r</span>
            </div>
          </div>
          <div style={{
            fontSize: 12.5, color: "rgba(245,245,250,0.5)", textAlign: "center",
            fontFamily: FONT, marginBottom: 26,
          }}>
            AI-powered collaborative notebooks
          </div>
          {children}
        </div>
      </div>
    </div>
  );

  if (screen === "otp") {
    return shell(
      <>
        <button
          onClick={goBackToTab}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "transparent", border: "none",
            color: "rgba(245,245,250,0.5)", fontSize: 12, cursor: "pointer",
            fontFamily: FONT, marginBottom: 20, padding: "4px 0",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "#F5F5FA"}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(245,245,250,0.5)"}
        >← Back</button>

        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: "linear-gradient(135deg, rgba(167,139,250,0.22), rgba(167,139,250,0.06))",
            border: "1px solid rgba(167,139,250,0.3)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, marginBottom: 12,
          }}>
            {otpFlow === "signup" ? "📬" : "🔐"}
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: "#F5F5FA", fontFamily: FONT, marginBottom: 5, letterSpacing: "-0.015em" }}>
            {otpFlow === "signup" ? "Verify your email" : "Check your email"}
          </div>
          <div style={{ fontSize: 13, color: "rgba(245,245,250,0.55)", fontFamily: FONT, lineHeight: 1.6 }}>
            We sent a 6-digit code to<br />
            <span style={{ color: "#F5F5FA", fontWeight: 500 }}>{pendingEmail}</span>
          </div>
        </div>

        <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <OtpInput value={otp} onChange={setOtp} disabled={loading} />
          {error && <div style={errorBox}>{error}</div>}
          <button
            type="submit"
            disabled={otp.length < 6 || loading}
            style={{ ...btnPrimary, opacity: (otp.length < 6 || loading) ? 0.55 : 1 }}
          >
            {loading ? "Verifying…" : "Verify code"}
          </button>
        </form>

        <div style={{
          marginTop: 18, textAlign: "center",
          fontSize: 12.5, color: "rgba(245,245,250,0.5)", fontFamily: FONT,
        }}>
          Didn't receive it?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || loading}
            style={{
              background: "transparent", border: "none",
              color: resendCooldown > 0 ? "rgba(245,245,250,0.3)" : "#A78BFA",
              fontSize: 12.5, cursor: resendCooldown > 0 ? "default" : "pointer",
              fontFamily: FONT, fontWeight: 600, padding: 0,
              transition: "color 0.15s",
            }}
            onMouseEnter={e => { if (resendCooldown === 0) e.currentTarget.style.color = "#C4B5FD"; }}
            onMouseLeave={e => { if (resendCooldown === 0) e.currentTarget.style.color = "#A78BFA"; }}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
          </button>
        </div>
      </>
    );
  }

  if (screen === "reset-password") {
    return shell(
      <>
        <div style={{ fontSize: 17, fontWeight: 600, color: "#F5F5FA", fontFamily: FONT, marginBottom: 5, letterSpacing: "-0.015em" }}>
          Set a new password
        </div>
        <div style={{ fontSize: 13, color: "rgba(245,245,250,0.55)", fontFamily: FONT, marginBottom: 22, lineHeight: 1.6 }}>
          Choose a strong password for your account.
        </div>

        <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>New password</label>
            <input
              type="password" required autoFocus
              value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              style={inputStyle} onFocus={focusPurple} onBlur={blurGray}
            />
          </div>
          <div>
            <label style={labelStyle}>Confirm password</label>
            <input
              type="password" required
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Same password again"
              style={inputStyle} onFocus={focusPurple} onBlur={blurGray}
            />
          </div>
          {error && <div style={errorBox}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{ ...btnPrimary, opacity: loading ? 0.65 : 1, marginTop: 4 }}
          >
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
      </>
    );
  }

  if (tab === "forgot") {
    return shell(
      <>
        <button
          onClick={() => switchTab("login")}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "transparent", border: "none",
            color: "rgba(245,245,250,0.5)", fontSize: 12, cursor: "pointer",
            fontFamily: FONT, marginBottom: 20, padding: "4px 0",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "#F5F5FA"}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(245,245,250,0.5)"}
        >← Back to login</button>

        <div style={{ fontSize: 17, fontWeight: 600, color: "#F5F5FA", fontFamily: FONT, marginBottom: 5, letterSpacing: "-0.015em" }}>
          Reset your password
        </div>
        <div style={{ fontSize: 13, color: "rgba(245,245,250,0.55)", fontFamily: FONT, marginBottom: 22, lineHeight: 1.6 }}>
          Enter your email and we'll send you a 6-digit verification code.
        </div>

        <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email" required autoFocus
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@school.edu"
              style={inputStyle} onFocus={focusPurple} onBlur={blurGray}
            />
          </div>
          {error && <div style={errorBox}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{ ...btnPrimary, opacity: loading ? 0.65 : 1, marginTop: 4 }}
          >
            {loading ? "Sending…" : "Send code"}
          </button>
        </form>
      </>
    );
  }

  return shell(
    <>
      {/* Tab switcher */}
      <div style={{
        display: "flex", background: "#0B0B12",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10, padding: 3, marginBottom: 22, gap: 3,
      }}>
        {[["login", "Log in"], ["signup", "Sign up"]].map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            style={{
              flex: 1, padding: "8px", border: "none", borderRadius: 8,
              background: tab === t
                ? "linear-gradient(180deg, #252537 0%, #1C1C2A 100%)"
                : "transparent",
              color: tab === t ? "#F5F5FA" : "rgba(245,245,250,0.5)",
              fontWeight: tab === t ? 600 : 500,
              fontSize: 13, cursor: "pointer",
              fontFamily: FONT, transition: "all 0.18s",
              boxShadow: tab === t ? "0 2px 6px rgba(0,0,0,0.35)" : "none",
              letterSpacing: "-0.01em",
            }}
          >{label}</button>
        ))}
      </div>

      <form
        onSubmit={tab === "login" ? handleLogin : handleSignup}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
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
                color: "rgba(245,245,250,0.45)", fontSize: 12, cursor: "pointer",
                fontFamily: FONT, padding: 0, transition: "color 0.15s",
                fontWeight: 500,
              }}
              onMouseEnter={e => e.currentTarget.style.color = "#A78BFA"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(245,245,250,0.45)"}
            >Forgot password?</button>
          )}
        </div>

        {error && <div style={errorBox}>{error}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{ ...btnPrimary, opacity: loading ? 0.65 : 1, marginTop: 4 }}
        >
          {loading
            ? "Please wait…"
            : tab === "login" ? "Log in" : "Create account"}
        </button>
      </form>
    </>
  );
}
