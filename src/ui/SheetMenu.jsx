import { ChevronRight } from "lucide-react";
import { FONT } from "../lib/theme.js";

/* The rows inside a menu panel. Rendered inside ToolModal so a menu docks to
   the right rail exactly like the study tools do — one panel, one place to
   look, never a dialog in the middle of the screen.

   Rows are deliberately large and spelled out — icon, name, and a line saying
   what it does — instead of a row of bare icons nobody can decode. */
export function SheetMenu({ items }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map(({ id, label, description, Icon, tint, danger, onSelect }) => (
        <button
          key={id}
          onClick={onSelect}
          className="btn-press sheet-row"
          style={{
            display: "flex", alignItems: "center", gap: 14, width: "100%",
            minHeight: 60, padding: "10px 14px", cursor: "pointer", textAlign: "left",
            background: "var(--bg-surface-2)",
            border: `1px solid ${danger ? "rgba(248,113,113,0.28)" : "var(--border-subtle)"}`,
            color: danger ? "var(--danger)" : "var(--text-primary)",
            fontFamily: FONT,
          }}
        >
          <span style={{
            width: 38, height: 38, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: danger ? "var(--danger)" : (tint ?? "var(--acc)"),
            background: "var(--bg-surface-3)",
            border: "1px solid var(--border-subtle)",
          }}><Icon size={19} strokeWidth={1.85} /></span>

          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.01em" }}>
              {label}
            </span>
            {description && (
              <span style={{
                display: "block", fontSize: 12.5, fontWeight: 400, marginTop: 2,
                color: "var(--text-tertiary)", lineHeight: 1.35,
              }}>{description}</span>
            )}
          </span>

          <ChevronRight size={17} strokeWidth={2} style={{ color: "var(--t4)", flexShrink: 0 }} />
        </button>
      ))}
    </div>
  );
}
