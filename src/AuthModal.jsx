import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import OtpInput from "./OtpInput.jsx";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

// ── Shared styles ─────────────────────────────────────────────────────────────

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
  fontSize: 11,
  color: "#505070",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  display: "block",
  marginBottom: 6,
};

const errorBox = {
  background: "#2A1A1A",
  border: "1px solid #5A2020",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 12,
  color: "#F87171",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};

function focusPurple(e) { e.target.style.borderColor = "#A78BFA"; }
function blurGray(e)    { e.target.style.borderColor = "#2A2A38"; }

// ── AuthModal ─────────────────────────────────────────────────────────────────

export default function AuthModal({ onAuth }) {
  // Tab controls the login/signup/forgot form shown before any OTP screen
  const [tab, setTab]     = useState("login"); // "login" | "signup" | "forgot"
  // Screen overlays the tab UI with OTP or reset-password views
  const [screen, setScreen]   = useState(null);  // null | "otp" | "reset-password"
  const [otpFlow, setOtpFlow] = useState(null);  // "signup" | "password_reset"

  // Tab form fields
  const [firstName, setFirstName] = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");

  // Preserved while on OTP / reset-password screens
  const [pendingEmail,    setPendingEmail]    = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [pendingName,     setPendingName]     = useState("");

  // OTP screen
  const [otp, setOtp]                   = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Reset-password screen
  const [resetToken,       setResetToken]       = useState("");
  const [newPassword,      setNewPassword]      = useState("");
  const [confirmPassword,  setConfirmPassword]  = useState("");

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown === 0) return;
    const id = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function switchTab(t) {
    setTab(t);
    setScreen(null);
    setError("");
    setOtp("");
  }

  function goBackToTab() {
    setScreen(null);
    setError("");
    setOtp("");
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

  // ── Form handlers ──────────────────────────────────────────────────────────

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await sendOtp(email, "signup");
      enterOtpScreen(email, "signup", password, firstName.trim());
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
      await sendOtp(email, "password_reset");
      enterOtpScreen(email, "password_reset");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (otp.length < 6) return;
    setError("");
    setLoading(true);
    try {
      const body = { email: pendingEmail, code: otp, type: otpFlow };
      if (otpFlow === "signup") {
        body.password = pendingPassword;
        body.fullName = pendingName;
      }
      const data = await apiPost("/api/auth/verify-otp", body);

      if (otpFlow === "signup") {
        // Account created — sign in immediately
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email: pendingEmail,
          password: pendingPassword,
        });
        if (authErr) throw authErr;
        onAuth(authData.user);
      } else {
        // Password reset — show new password form
        setResetToken(data.resetToken);
        setNewPassword("");
        setConfirmPassword("");
        setScreen("reset-password");
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function handleResend() {
    if (resendCooldown > 0 || loading) return;
    setError("");
    try {
      await sendOtp(pendingEmail, otpFlow);
      setOtp("");
      setResendCooldown(60);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError("Passwords don't match."); return; }
    if (newPassword.length < 6)          { setError("Password must be at least 6 characters."); return; }
    setError("");
    setLoading(true);
    try {
      await apiPost("/api/auth/reset-password", { resetToken, newPassword });
      // Auto-login after reset
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: pendingEmail,
        password: newPassword,
      });
      if (authErr) throw authErr;
      onAuth(authData.user);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const shell = (children) => (
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
        {children}
      </div>
    </div>
  );

  // ── OTP verification screen ────────────────────────────────────────────────
  if (screen === "otp") {
    return shell(
      <>
        <button
          onClick={goBackToTab}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none",
            color: "#505070", fontSize: 12, cursor: "pointer",
            fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 20, padding: 0,
          }}
        >← Back</button>

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>
            {otpFlow === "signup" ? "📬" : "🔐"}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif", marginBottom: 6 }}>
            {otpFlow === "signup" ? "Verify your email" : "Check your email"}
          </div>
          <div style={{ fontSize: 12, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.6 }}>
            We sent a 6-digit code to<br />
            <strong style={{ color: "#D0D0E8" }}>{pendingEmail}</strong>
          </div>
        </div>

        <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          marginTop: 16, textAlign: "center",
          fontSize: 12, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          Didn't receive it?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || loading}
            style={{
              background: "transparent", border: "none",
              color: resendCooldown > 0 ? "#404060" : "#A78BFA",
              fontSize: 12, cursor: resendCooldown > 0 ? "default" : "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 600, padding: 0,
            }}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
          </button>
        </div>
      </>
    );
  }

  // ── Reset password screen ──────────────────────────────────────────────────
  if (screen === "reset-password") {
    return shell(
      <>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#E8E8F0", fontFamily: "'Nunito', sans-serif", marginBottom: 6, marginTop: 4 }}>
          Set a new password
        </div>
        <div style={{ fontSize: 12, color: "#505070", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 20, lineHeight: 1.6 }}>
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

  // ── Forgot password tab ────────────────────────────────────────────────────
  if (tab === "forgot") {
    return shell(
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

  // ── Login / signup tabs ────────────────────────────────────────────────────
  return shell(
    <>
      {/* Tab switcher */}
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
