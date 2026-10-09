import { useEscape } from "./useEscape.js";
import { FONT } from "../lib/theme.js";

// A bottom sheet on phones (draggable via sheetDrag.js, which finds
// .mobile-sheet), a centred card on wider screens. Closes on Esc and on a
// backdrop tap.
export function Sheet({ title, onClose, children, maxWidth = 440 }) {
  useEscape(onClose);
  return (
    <div className="mobile-sheet-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: "fixed", inset: 0, zIndex: 1300, padding: 16,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--overlay, rgba(10,10,12,0.55))",
    }}>
      <div className="mobile-sheet" role="dialog" aria-label={title} style={{
        width: "100%", maxWidth, padding: "24px 22px", fontFamily: FONT,
        background: "var(--bg-surface-1)", border: "1px solid var(--border-default)", borderRadius: 18,
        color: "var(--text-primary)", animation: "fadeIn 0.2s ease",
      }}>
        <div style={{ fontSize: 19, fontWeight: 650, marginBottom: 14, fontFamily: "var(--font-hand, inherit)" }}>{title}</div>
        {children}
      </div>
    </div>
  );
}
