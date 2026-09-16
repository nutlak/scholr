import { FONT } from "../../lib/theme.js";
import { feynmanScoreColor } from "../../lib/format.js";

const REACT_EMOJI = ["🔥", "👏", "🤯"];

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
                    background: "var(--pill-bg)", border: "1px solid var(--pill-border)", fontSize: 13,
                  }}
                >{emoji}</button>
              ))}
            </div>
            {shareReactions.length > 0 && (
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                {shareReactions.map(r => r.emoji).join(" ")}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
