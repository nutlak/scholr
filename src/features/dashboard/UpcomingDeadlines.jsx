import { dueDateTone, formatDueDate } from "../../lib/format.js";
import { FONT, classTint } from "../../lib/theme.js";
import { useState } from "react";
import { HandCircle } from "../../ui/Hand.jsx";

export function DeadlineRow({ nb, cls, onOpen }) {
  const [hov, setHov] = useState(false);
  const t = classTint(cls?.color ?? nb.color);
  const tone = dueDateTone(nb.due_date);
  return (
    <div
      onClick={() => onOpen(nb, cls?.color)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "11px 6px",
        background: hov ? "var(--bg-surface-1)" : "transparent",
        borderBottom: "1px solid var(--border-subtle)",
        borderRadius: hov ? 6 : 0,
        cursor: "pointer", transition: "background 0.15s",
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: t.hue }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", fontFamily: FONT,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          letterSpacing: "-0.01em",
        }}>
          {nb.title}
          {cls?.title ? <span style={{ fontWeight: 400, color: "var(--text-tertiary)" }}> · {cls.title}</span> : null}
        </div>
      </div>
      <div className="hand" style={{ color: tone.color, flexShrink: 0, whiteSpace: "nowrap" }}>
        <HandCircle pad="1px 9px">{`due ${formatDueDate(nb.due_date)}`}</HandCircle>
      </div>
    </div>
  );
}

export function UpcomingDeadlines({ notebooks, classes, onOpen }) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const in7 = new Date(now); in7.setDate(in7.getDate() + 7);
  const upcoming = notebooks
    .filter(n => {
      if (!n.due_date) return false;
      const d = new Date(n.due_date);
      return d >= now && d <= in7;
    })
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  // Nothing due: show nothing. A framed "No deadlines" line was a status that
  // told the student nothing, between two sections that do.
  if (upcoming.length === 0) return null;

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)",
        fontFamily: FONT, letterSpacing: "0.08em", textTransform: "uppercase",
        marginBottom: 10, display: "flex", alignItems: "center", gap: 8,
      }}>
        Upcoming Deadlines
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: "var(--accent)",
          background: "var(--acc-bg)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
          padding: "1px 7px", borderRadius: 999,
        }}>{upcoming.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
          {upcoming.map(nb => {
            const cls = classes.find(c => c.id === nb.class_id);
            return (
              <DeadlineRow key={nb.id} nb={nb} cls={cls} onOpen={onOpen} />
            );
          })}
      </div>
    </div>
  );
}
