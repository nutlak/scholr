import { useEffect, useMemo, useState } from "react";
import { Swords, Trophy } from "lucide-react";
import { FONT } from "../../lib/theme.js";
import { api } from "../../api.js";

// Live quiz battle inside a study room: reuses the notebook's existing
// spaced-repetition flashcards as questions (no new content to generate) and
// the same broadcast-schedule trick as the room's pomodoro timer — a shared
// startsAt + roundMs lets every client derive "what round is it" from the
// wall clock, so scoring is just tallying battle-answer broadcasts. Self-
// graded ("Got it!"), same honesty model as the existing flashcard review
// flow (SM-2 quality is self-reported there too).
const ROUND_MS = 12000;
const REVEAL_MS = 3000; // extra time per round showing the answer before advancing
const MAX_CARDS = 8;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function scoreFor(atMs, roundStartsAt, roundMs) {
  const elapsed = Math.max(0, atMs - roundStartsAt);
  return Math.max(10, 100 - Math.floor((elapsed / roundMs) * 90));
}

export function QuizBattlePanel({ notebookId, me, battle, answers, startBattle, submitAnswer, endBattle }) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!battle) return undefined;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [battle]);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      const cards = await api.getFlashcards(notebookId);
      if (!cards || cards.length < 3) {
        setError("Generate a few flashcards for this notebook first — quiz battles quiz off those.");
        return;
      }
      const picked = shuffle(cards).slice(0, MAX_CARDS).map(c => ({ front: c.front, back: c.back }));
      startBattle(picked, ROUND_MS);
    } catch {
      setError("Couldn't load flashcards for this notebook.");
    } finally {
      setStarting(false);
    }
  };

  const roundSlotMs = ROUND_MS + REVEAL_MS;
  const elapsedTotal = battle ? now - battle.startsAt : 0;
  const round = battle ? Math.min(Math.floor(elapsedTotal / roundSlotMs), battle.cards.length) : 0;
  const inRound = battle && round < battle.cards.length;
  const roundStartsAt = battle ? battle.startsAt + round * roundSlotMs : 0;
  const roundElapsed = now - roundStartsAt;
  const revealing = inRound && roundElapsed >= ROUND_MS;
  const secsLeft = inRound && !revealing ? Math.ceil((ROUND_MS - roundElapsed) / 1000) : 0;

  const myAnswered = inRound && !!answers[round]?.[me.userId];

  const totals = useMemo(() => {
    const t = new Map();
    for (const [roundKey, roundAnswers] of Object.entries(answers)) {
      const rStartsAt = battle ? battle.startsAt + Number(roundKey) * roundSlotMs : 0;
      for (const [userId, a] of Object.entries(roundAnswers)) {
        const s = scoreFor(a.at, rStartsAt, ROUND_MS);
        const cur = t.get(userId) || { name: a.name, score: 0 };
        t.set(userId, { name: a.name, score: cur.score + s });
      }
    }
    return [...t.entries()]
      .map(([userId, v]) => ({ userId, ...v }))
      .sort((a, b) => b.score - a.score);
  }, [answers, battle, roundSlotMs]);

  if (!battle) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={handleStart} disabled={starting} className="btn-press" style={{
          display: "inline-flex", alignItems: "center", gap: 7, minHeight: 36, padding: "0 14px",
          background: "var(--acc)", border: 0, color: "#fff",
          fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: starting ? "default" : "pointer",
          opacity: starting ? 0.7 : 1,
        }}>
          <Swords size={14} strokeWidth={2.2} /> {starting ? "Loading…" : "Start quiz battle"}
        </button>
        {error && <span style={{ fontSize: 12.5, color: "var(--danger)", fontFamily: FONT }}>{error}</span>}
      </div>
    );
  }

  if (!inRound) {
    return (
      <div style={{
        padding: "14px 16px", background: "var(--card-bg)", border: "1px solid var(--card-border)",
        fontFamily: FONT, display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 }}>
          <Trophy size={16} strokeWidth={2} color="#FBBF24" /> Battle over
        </div>
        {totals.length === 0 ? (
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Nobody answered in time.</span>
        ) : totals.map((t, i) => (
          <div key={t.userId} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
            <span>{i === 0 ? "🏆 " : `${i + 1}. `}{t.name}{t.userId === me.userId ? " (you)" : ""}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{t.score}</span>
          </div>
        ))}
        <button onClick={endBattle} className="btn-press" style={{
          alignSelf: "flex-start", minHeight: 32, padding: "0 12px", background: "transparent",
          border: "1px solid var(--border-default)", color: "var(--text-tertiary)",
          fontFamily: FONT, fontSize: 12.5, cursor: "pointer",
        }}>Close</button>
      </div>
    );
  }

  const card = battle.cards[round];
  return (
    <div style={{
      padding: "14px 16px", background: "var(--card-bg)", border: "1px solid var(--card-border)",
      fontFamily: FONT, display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-tertiary)" }}>
        <span>Question {round + 1} / {battle.cards.length}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{revealing ? "Revealed" : `${secsLeft}s`}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{card.front}</div>
      {revealing && (
        <div style={{ fontSize: 13.5, color: "var(--text-secondary)", paddingTop: 2, borderTop: "1px solid var(--border-subtle)" }}>
          {card.back}
        </div>
      )}
      {!revealing && (
        <button
          onClick={() => submitAnswer(round)}
          disabled={myAnswered}
          className="btn-press"
          style={{
            alignSelf: "flex-start", minHeight: 36, padding: "0 16px",
            background: myAnswered ? "var(--pill-bg)" : "var(--acc)",
            border: myAnswered ? "1px solid var(--pill-border)" : 0,
            color: myAnswered ? "var(--text-secondary)" : "#fff",
            fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: myAnswered ? "default" : "pointer",
          }}
        >{myAnswered ? "Answered" : "Got it!"}</button>
      )}
      {totals.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12.5, color: "var(--text-tertiary)" }}>
          {totals.map(t => (
            <span key={t.userId}>{t.name}: <b style={{ color: "var(--text-secondary)" }}>{t.score}</b></span>
          ))}
        </div>
      )}
    </div>
  );
}
