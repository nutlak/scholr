import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import OtpInput from "./OtpInput.jsx";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { ScholrMark } from "./ui/ScholrMark.jsx";
import { FONT, FONT_HEADING } from "./lib/theme.js";
import { getCaptchaToken, preloadCaptcha } from "./lib/turnstile.js";
import { ageFromDob } from "./lib/age.js";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");
// Off until the Google provider is configured in Supabase, so the button never
// ships pointing at a provider that isn't switched on.
const GOOGLE_SIGNIN = import.meta.env.VITE_GOOGLE_SIGNIN === "1";

// Google's sign-in button, dark variant (their branding rules: the official
// multicolour G, "Continue with Google", no recolouring).
const googleBtn = {
  width: "100%", height: 44, borderRadius: 10,
  background: "var(--bg-surface-1)", border: "1px solid #8E918F", color: "#E3E3E3",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  fontFamily: FONT, fontWeight: 500, fontSize: 14, cursor: "pointer",
};
const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

const inputStyle = {
  width: "100%",
  background: "var(--bg-surface-1)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 10,
  padding: "0 14px",
  height: 42,
  color: "var(--text-primary)",
  fontSize: 14,
  fontFamily: FONT,
  outline: "none",
  transition: "border-color 0.18s, box-shadow 0.18s, background 0.18s",
  letterSpacing: "-0.01em",
};

const btnPrimary = {
  width: "100%",
  background: "var(--acc)",
  border: "none",
  borderRadius: 10,
  height: 42,
  color: "var(--on-acc)",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  fontFamily: FONT,
  transition: "transform 0.15s, box-shadow 0.2s, opacity 0.18s",
  boxShadow: "none",
  letterSpacing: "-0.01em",
};

const labelStyle = {
  fontSize: 11,
  color: "var(--text-secondary)",
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
  color: "var(--danger)",
  fontFamily: FONT,
  lineHeight: 1.5,
};

function focusPurple(e) {
  e.target.style.borderColor = "var(--acc)";
  e.target.style.boxShadow = "0 0 0 3px rgba(167,139,250,0.14)";
}
function blurGray(e) {
  e.target.style.borderColor = "var(--border-subtle)";
  e.target.style.boxShadow = "none";
}

export default function AuthModal({ onAuth, initialTab = "login" }) {
  const [tab, setTab]     = useState(initialTab === "signup" ? "signup" : "login");
  const [screen, setScreen]   = useState(null);
  const [otpFlow, setOtpFlow] = useState(null);

  const [firstName, setFirstName] = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [dob, setDob]             = useState(""); // date of birth (YYYY-MM-DD)
  const [agreed, setAgreed]       = useState(false);

  const [pendingEmail,    setPendingEmail]    = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [pendingName,     setPendingName]     = useState("");
  const [pendingDob,      setPendingDob]      = useState("");

  const [otp, setOtp]                       = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const [resetToken,       setResetToken]       = useState("");
  const [newPassword,      setNewPassword]      = useState("");
  const [confirmPassword,  setConfirmPassword]  = useState("");

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(preloadCaptcha, []);

  useEffect(() => {
    if (resendCooldown === 0) return;
    const id = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  function switchTab(t) {
    setTab(t); setScreen(null); setError(""); setOtp(""); setAgreed(false);
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
    return apiPost("/api/auth/send-otp", { email: emailAddr, type, captchaToken: await getCaptchaToken() });
  }
  // Every password sign-in goes through here so each one carries a fresh
  // Turnstile token — Supabase rejects sign-ins without one once its bot
  // protection is switched on.
  async function signIn(emailAddr, pwd) {
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: emailAddr, password: pwd, options: { captchaToken: await getCaptchaToken() },
    });
    if (err) throw err;
    return data.user;
  }

  function enterOtpScreen(emailAddr, flow, pwd = "", name = "", birthDate = "") {
    setPendingEmail(emailAddr);
    setPendingPassword(pwd);
    setPendingName(name);
    setPendingDob(birthDate);
    setOtp("");
    setOtpFlow(flow);
    setScreen("otp");
    setResendCooldown(60);
  }

  async function handleGoogle() {
    setError(""); setLoading(true);
    // Leaves for Google; the session comes back on the redirect and App picks it
    // up. A brand-new account then gets the birthday + terms step before anything.
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (err) { setError(err.message); setLoading(false); }
  }

  async function handleLogin(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      onAuth(await signIn(email, password));
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  async function handleSignup(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      // Age gate (minimum 13). Client-side block — the server re-checks before
      // ever creating the account.
      const age = ageFromDob(dob);
      if (isNaN(age)) { setError("Please enter your date of birth."); setLoading(false); return; }
      if (age < 13) { setError("You must be at least 13 to use Scholr."); setLoading(false); return; }

      await sendOtp(email, "signup");
      enterOtpScreen(email, "signup", password, firstName.trim(), dob);
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
        body.termsAccepted = agreed;
        body.dateOfBirth = pendingDob;
      }
      const data = await apiPost("/api/auth/verify-otp", body);

      if (otpFlow === "signup") {
        onAuth(await signIn(pendingEmail, pendingPassword));
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
    // Mirrors the server's floor so the form doesn't accept something the API
    // will reject. The server owns the real policy (breach + common-password
    // screening); this is only here to fail fast on the obvious case.
    if (newPassword.length < 8)          { setError("Use at least 8 characters."); return; }
    setError(""); setLoading(true);
    try {
      await apiPost("/api/auth/reset-password", { resetToken, newPassword });
      onAuth(await signIn(pendingEmail, newPassword));
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  const shell = (children) => (
    <div style={{
      position: "fixed", inset: 0,
      background: "var(--overlay)",
      backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
      display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        position: "relative",
        background: "var(--bg-surface-1)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 18, width: "100%", maxWidth: 420,
        padding: "32px 28px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        animation: "fadeIn 0.2s ease",
        overflow: "hidden",
      }}>
        <div style={{ position: "relative" }}>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            marginBottom: 6,
          }}>
            <div style={{ marginBottom: 8 }}><ScholrMark size={52} /></div>
            <div style={{
              fontFamily: FONT, fontSize: 22, fontWeight: 600,
              color: "var(--text-primary)", letterSpacing: "-0.03em",
            }}>
              <span>schol<span style={{ color: "var(--acc)" }}>r</span></span>
            </div>
          </div>
          <div style={{
            fontSize: 12.5, color: "var(--text-tertiary)", textAlign: "center",
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
            color: "var(--text-tertiary)", fontSize: 12, cursor: "pointer",
            fontFamily: FONT, marginBottom: 20, padding: "4px 0",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text-tertiary)"}
        >← Back</button>

        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: "var(--acc-bg)",
            border: "1px solid var(--acc)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: "var(--acc)", marginBottom: 12,
          }}>
            {otpFlow === "signup" ? <Mail size={26} strokeWidth={1.75} /> : <Lock size={26} strokeWidth={1.75} />}
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT_HEADING, marginBottom: 5, letterSpacing: "-0.015em" }}>
            {otpFlow === "signup" ? "Verify your email" : "Check your email"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: FONT, lineHeight: 1.6 }}>
            We sent a 6-digit code to<br />
            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{pendingEmail}</span>
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
          fontSize: 12.5, color: "var(--text-tertiary)", fontFamily: FONT,
        }}>
          Didn't receive it?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || loading}
            style={{
              background: "transparent", border: "none",
              color: resendCooldown > 0 ? "var(--text-tertiary)" : "var(--acc)",
              fontSize: 12.5, cursor: resendCooldown > 0 ? "default" : "pointer",
              fontFamily: FONT, fontWeight: 600, padding: 0,
              transition: "color 0.15s",
            }}
            onMouseEnter={e => { if (resendCooldown === 0) e.currentTarget.style.color = "var(--acc)"; }}
            onMouseLeave={e => { if (resendCooldown === 0) e.currentTarget.style.color = "var(--acc)"; }}
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
        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT_HEADING, marginBottom: 5, letterSpacing: "-0.015em" }}>
          Set a new password
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: FONT, marginBottom: 22, lineHeight: 1.6 }}>
          Choose a strong password for your account.
        </div>

        <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>New password</label>
            {/* One reveal for both fields — they have to match, so reading them
                together is the point. Choosing a new password blind, twice, is
                how a reset ends in the lockout it was meant to fix. */}
            <div style={{ position: "relative" }}>
              <input
                type={showNewPassword ? "text" : "password"} required autoFocus
                value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                style={{ ...inputStyle, paddingRight: 46 }}
                onFocus={focusPurple} onBlur={blurGray}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(v => !v)}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
                aria-pressed={showNewPassword}
                style={{
                  position: "absolute", top: 0, right: 0, height: "100%", width: 44,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "transparent", border: "none", cursor: "pointer",
                  color: "var(--text-tertiary)", padding: 0,
                }}
              >{showNewPassword ? <EyeOff size={17} strokeWidth={1.85} /> : <Eye size={17} strokeWidth={1.85} />}</button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Confirm password</label>
            <input
              type={showNewPassword ? "text" : "password"} required
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
            color: "var(--text-tertiary)", fontSize: 12, cursor: "pointer",
            fontFamily: FONT, marginBottom: 20, padding: "4px 0",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text-tertiary)"}
        >← Back to login</button>

        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT_HEADING, marginBottom: 5, letterSpacing: "-0.015em" }}>
          Reset your password
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: FONT, marginBottom: 22, lineHeight: 1.6 }}>
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
        display: "flex", background: "var(--bg-surface-1)",
        border: "1px solid var(--border-subtle)",
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
                ? "var(--acc-bg-h)"
                : "transparent",
              color: tab === t ? "var(--acc)" : "var(--text-secondary)",
              fontWeight: tab === t ? 600 : 500,
              fontSize: 13, cursor: "pointer",
              fontFamily: FONT, transition: "all 0.18s",
              boxShadow: tab === t ? "0 2px 6px rgba(0,0,0,0.35)" : "none",
              letterSpacing: "-0.01em",
            }}
          >{label}</button>
        ))}
      </div>

      {GOOGLE_SIGNIN && (
        <>
          <button type="button" onClick={handleGoogle} disabled={loading} style={{ ...googleBtn, opacity: loading ? 0.55 : 1 }}>
            <GoogleG /> Continue with Google
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0", color: "var(--text-tertiary)", fontSize: 12, fontFamily: FONT }}>
            <span style={{ flex: 1, height: 1, background: "var(--bg-surface-3)" }} />
            or with email
            <span style={{ flex: 1, height: 1, background: "var(--bg-surface-3)" }} />
          </div>
        </>
      )}

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

        {tab === "signup" && (
          <div>
            <label style={labelStyle}>Date of birth</label>
            <input
              type="date" required
              value={dob} onChange={e => setDob(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              style={{ ...inputStyle, minHeight: 44, colorScheme: "dark" }}
              onFocus={focusPurple} onBlur={blurGray}
            />
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 6, fontFamily: FONT }}>
              You must be at least 13 to use Scholr.
            </div>
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
          {/* The reveal sits inside the field. Typing a password blind on a
              phone keyboard is how people end up locked out of an account they
              actually know the password to, and a failed sign-in is far more
              annoying than a character being visible for a second. */}
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"} required
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              style={{ ...inputStyle, paddingRight: 46 }}
              onFocus={focusPurple} onBlur={blurGray}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              style={{
                position: "absolute", top: 0, right: 0,
                height: "100%", width: 44,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: "none", cursor: "pointer",
                color: "var(--text-tertiary)", padding: 0,
              }}
            >
              {showPassword
                ? <EyeOff size={17} strokeWidth={1.85} />
                : <Eye size={17} strokeWidth={1.85} />}
            </button>
          </div>
          {tab === "login" && (
            <button
              type="button"
              onClick={() => switchTab("forgot")}
              style={{
                marginTop: 8, background: "transparent", border: "none",
                color: "var(--text-tertiary)", fontSize: 12, cursor: "pointer",
                fontFamily: FONT, padding: 0, transition: "color 0.15s",
                fontWeight: 500,
              }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--acc)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text-tertiary)"}
            >Forgot password?</button>
          )}
        </div>

        {tab === "signup" && (
          <label style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer", fontFamily: FONT }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--acc)", cursor: "pointer", flexShrink: 0 }}
            />
            <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              I am at least 13 years old (or the minimum age required in my jurisdiction) and agree to Scholr's{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--acc)", fontWeight: 600 }}>Terms of Service</a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--acc)", fontWeight: 600 }}>Privacy Policy</a>
            </span>
          </label>
        )}

        {error && <div style={errorBox}>{error}</div>}

        <button
          type="submit"
          disabled={loading || (tab === "signup" && !agreed)}
          style={{ ...btnPrimary, opacity: (loading || (tab === "signup" && !agreed)) ? 0.55 : 1, marginTop: 4 }}
        >
          {loading
            ? "Please wait…"
            : tab === "login" ? "Log in" : "Create account"}
        </button>
      </form>
    </>
  );
}
