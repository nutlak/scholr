import { dueDateTone, formatDueDate } from "../../lib/format.js";
import { FONT, classTint, tintFor } from "../../lib/theme.js";
import { AvatarStack } from "../../ui/Avatar.jsx";
import { Trash2 } from "lucide-react";
import { useState } from "react";

export function NotebookCard({ nb, onClick, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const t = nb.color ? classTint(nb.color) : tintFor(nb.id ?? nb.title);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="lift-card"
      style={{
        position: "relative",
        background: hovered ? "var(--bg-surface-2)" : "var(--bg-surface-1)",
        border: `1px solid ${hovered ? "var(--accent)" : "var(--border-default)"}`,
        borderRadius: 8,
        padding: "16px 16px 14px",
        cursor: "pointer",
        overflow: "hidden",
        transition: "background 0.18s ease, border-color 0.18s ease",
      }}
    >

      {onDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Delete notebook"
          aria-label={`Delete ${nb.title}`}
          style={{
            position: "absolute", top: 12, right: 12, zIndex: 10,
            background: "none", border: "none", cursor: "pointer",
            padding: "4px 6px", color: "var(--t4)",
            opacity: hovered ? 1 : 0,
            transition: "color 0.18s, opacity 0.18s", lineHeight: 1,
          }}
          onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = "var(--danger)"; }}
          onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.color = "var(--t4)"; }}
        >
          <Trash2 size={15} strokeWidth={1.75} />
        </button>
      )}


      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{
            fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em",
            color: t.hue, textTransform: "uppercase",
            fontFamily: FONT,
          }}>
            {nb.notes} {nb.notes === 1 ? "note" : "notes"}
          </div>
        </div>
        {/* The due date replaces the updated date rather than floating over it
            (absolutely positioned, the pill was drawn on top of "Oct 9"). */}
        {nb.due_date ? (
          <div style={{
            fontSize: 10.5, fontWeight: 600, whiteSpace: "nowrap", marginRight: 22,
            color: dueDateTone(nb.due_date).color,
            background: `${dueDateTone(nb.due_date).color}1A`,
            border: `1px solid ${dueDateTone(nb.due_date).color}55`,
            padding: "2px 8px", borderRadius: 999, fontFamily: FONT,
          }}>Due {formatDueDate(nb.due_date)}</div>
        ) : (
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT, paddingRight: 22 }}>{nb.updated}</div>
        )}
      </div>
      <div style={{
        position: "relative",
        fontSize: 16, fontWeight: 600, color: "var(--text-primary)",
        fontFamily: FONT, marginBottom: 4, lineHeight: 1.3, letterSpacing: "-0.018em",
      }}>
        {nb.title}
      </div>
      {nb.topic && (
        <div style={{
          position: "relative",
          fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT,
          marginBottom: 14, lineHeight: 1.45,
        }}>
          {nb.topic}
        </div>
      )}
      {!nb.topic && <div style={{ height: 14 }} />}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AvatarStack names={nb.contributors} />
          <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: FONT }}>
            {nb.contributors.length} {nb.contributors.length === 1 ? "member" : "members"}
          </span>
        </div>
        <div style={{
          fontSize: 12, color: t.hue, fontFamily: FONT, fontWeight: 600,
          opacity: hovered ? 1 : 0,
          transform: hovered ? "translateX(0)" : "translateX(-4px)",
          transition: "opacity 0.2s, transform 0.2s",
        }}>Open →</div>
      </div>
    </div>
  );
}
