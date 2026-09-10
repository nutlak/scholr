import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from "lucide-react";

// ── ToolModal — Scholr 2.0 universal study-tool shell ─────────────────────────
// EVERY study tool (Notes, Forge, Podcast, Feynman, future flashcards) renders
// inside this one spacious, dismissible shell so they all feel identical.
// Desktop: a centered modal with an Expand toggle. Mobile / split-screen: a
// full-screen sheet with safe-area padding (pure CSS, correct at any width).
// Dismiss with ✕, click-outside, or Esc; background scroll locks while open.
// Remembered per session (no localStorage): which mode the user last left a tool in.
let _toolModeMemory = "dock"; // "dock" | "modal"

export function ToolModal({ open, onClose, title, subtitle, Icon, children }) {
  const [mode, setMode] = useState(_toolModeMemory); // "dock" (right rail) | "modal" (centered)
  const [wide, setWide] = useState(false);
  const [entered, setEntered] = useState(false);

  // Entrance: settle on the next frame so the open — and every dock<->modal
  // toggle — runs through the same CSS transitions (slide + fade, no snap).
  // ToolModal only mounts while open, so this runs once per open.
  useEffect(() => {
    const r = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(r);
  }, []);

  // Esc closes (both modes). Scroll-lock + chat-yield only when desktop-docked is
  // OFF (i.e. modal mode, or any mobile width — where dock is ignored entirely).
  useEffect(() => {
    if (!open) return undefined;
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => {
      const docked = mode === "dock" && !mq.matches;
      document.body.classList.toggle("tool-docked", docked);
      document.body.style.overflow = docked ? "" : "hidden";
    };
    apply();
    mq.addEventListener("change", apply);
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("tool-docked");
      document.body.style.overflow = "";
    };
  }, [open, mode, onClose]);

  function toggleMode() {
    setMode((m) => {
      const next = m === "dock" ? "modal" : "dock";
      _toolModeMemory = next;
      if (next === "dock") setWide(false);
      return next;
    });
  }

  if (!open) return null;
  const isModal = mode === "modal";
  return (
    <div className={`tool-modal-root tool-mode-${mode}${entered ? " is-entered" : ""}`}>
      <div
        className="tool-modal-backdrop"
        onMouseDown={isModal ? onClose : undefined}
      />
      <div
        className={`tool-modal-card${wide ? " is-wide" : ""}`}
        role="dialog"
        aria-modal={isModal}
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="tool-modal-header">
          <div className="tool-modal-titlewrap">
            {Icon && <span className="tool-modal-icon"><Icon size={16} strokeWidth={2} /></span>}
            <div style={{ minWidth: 0 }}>
              <div className="tool-modal-title">{title}</div>
              {subtitle && <div className="tool-modal-subtitle">{subtitle}</div>}
            </div>
          </div>
          <div className="tool-modal-controls">
            <button
              type="button"
              className="tool-modal-iconbtn tool-modal-toggle has-tip"
              onClick={toggleMode}
              aria-label={isModal ? "Dock to right" : "Open in center"}
              data-tooltip={isModal ? "Dock right" : "Center"}
            >{isModal ? <ChevronRight size={16} strokeWidth={1.9} /> : <ChevronLeft size={16} strokeWidth={1.9} />}</button>
            {isModal && (
              <button
                type="button"
                className="tool-modal-iconbtn tool-modal-expand has-tip"
                onClick={() => setWide((w) => !w)}
                aria-label={wide ? "Collapse panel" : "Expand panel"}
                data-tooltip={wide ? "Collapse" : "Expand"}
              >{wide ? <Minimize2 size={16} strokeWidth={1.9} /> : <Maximize2 size={16} strokeWidth={1.9} />}</button>
            )}
            <button
              type="button"
              className="tool-modal-iconbtn has-tip"
              onClick={onClose}
              aria-label="Close"
              data-tooltip="Close (Esc)"
            ><X size={17} strokeWidth={1.9} /></button>
          </div>
        </header>
        <div className="tool-modal-body">{children}</div>
      </div>
    </div>
  );
}
