import { FONT } from "../lib/theme.js";
import { HandCircle } from "./Hand.jsx";

export function EmptyState({ icon, title, body, cta, secondary }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "72px 24px", gap: 14, textAlign: "center",
      animation: "fadeIn 0.3s ease",
    }}>
      <div style={{ marginBottom: 6, color: "var(--accent)", display: "flex" }}>
        <HandCircle i={2} pad="20px">{icon}</HandCircle>
      </div>
      <div style={{ fontFamily: "var(--font-hand)", fontWeight: 600, fontSize: "var(--fs-h1)", color: "var(--text-primary)", lineHeight: 1.15 }}>
        {title}
      </div>
      <div style={{ fontSize: "var(--fs-md)", color: "var(--t2)", fontFamily: FONT, lineHeight: 1.55, maxWidth: 360 }}>
        {body}
      </div>
      {cta && (
        <button
          onClick={cta.onClick}
          className="btn-press"
          style={{
            marginTop: 8,
            background: "var(--acc)",
            border: "none", borderRadius: 10, padding: "0 20px", height: 40,
            color: "var(--on-acc)", fontWeight: 600, fontSize: 13.5, cursor: "pointer",
            fontFamily: FONT,
            boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
            letterSpacing: "-0.01em",
          }}
        >{cta.label}</button>
      )}
      {secondary && (
        <button onClick={secondary.onClick} className="btn-press" style={{
          background: "transparent", border: "1px solid var(--border-strong)", borderRadius: 10,
          padding: "0 20px", height: 44, color: "var(--text-primary)", fontWeight: 600, fontSize: 14,
          cursor: "pointer", fontFamily: FONT,
        }}>{secondary.label}</button>
      )}
    </div>
  );
}
