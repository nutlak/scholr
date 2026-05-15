import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import OtpInput from "./OtpInput.jsx";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

const FONT = `system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif`;

const inputStyle = {
  width: "100%",
  background: "#0A0A0A",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 6,
  padding: "0 12px",
  height: 36,
  color: "#FAFAFA",
  fontSize: 13,
  fontFamily: FONT,
  outline: "none",
  transition: "border-color 0.1s",
};

const btnPrimary = {
  width: "100%",
  background: "#A78BFA",
  border: "none",
  borderRadius: 6,
  height: 36,
  color: "#0A0A0A",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: FONT,
  transition: "background 0.1s",
};

const labelStyle = {
  fontSize: 11,
  color: "rgba(255,255,255,0.4)",
  fontFamily: FONT,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  display: "block",
  marginBottom: 6,
};

const errorBox = {
  background: "rgba(239,68,68,0.08)",
  border: "1px solid rgba(239,68,68,0.2)",
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: 12,
  color: "#EF4444",
  fontFamily: FONT,
};

function focusPurple(e) { e.target.style.borderColor = "#A78BFA"; }
function blurGray(e)    { e.target.style.borderColor = "rgba(255,255,255,0.06)"; }

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

  const [otp, setOtp]                   = useState("");
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
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#111111", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6, width: "100%", maxWidth: 400,
        padding: "24px", boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        animation: "fadeIn 0.15s ease",
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 20, fontWeight: 700,
          color: "#FAFAFA", marginBottom: 4, letterSpacing: "-0.02em", textAlign: "center",
        }}>
          schol<span style={{ color: "#A78BFA" }}>r</span>
        </div>
        <div style={{
          fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center",
          fontFamily: FONT, marginBottom: 24,
        }}>
          AI-powered collaborative notebooks
        </div>
        {children}
      </div>
    </div>
  );

  if (screen === "otp") {
    return shell(
      <>
        <button
          onClick={goBackToTab}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none",
            color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer",
            fontFamily: FONT, marginBottom: 20, padding: 0,
          }}
        >← Back</button>

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#FAFAFA", fontFamily: FONT, marginBottom: 4 }}>
            {otpFlow === "signup" ? "Verify your email" : "Check your email"}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: FONT, lineHeight: 1.6 }}>
            We sent a 6-digit code to{" "}
            <span style={{ color: "#FAFAFA" }}>{pendingEmail}</span>
          </div>
        </div>

        <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <OtpInput value={otp} onChange={setOtp} disabled={loading} />
          {error && <div style={errorBox}>{error}</div>}
          <button
            type="submit"
            disabled={otp.length < 6 || loading}
            style={{ ...btnPrimary, opacity: (otp.length < 6 || loading) ? 0.5 : 1 }}
          >
            {loading ? "Verifying…" : "Verify code"}
          </button>
        </form>

        <div style={{
          marginTop: 14, textAlign: "center",
          fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: FONT,
        }}>
          Didn't receive it?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || loading}
            style={{
              background: "transparent", border: "none",
              color: resendCooldown > 0 ? "rgba(255,255,255,0.25)" : "#A78BFA",
              fontSize: 12, cursor: resendCooldown > 0 ? "default" : "pointer",
              fontFamily: FONT, fontWeight: 600, padding: 0,
            }}
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
        <div style={{ fontSize: 14, fontWeight: 600, color: "#FAFAFA", fontFamily: FONT, marginBottom: 4, marginTop: 4 }}>
          Set a new password
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: FONT, marginBottom: 18, lineHeight: 1.6 }}>
          Choose a strong password for your account.
        </div>

        <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
            style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, marginTop: 4 }}
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
            display: "flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none",
            color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer",
            fontFamily: FONT, marginBottom: 20, padding: 0,
          }}
        >← Back to login</button>

        <div style={{ fontSize: 14, fontWeight: 600, color: "#FAFAFA", fontFamily: FONT, marginBottom: 4 }}>
          Reset your password
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: FONT, marginBottom: 18, lineHeight: 1.6 }}>
          Enter your email and we'll send you a 6-digit verification code.
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
          {error && <div style={errorBox}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, marginTop: 4 }}
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
        display: "flex", background: "#0A0A0A",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 6, padding: 3, marginBottom: 20, gap: 3,
      }}>
        {[["login", "Log in"], ["signup", "Sign up"]].map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            style={{
              flex: 1, padding: "6px", border: "none", borderRadius: 4,
              background: tab === t ? "#1A1A1A" : "transparent",
              color: tab === t ? "#FAFAFA" : "rgba(255,255,255,0.4)",
              fontWeight: tab === t ? 600 : 400,
              fontSize: 13, cursor: "pointer",
              fontFamily: FONT, transition: "all 0.1s",
            }}
          >{label}</button>
        ))}
      </div>

      <form
        onSubmit={tab === "login" ? handleLogin : handleSignup}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
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
                marginTop: 6, background: "transparent", border: "none",
                color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer",
                fontFamily: FONT, padding: 0, transition: "color 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "#A78BFA"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}
            >Forgot password?</button>
          )}
        </div>

        {error && <div style={errorBox}>{error}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, marginTop: 4 }}
        >
          {loading
            ? "Please wait…"
            : tab === "login" ? "Log in" : "Create account"}
        </button>
      </form>
    </>
  );
}
