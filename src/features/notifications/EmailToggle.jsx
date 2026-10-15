import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { api } from "../../api.js";
import { FONT } from "../../lib/theme.js";

// Settings row for the optional emails: the short welcome series and the weekly
// recap. The same switch the unsubscribe link in those emails flips, so opting
// out never depends on finding an old email, and a mistaken unsubscribe can be
// undone. Sign-in codes, invitations and billing notices aren't affected.
export function EmailToggle() {
  const [on, setOn] = useState(null); // null until loaded
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getEmailPrefs().then(p => setOn(p.optionalEmail)).catch(() => setOn(null));
  }, []);

  async function toggle() {
    setBusy(true); setError("");
    try { setOn((await api.setEmailPrefs(!on)).optionalEmail); }
    catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <div className="ins-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Mail size={18} strokeWidth={1.9} color={on ? "var(--text-primary)" : "var(--text-tertiary)"} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT }}>Study emails</div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT, marginTop: 2 }}>
            A short welcome series and a weekly recap of what's due. Sign-in codes and billing notices always arrive.
          </div>
          {error && <div role="alert" style={{ fontSize: 12, color: "var(--danger)", fontFamily: FONT, marginTop: 4 }}>{error}</div>}
        </div>
      </div>
      {on !== null && (
        <button onClick={toggle} disabled={busy} className="btn-press" style={{
          minHeight: 36, padding: "0 16px", borderRadius: 10,
          background: on ? "transparent" : "var(--acc)", border: on ? "1px solid var(--border-default)" : 0,
          color: on ? "var(--text-secondary)" : "var(--on-acc)",
          fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1,
        }}>{busy ? "…" : on ? "Turn off" : "Turn on"}</button>
      )}
    </div>
  );
}
