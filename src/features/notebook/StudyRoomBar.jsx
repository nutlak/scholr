import { useEffect, useState } from "react";
import { Users, Play, X } from "lucide-react";
import { FONT } from "../../lib/theme.js";
import { useStudyRoom } from "../../lib/live.js";
import { QuizBattlePanel } from "./QuizBattlePanel.jsx";
import { FeynmanShareFeed } from "./FeynmanShareFeed.jsx";

// A live study room scoped to one shared notebook (feature C). Opt-in: nobody
// joins until they hit "Study together", so presence here is deliberate. Shows
// a live roster (join/leave in real time via Supabase Presence) and a shared
// pomodoro timer synced over the same channel — start it and everyone in the
// room sees the same countdown. ponytail: presence + one broadcast, no server,
// no new dep, no DB.
const initials = (name) => (name || "?").trim().slice(0, 1).toUpperCase();

function Countdown({ endsAt }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, endsAt - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const done = ms <= 0;
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: done ? "var(--success)" : "var(--accent)" }}>
      {done ? "Time's up" : `${m}:${String(s).padStart(2, "0")}`}
    </span>
  );
}

export function StudyRoomBar({ notebookId, me }) {
  const [joined, setJoined] = useState(false);
  const {
    members, timer, startTimer, clearTimer, connected, battle, answers, startBattle, submitAnswer, endBattle,
    feynmanShares, feynmanReactions, reactToFeynman,
  } = useStudyRoom(notebookId, me, joined);

  // Not in the room yet — one quiet invitation to start studying together.
  if (!joined) {
    return (
      <button
        onClick={() => setJoined(true)}
        className="btn-press"
        style={{
          display: "inline-flex", alignItems: "center", gap: 8, minHeight: 40, padding: "0 14px",
          background: "var(--pill-bg)", border: "1px solid var(--pill-border)", color: "var(--text-secondary)",
          fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}
      >
        <Users size={15} strokeWidth={1.9} /> Study together
      </button>
    );
  }

  const others = members.filter(m => m.userId !== me.userId);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{
      display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      padding: "10px 14px", background: "var(--card-bg)", border: "1px solid var(--card-border)",
      fontFamily: FONT,
    }}>
      {/* Live roster */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ display: "flex" }}>
          {members.slice(0, 5).map((m, i) => (
            <span key={m.userId} title={m.name} style={{
              width: 26, height: 26, borderRadius: "50%", marginLeft: i ? -7 : 0,
              background: "var(--accent-soft)", border: "1.5px solid var(--card-bg)", color: "var(--accent)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700,
            }}>{initials(m.name)}</span>
          ))}
        </div>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {!connected ? "Connecting…"
            : others.length === 0 ? "You're the first one here"
            : `Studying with ${others.length} ${others.length === 1 ? "other" : "others"}`}
        </span>
      </div>

      <span style={{ flex: "1 1 auto" }} />

      {/* Shared timer */}
      {timer ? (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <Countdown endsAt={timer.endsAt} />
          <button onClick={clearTimer} aria-label="End timer" title="End timer" className="btn-press" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32,
            background: "transparent", border: "1px solid var(--border-default)", color: "var(--text-tertiary)", cursor: "pointer",
          }}><X size={15} strokeWidth={2} /></button>
        </div>
      ) : (
        <button onClick={() => startTimer(25)} className="btn-press" style={{
          display: "inline-flex", alignItems: "center", gap: 7, minHeight: 36, padding: "0 14px",
          background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)", border: 0, color: "#fff",
          fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          <Play size={14} strokeWidth={2.2} /> Start 25-min focus
        </button>
      )}

      <button onClick={() => setJoined(false)} className="btn-press" style={{
        minHeight: 36, padding: "0 12px", background: "transparent",
        border: "1px solid var(--border-default)", color: "var(--text-tertiary)",
        fontFamily: FONT, fontSize: 13, cursor: "pointer",
      }}>Leave</button>
    </div>

      <QuizBattlePanel
        notebookId={notebookId}
        me={me}
        battle={battle}
        answers={answers}
        startBattle={startBattle}
        submitAnswer={submitAnswer}
        endBattle={endBattle}
      />

      <FeynmanShareFeed me={me} shares={feynmanShares} reactions={feynmanReactions} onReact={reactToFeynman} />
    </div>
  );
}
