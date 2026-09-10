import { useState } from "react";
import { Check } from "lucide-react";
import { FONT, STATUS_META } from "../lib/theme.js";

export function StatusPill({ status, onChange, size = "sm", compact = false }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[status] ?? STATUS_META.in_progress;
  const padding = size === "sm" ? "2px 8px" : "4px 10px";
  const fontSize = size === "sm" ? 10.5 : 12;
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        title={compact ? meta.label : undefined}
        style={{
          background: meta.bg,
          border: `1px solid ${meta.border}`,
          borderRadius: compact ? 8 : 999,
          padding: compact ? "0 8px" : padding,
          height: compact ? 30 : "auto",
          fontSize, fontWeight: 600,
          color: meta.color, fontFamily: FONT, cursor: "pointer",
          letterSpacing: "0.02em",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {compact
          ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
          : meta.label}
      </button>
      {open && (
        <>
          <div onClick={e => { e.stopPropagation(); setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 100 }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0,
            background: "var(--bg-surface-2)",
            border: "1px solid var(--border-default)",
            borderRadius: 10, padding: 4, zIndex: 110,
            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
            minWidth: 140,
          }}>
            {Object.entries(STATUS_META).map(([key, m]) => (
              <div
                key={key}
                onClick={() => { onChange(key); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 10px", borderRadius: 7, cursor: "pointer",
                  fontSize: 12.5, color: m.color, fontFamily: FONT, fontWeight: 500,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--s2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <span>{m.label}</span>
                {status === key && <Check size={13} strokeWidth={2} />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
