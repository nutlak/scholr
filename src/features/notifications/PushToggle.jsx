import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { FONT } from "../../lib/theme.js";
import { pushSupported, getPushSubscription, enablePush, disablePush } from "../../lib/push.js";
import { serverFeatures } from "../../api.js";

// Settings row for "a friend just started studying" push notifications.
// Opt-in only — nothing subscribes until the toggle is flipped, matching the
// study room's opt-in presence model.
export function PushToggle() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // null = still asking. Fails open, so a failed check shows the toggle.
  const [serverReady, setServerReady] = useState(null);
  const supported = pushSupported();

  useEffect(() => {
    if (!supported) return;
    getPushSubscription().then(sub => setEnabled(!!sub)).catch(() => {});
  }, [supported]);

  // The browser supporting push isn't enough — the server needs VAPID keys.
  // Without this the toggle looked live and only failed on click.
  useEffect(() => {
    serverFeatures().then(f => setServerReady(f.push !== false));
  }, []);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
      } else {
        await enablePush();
        setEnabled(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: FONT, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
        Notifications
      </div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 16, flexWrap: "wrap", padding: "14px 0", marginBottom: 32,
        borderBottom: "1px solid var(--border-subtle)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {enabled ? <Bell size={18} strokeWidth={1.9} color="var(--accent)" /> : <BellOff size={18} strokeWidth={1.9} color="var(--text-tertiary)" />}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT }}>Friends studying now</div>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT, marginTop: 2 }}>
              {!supported
                ? "Not supported in this browser."
                : serverReady === false
                  ? "Not available yet — we're still setting this up."
                  : "Get a push when a friend starts a study session and you're not already in the app."}
            </div>
            {error && <div style={{ fontSize: 12, color: "var(--danger)", fontFamily: FONT, marginTop: 4 }}>{error}</div>}
          </div>
        </div>
        {supported && serverReady !== false && (
          <button
            onClick={toggle}
            disabled={busy}
            className="btn-press"
            style={{
              minHeight: 36, padding: "0 16px",
              background: enabled ? "transparent" : "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
              border: enabled ? "1px solid var(--border-default)" : 0,
              color: enabled ? "var(--text-secondary)" : "#fff",
              fontFamily: FONT, fontSize: 13, fontWeight: 600,
              cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1,
            }}
          >{busy ? "…" : enabled ? "Turn off" : "Turn on"}</button>
        )}
      </div>
    </>
  );
}
