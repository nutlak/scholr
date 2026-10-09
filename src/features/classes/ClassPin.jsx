import { useEffect, useState } from "react";
import { Copy, Check, Share } from "lucide-react";
import { api } from "../../api.js";
import { FONT } from "../../lib/theme.js";
import { Sheet } from "../../ui/Sheet.jsx";

// "AB3X7Q" → "AB3 X7Q": two halves are easier to read out and type.
const spaced = (pin) => pin ? `${pin.slice(0, 3)} ${pin.slice(3)}` : "";

const btn = (primary) => ({
  flex: 1, minHeight: 48, borderRadius: 12, cursor: "pointer", fontFamily: FONT, fontSize: 15, fontWeight: 650,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  background: primary ? "var(--acc)" : "transparent", color: primary ? "var(--on-acc)" : "var(--text-primary)",
  border: primary ? "none" : "1px solid var(--border-strong)",
});

// ── Owner side: show the PIN and the link to paste in the group chat ─────────
export function ClassPinSheet({ cls, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getClassPin(cls.id).then(setData).catch(e => setError(e.message));
  }, [cls.id]);

  const message = data ? `Join ${cls.title} on scholr: ${data.link} (PIN ${data.pin})` : "";
  async function share() {
    try { await navigator.share({ title: `Join ${cls.title}`, text: message }); }
    catch { /* cancelled */ }
  }
  async function copy() {
    await navigator.clipboard.writeText(message).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Sheet title={`Invite to ${cls.title}`} onClose={onClose}>
      {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : !data ? <span className="shimmer">Loading…</span> : (
        <>
          <p style={{ margin: "0 0 14px", fontSize: 14.5, lineHeight: 1.5, color: "var(--text-secondary)" }}>
            Paste the link in your class group chat, or read out the PIN. Whoever joins gets every unit in this class and is added as your friend.
          </p>
          <div aria-label={`PIN ${data.pin.split("").join(" ")}`} style={{
            textAlign: "center", fontSize: 44, fontWeight: 700, letterSpacing: "0.12em", padding: "14px 0 18px",
            fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-hand, inherit)", color: "var(--text-primary)",
          }}>{spaced(data.pin)}</div>
          <div style={{ display: "flex", gap: 10 }}>
            {typeof navigator !== "undefined" && navigator.share && (
              <button onClick={share} className="btn-press" style={btn(true)}><Share size={17} strokeWidth={2} /> Share</button>
            )}
            <button onClick={copy} className="btn-press" style={btn(!(typeof navigator !== "undefined" && navigator.share))}>
              {copied ? <><Check size={17} strokeWidth={2} /> Copied</> : <><Copy size={17} strokeWidth={2} /> Copy link</>}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

// ── Joiner side: type a PIN (or arrive with one from a link), see what it is, join
export function JoinClassSheet({ initialPin = "", onClose, onJoined }) {
  const [pin, setPin] = useState(initialPin);
  // Lookups are stored with the PIN they answer, so a stale one never shows.
  const [lookup, setLookup] = useState({ pin: "", preview: null, error: "" });
  const [joinError, setJoinError] = useState("");
  const [busy, setBusy] = useState(false);
  const clean = pin.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const current = lookup.pin === clean ? lookup : { preview: null, error: "" };
  const preview = current.preview;
  const error = joinError || current.error;

  useEffect(() => {
    if (clean.length !== 6) return undefined;
    let live = true;
    api.previewJoin(clean)
      .then(p => live && setLookup({ pin: clean, preview: p, error: "" }))
      .catch(e => live && setLookup({ pin: clean, preview: null, error: e.message }));
    return () => { live = false; };
  }, [clean]);

  async function join() {
    setBusy(true);
    try { onJoined(await api.joinClass(clean)); }
    catch (e) { setJoinError(e.message); setBusy(false); }
  }

  return (
    <Sheet title="Join a class" onClose={onClose}>
      <label htmlFor="class-pin" style={{ display: "block", fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
        Enter the 6-character PIN a classmate shared
      </label>
      <input
        id="class-pin" value={spaced(clean)} onChange={e => { setPin(e.target.value); setJoinError(""); }} autoFocus={!initialPin}
        autoCapitalize="characters" autoCorrect="off" spellCheck={false} inputMode="text" placeholder="ABC 123"
        style={{
          width: "100%", boxSizing: "border-box", height: 64, textAlign: "center", fontSize: 30, fontWeight: 700,
          letterSpacing: "0.12em", borderRadius: 12, border: "1px solid var(--border-strong)", outline: "none",
          background: "var(--bg-base)", color: "var(--text-primary)", fontFamily: "var(--font-hand, inherit)",
        }}
      />
      <div style={{ minHeight: 56, padding: "12px 2px", fontSize: 14.5, lineHeight: 1.45 }}>
        {error ? <span style={{ color: "var(--danger)" }}>{error}</span>
          : preview?.isOwner ? <span style={{ color: "var(--text-secondary)" }}>That's your own class, {preview.classTitle}.</span>
          : preview ? <span><b>{preview.classTitle}</b> from {preview.ownerName} · {preview.units} {preview.units === 1 ? "unit" : "units"}</span>
          : clean.length === 6 && lookup.pin !== clean ? <span className="shimmer">Looking it up…</span> : null}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} className="btn-press" style={btn(false)}>Not now</button>
        <button onClick={join} disabled={!preview || preview.isOwner || busy} className="btn-press"
          style={{ ...btn(true), opacity: !preview || preview.isOwner || busy ? 0.5 : 1 }}>
          {busy ? "Joining…" : "Join class"}
        </button>
      </div>
    </Sheet>
  );
}
