// Split out of LegalPages.jsx so App.jsx can import the footer without dragging
// the verbatim legal text (DOCS) into the main bundle — LegalPages.jsx is lazy,
// and a static import of any of its exports defeats that.

const FONT = `"Hanken Grotesk", "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
export const SUPPORT_EMAIL = "support@scholr.dev";

export function LegalFooter({ compact = false }) {
  const links = [
    ["Privacy", "/privacy"],
    ["Terms", "/terms"],
    ["Copyright", "/copyright"],
  ];
  if (compact) {
    return (
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px",
        padding: "10px 12px", fontFamily: FONT, fontSize: 11,
        color: "var(--text-tertiary)",
      }}>
        {links.map(([label, href]) => (
          <a key={href} href={href} style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>{label}</a>
        ))}
        <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>Contact</a>
      </div>
    );
  }
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "center",
      justifyContent: "center", gap: "8px 18px",
      marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--border-subtle)",
      fontFamily: FONT, fontSize: 13, color: "var(--text-tertiary)",
    }}>
      {links.map(([label, href]) => (
        <a key={href} href={href} style={{ color: "var(--text-secondary)", textDecoration: "none" }}>{label}</a>
      ))}
      <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "var(--text-secondary)", textDecoration: "none" }}>
        Contact: {SUPPORT_EMAIL}
      </a>
    </div>
  );
}
