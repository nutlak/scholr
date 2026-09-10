import { useEffect } from "react";
import { ChevronRight, X } from "lucide-react";
import { FONT } from "../lib/theme.js";

/* One menu, two jobs: the Forge tool picker and the notebook's overflow
   actions. A centred dialog on desktop; `.mobile-sheet` turns it into a
   bottom sheet on phones, the same way every other modal here opts in.

   Rows are deliberately large and spelled out — icon, name, and a line
   saying what it does — instead of a row of bare icons nobody can decode. */
export function SheetMenu({ title, subtitle, items, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="mobile-sheet-overlay"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1400,
        background: "rgba(4,3,10,0.68)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        className="mobile-sheet"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          background: "var(--card-bg)", border: "1px solid var(--border-default)",
          width: "100%", maxWidth: 460, padding: 20, fontFamily: FONT,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: 13.5, color: "var(--text-tertiary)", marginTop: 3 }}>{subtitle}</div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="btn-press"
            style={{
              width: 40, height: 40, flexShrink: 0, cursor: "pointer",
              background: "transparent", border: "1px solid var(--border-default)",
              color: "var(--text-secondary)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          ><X size={18} strokeWidth={2} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map(({ id, label, description, Icon, tint, danger, onSelect }) => (
            <button
              key={id}
              onClick={() => { onClose(); onSelect(); }}
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
      </div>
    </div>
  );
}
