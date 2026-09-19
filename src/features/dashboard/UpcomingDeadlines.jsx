import { dueDateTone, formatDueDate } from "../../lib/format.js";
import { FONT, classTint } from "../../lib/theme.js";
import { CalendarCheck } from "lucide-react";
import { useState } from "react";

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
      <div style={{
        fontSize: 11, fontWeight: 600, color: tone.color, fontFamily: FONT,
        background: `${tone.color}1A`, border: `1px solid ${tone.color}55`,
        padding: "1px 7px", borderRadius: 999, flexShrink: 0,
      }}>
        Due {formatDueDate(nb.due_date)}
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

  // Nothing due: collapse to a single muted line. A section header above an
  // empty body cost ~70px of the most valuable space on the dashboard.
  if (upcoming.length === 0) {
    return (
      // Still one line tall, but framed: as a bare sentence between two
      // labelled sections it read like a stray string, not a status.
      <div style={{
        display: "flex", alignItems: "center", gap: 9,
        marginBottom: 22, padding: "10px 12px",
        fontSize: 12.5, color: "var(--text-tertiary)", fontFamily: FONT,
        background: "var(--bg-surface-1)", border: "1px solid var(--border-subtle)",
      }}>
        <CalendarCheck size={14} strokeWidth={1.8} style={{ flexShrink: 0, color: "var(--success)" }} />
        No deadlines in the next 7 days.
      </div>
    );
  }

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
