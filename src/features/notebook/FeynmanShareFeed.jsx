import { Flame, Lightbulb, ThumbsUp } from "lucide-react";
import { FONT } from "../../lib/theme.js";
import { feynmanScoreColor } from "../../lib/format.js";

// The stored reaction is still the emoji string (the server and other clients key
// on it); only the drawing is an icon.
const REACT_EMOJI = ["🔥", "👏", "🤯"];
const REACT_ICON = { "🔥": Flame, "👏": ThumbsUp, "🤯": Lightbulb };
const ReactIcon = ({ emoji, size = 14 }) => { const I = REACT_ICON[emoji]; return I ? <I size={size} strokeWidth={2} /> : null; };

// Live feed of Feynman explanations shared into this study room (see
// FeynmanPanel's "Share with study room" button + shareFeynmanToRoom).
// Reactions are the whole "friend grades it too" loop for v1 — Derek still
// does the real scoring, friends just get to react to it in the moment.
export function FeynmanShareFeed({ me, shares, reactions, onReact }) {
  if (!shares || shares.length === 0) return null;

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 8,
      padding: "12px 14px", background: "var(--card-bg)", border: "1px solid var(--card-border)",
      fontFamily: FONT,
    }}>
      {shares.map(s => {
        const shareReactions = Object.values(reactions[s.id] || {});
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13 }}>
              <b>{s.name}{s.userId === me?.userId ? " (you)" : ""}</b> explained <i>{s.concept}</i>
            </span>
            <span style={{
              fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums",
              color: feynmanScoreColor(s.score),
            }}>{s.score}/100</span>
            <span style={{ flex: "1 1 auto" }} />
            <div style={{ display: "flex", gap: 4 }}>
              {REACT_EMOJI.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => onReact(s.id, emoji)}
                  className="btn-press"
                  style={{
                    width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
                    background: "var(--pill-bg)", border: "1px solid var(--pill-border)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)",
                  }}
                ><ReactIcon emoji={emoji} /></button>
              ))}
            </div>
            {shareReactions.length > 0 && (
              <span style={{ fontSize: 12, color: "var(--text-tertiary)", display: "inline-flex", gap: 4 }}>
                {shareReactions.map((r, i) => <ReactIcon key={i} emoji={r.emoji} size={13} />)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
