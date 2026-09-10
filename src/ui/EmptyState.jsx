import { FONT, FONT_SERIF } from "../lib/theme.js";

export function EmptyState({ icon, title, body, cta }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "72px 24px", gap: 14, textAlign: "center",
      animation: "fadeIn 0.3s ease",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 18,
        background: "linear-gradient(135deg, var(--acc-bg) 0%, color-mix(in srgb, var(--accent) 4%, transparent) 100%)",
        border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 6, color: "var(--accent)",
        boxShadow: "0 0 32px var(--acc-bg)",
      }}>{icon}</div>
      <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 400, fontSize: 26, color: "var(--text-primary)", letterSpacing: "0.01em", lineHeight: 1.15 }}>
        {title}
      </div>
      <div style={{ fontSize: 14, color: "var(--t2)", fontFamily: FONT, lineHeight: 1.55, maxWidth: 360 }}>
        {body}
      </div>
      {cta && (
        <button
          onClick={cta.onClick}
          className="btn-press"
          style={{
            marginTop: 8,
            background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
            border: "none", borderRadius: 10, padding: "0 20px", height: 40,
            color: "#fff", fontWeight: 600, fontSize: 13.5, cursor: "pointer",
            fontFamily: FONT,
            boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
            letterSpacing: "-0.01em",
          }}
        >{cta.label}</button>
      )}
    </div>
  );
}
