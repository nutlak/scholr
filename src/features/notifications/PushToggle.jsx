import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { FONT } from "../../lib/theme.js";
import { pushSupported, getPushSubscription, enablePush, disablePush } from "../../lib/push.js";
import { useServerFeature } from "../../lib/useServerFeature.js";
import { isIOS, isStandalone } from "../../lib/install.js";

// Settings row for "a friend just started studying" push notifications.
// Opt-in only — nothing subscribes until the toggle is flipped, matching the
// study room's opt-in presence model.
export function PushToggle() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // The browser supporting push isn't enough — the server needs VAPID keys.
  // Without this the toggle looked live and only failed on click.
  const serverReady = useServerFeature("push");
  const supported = pushSupported();
  // iOS exposes PushManager only to a site installed to the home screen, so in
  // Safari pushSupported() is false and the row used to read "Not supported in
  // this browser" — which is wrong, and a dead end. It is supported; it needs
  // installing first, and that is something the person can actually act on.
  const needsInstallFirst = !supported && isIOS() && !isStandalone();

  useEffect(() => {
    if (!supported) return;
    getPushSubscription().then(sub => setEnabled(!!sub)).catch(() => {});
  }, [supported]);

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
              {needsInstallFirst
                ? "Add scholr to your home screen first — tap Share in Safari, then Add to Home Screen. iPhone only delivers notifications to installed apps."
                : !supported
                ? "Not supported in this browser."
                : !serverReady
                  ? "Not available yet — we're still setting this up."
                  : "Get a push when a friend starts a study session and you're not already in the app."}
            </div>
            {error && <div style={{ fontSize: 12, color: "var(--danger)", fontFamily: FONT, marginTop: 4 }}>{error}</div>}
          </div>
        </div>
        {supported && serverReady && (
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
