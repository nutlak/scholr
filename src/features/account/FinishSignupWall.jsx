import { useState } from "react";
import { UserCheck } from "lucide-react";
import { api } from "../../api.js";
import { supabase } from "../../supabase.js";
import { FONT, FONT_HEADING } from "../../lib/theme.js";

// Shown to a Google sign-in until it passes the age gate the email signup has
// (see needsSignupCompletion in lib/format.js and the server's requireAuth).

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function FinishSignupWall({ user, onDone }) {
  const [dob, setDob] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [removed, setRemoved] = useState(false);
  const name = (user.user_metadata?.full_name || user.user_metadata?.name || "").split(" ")[0];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!dob || !agreed || loading) return;
    setLoading(true); setError("");
    try {
      const r = await api.completeSignup({ dateOfBirth: dob, termsAccepted: true });
      if (r.deleted) { setRemoved(true); setError(r.error); setLoading(false); return; }
      // The server flagged the account; a fresh session carries the flag.
      const { data, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) throw refreshErr;
      onDone(data.user);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const field = {
    width: "100%", height: 44, padding: "0 12px", borderRadius: 10,
    background: "var(--bg-surface-2)", border: "1px solid var(--border-default)",
    color: "var(--text-primary)", fontSize: 16, fontFamily: FONT,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 4000, background: "var(--bg-base)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: FONT,
    }}>
      <form onSubmit={handleSubmit} style={{
        width: "100%", maxWidth: 440, background: "var(--bg-surface-1)",
        border: "1px solid var(--border-default)", borderRadius: 18, padding: "28px 26px",
        boxShadow: "var(--sh-modal)", display: "grid", gap: 16,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, background: "var(--acc)", color: "var(--on-acc)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><UserCheck size={18} strokeWidth={2} /></div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 19, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT_HEADING, letterSpacing: "-0.02em" }}>
            {removed ? "We can't create this account" : `One more step${name ? `, ${name}` : ""}`}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {removed
              ? "Scholr is for people 13 and older, so we've removed the account. Nothing was saved."
              : "Scholr is for students 13 and up. Add your birthday to finish creating your account."}
          </div>
        </div>

        {!removed && (
          <>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-secondary)" }}>DATE OF BIRTH</span>
              <input id="finish-dob" type="date" required max={today()} value={dob} onChange={e => setDob(e.target.value)} style={field} />
            </label>

            <label style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer" }}>
              <input
                id="finish-terms" type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                style={{ marginTop: 2, width: 18, height: 18, accentColor: "var(--acc)", cursor: "pointer", flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                I agree to Scholr's{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--acc-h)", fontWeight: 600 }}>Terms of Service</a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--acc-h)", fontWeight: 600 }}>Privacy Policy</a>
              </span>
            </label>
          </>
        )}

        {error && !removed && (
          <div style={{
            background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)",
            borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "var(--danger)", lineHeight: 1.5,
          }}>{error}</div>
        )}

        {removed ? (
          <button type="button" onClick={() => supabase.auth.signOut()} style={btn(false)}>Back to scholr</button>
        ) : (
          <button type="submit" disabled={!dob || !agreed || loading} style={btn(!dob || !agreed || loading)}>
            {loading ? "Please wait…" : "Finish signing up"}
          </button>
        )}

        {!removed && (
          <button
            type="button" onClick={() => supabase.auth.signOut()}
            style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 13, fontFamily: FONT, cursor: "pointer", padding: 8 }}
          >Not now — sign out</button>
        )}
      </form>
    </div>
  );
}

const btn = (off) => ({
  width: "100%", height: 44, borderRadius: 10, border: "none",
  background: "var(--acc)", color: "var(--on-acc)", fontWeight: 600, fontSize: 15,
  fontFamily: FONT, cursor: off ? "default" : "pointer", opacity: off ? 0.55 : 1,
});
