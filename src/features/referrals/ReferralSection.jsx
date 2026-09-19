import { api } from "../../api.js";
import { FONT } from "../../lib/theme.js";
import { useEffect, useState } from "react";

// ── Referrals settings section (1D) ─────────────────────────────────────────
export function ReferralSection() {
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { api.getReferralStats().then(setStats).catch(() => {}); }, []);
  const link = stats?.referralLink || "";

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  }
  async function invite() {
    if (!email.includes("@")) return;
    setSending(true); setMsg("");
    try {
      await api.sendReferralInvite(email.trim());
      setMsg(`Invite sent to ${email.trim()} ✓`); setEmail("");
      api.getReferralStats().then(setStats).catch(() => {});
    } catch (e) { setMsg(e.message || "Failed to send invite"); }
    setSending(false);
  }

  const hdr = { fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: FONT, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 };
  const field = { height: 40, borderRadius: 10, background: "var(--bg-subtle, rgba(255,255,255,0.04))", border: "1px solid var(--border)", color: "var(--text-primary)", fontFamily: FONT, fontSize: 14, padding: "0 12px", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={hdr}>Referrals</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input readOnly aria-label="Your referral link" value={link} placeholder="loading…" onFocus={e => e.target.select()} style={{ ...field, flex: 1 }} />
        <button onClick={copy} className="btn-press" aria-live="polite" style={{ ...field, width: "auto", padding: "0 16px", cursor: "pointer", color: "var(--acc)", fontWeight: 600 }}>{copied ? "Copied!" : "Copy"}</button>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: FONT, marginBottom: 14 }}>
        {(stats?.invited ?? 0)} friends invited · {(stats?.signedUp ?? 0)} signed up
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input value={email} type="email" aria-label="Friend's email address" onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") invite(); }} placeholder="friend@school.edu" style={{ ...field, flex: 1 }} />
        <button onClick={invite} disabled={sending || !email.includes("@")} className="btn-press" style={{ height: 40, borderRadius: 10, border: "none", padding: "0 16px", background: "linear-gradient(135deg, #A78BFA, #8B5CF6)", color: "#fff", fontFamily: FONT, fontSize: 13.5, fontWeight: 700, cursor: sending || !email.includes("@") ? "not-allowed" : "pointer", opacity: sending || !email.includes("@") ? 0.6 : 1, whiteSpace: "nowrap" }}>{sending ? "Sending…" : "Send invite"}</button>
      </div>
      {msg && <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT, marginBottom: 6 }}>{msg}</div>}
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: FONT, lineHeight: 1.5 }}>
        Studying together works better than studying alone — bring the people you already study with.
      </div>
    </div>
  );
}
