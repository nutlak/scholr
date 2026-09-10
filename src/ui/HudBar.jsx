import { useEffect, useState } from "react";

/* Fleet-console status strip: identity on the left, live telemetry on the
   right, sweep animation riding across it. Same instrument the trader and
   the Jarvis deck wear — this one reports study state instead of positions. */
export function HudBar({ streak = 0, due = 0, classes = 0, tier = "free" }) {
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = clock.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });

  return (
    <div className="hud-bar" role="status" aria-label="Study status">
      <span className="hud-title">
        Scholr<span className="slash hud-opt">/</span><span className="hud-opt">Study Deck</span>
      </span>

      <span className="hud-sep">::</span>

      <span>
        <i className="hud-dot online" aria-hidden="true" />
        <span className="hud-opt">Online</span>
      </span>

      <span className="hud-sep">::</span>
      <span>Streak <b className="hud-num">{streak}</b> {streak === 1 ? "day" : "days"}</span>

      <span className="hud-sep">::</span>
      <span>
        <b className={due > 0 ? "hud-num warn" : "hud-num"}>{due > 99 ? "99+" : due}</b> cards to review
      </span>

      <span className="hud-sep hud-opt">::</span>
      <span className="hud-opt"><b className="hud-num">{classes}</b> classes</span>

      <span className="hud-spacer" />

      <span className="hud-opt">Plan <b className="hud-num">{tier}</b></span>
      <span className="hud-sep hud-opt">::</span>
      <span className="hud-num">{time}</span>
    </div>
  );
}
