import { useEffect, useState } from "react";
import { Users, Copy, Check } from "lucide-react";
import { FONT } from "../../lib/theme.js";
import { api } from "../../api.js";
import { useServerFeature } from "../../lib/useServerFeature.js";

// Settings > Notifications-adjacent section for the Squad plan: one
// subscription, Pro for up to 5 people. Mirrors ReferralSection's
// self-contained load-on-mount pattern.
export function SquadSection() {
  const [squad, setSquad] = useState(undefined); // undefined = loading, null = none
  const [loadFailed, setLoadFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // Squad checkout needs a Stripe price configured server-side. Without this
  // the button looked live and died on click with an error.
  const available = useServerFeature("squad");

  useEffect(() => {
    // null here renders the "start a squad" pitch, so a failed lookup used to
    // offer a paying Squad member the chance to buy the squad they are already
    // in. undefined keeps the section quiet until we actually know.
    api.getMySquad()
      .then(setSquad)
      .catch(err => {
        if (err?.status === 404) { setSquad(null); return; }
        console.warn("getMySquad failed:", err?.message);
        setLoadFailed(true);
      });
  }, []);

  async function startSquad() {
    setStarting(true);
    setError("");
    try {
      await api.createSquadCheckoutSession(); // navigates away on success
    } catch (err) {
      setError(err.message);
      setStarting(false);
    }
  }

  async function copyInvite() {
    if (!squad?.inviteUrl) return;
    try { await navigator.clipboard.writeText(squad.inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* clipboard unavailable */ }
  }

  const hdr = { fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: FONT, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 };
  const shell = { padding: "14px 0", marginBottom: 32, borderBottom: "1px solid var(--border-subtle)" };

  // Hold the space while loading rather than returning null — the section used
  // to pop in and shove everything below it down. ReferralSection already does
  // this with its "loading…" field.
  // Say so, rather than spinning forever or pitching a squad they may own.
  if (loadFailed) return (
    <>
      <div style={hdr}>Squad plan</div>
      <div style={{ ...shell, fontSize: 13, color: "var(--text-tertiary)", fontFamily: FONT }}>
        Couldn't load your squad. Reload to try again.
      </div>
    </>
  );

  if (squad === undefined) return (
    <>
      <div style={hdr}>Squad plan</div>
      <div style={{ ...shell, fontSize: 13, color: "var(--text-tertiary)", fontFamily: FONT }}>Loading…</div>
    </>
  );

  return (
    <>
      <div style={hdr}>Squad plan</div>
      <div style={shell}>
        {!squad ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <Users size={18} strokeWidth={1.9} color="var(--text-tertiary)" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT }}>One subscription, Pro for up to 5</div>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT, marginTop: 2 }}>
                  Start a squad and invite your study group — everyone gets Pro while it's active.
                </div>
              </div>
            </div>
            {!available ? (
              <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", fontFamily: FONT }}>
                Squad plans are temporarily unavailable — check back soon.
              </div>
            ) : (
              <button onClick={startSquad} disabled={starting} className="btn-press" style={{
                minHeight: 36, padding: "0 16px", borderRadius: 10, border: 0,
                background: "var(--acc)", color: "var(--on-acc)",
                fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: starting ? "default" : "pointer",
                opacity: starting ? 0.7 : 1,
              }}>{starting ? "…" : "Start a squad"}</button>
            )}
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Users size={18} strokeWidth={1.9} color="var(--accent)" />
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT }}>
                {squad.name} &middot; {squad.members.length}/{squad.seats} members
              </div>
              {!squad.active && (
                <span style={{ fontSize: 11, color: "var(--danger)", fontFamily: FONT }}>inactive</span>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {squad.members.map(m => (
                <span key={m.userId} style={{
                  fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT,
                  background: "var(--pill-bg)", border: "1px solid var(--pill-border)",
                  borderRadius: 999, padding: "3px 10px",
                }}>{m.name}</span>
              ))}
            </div>
            {squad.isOwner && squad.inviteUrl && (
              <button onClick={copyInvite} className="btn-press" aria-live="polite" style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                minHeight: 34, padding: "0 14px", borderRadius: 9,
                background: "transparent", border: "1px solid var(--border-default)",
                color: "var(--text-secondary)", fontFamily: FONT, fontSize: 12.5, cursor: "pointer",
              }}>
                {copied ? <Check size={13} strokeWidth={2.2} /> : <Copy size={13} strokeWidth={1.9} />}
                {copied ? "Copied" : "Copy invite link"}
              </button>
            )}
          </>
        )}
        {error && <div style={{ fontSize: 12.5, color: "var(--danger)", fontFamily: FONT, marginTop: 8 }}>{error}</div>}
      </div>
    </>
  );
}
