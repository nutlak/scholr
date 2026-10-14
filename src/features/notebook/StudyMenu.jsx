import { FONT } from "../../lib/theme.js";
import { HandCircle } from "../../ui/Hand.jsx";

// ── StudyMenu ─────────────────────────────────────────────────────────────────
// The notebook's study tools as a destination rather than a row of equal
// boxes: NotebookLM's Studio shape (a few big tiles, everything grouped), with
// Quizlet's split between reviewing and testing yourself. Two short groups of
// large colour-coded tiles with one-line labels. Colour is fine here: this is
// a place you go to, not chrome you read around.
//
// Shared by the phone's "Study" tab and the desktop Forge sheet.
export function StudyMenu({ tools, onOpen }) {
  const group = (g) => tools.filter(t => t.group === g);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: FONT }}>
      {[["learn", "Learn it"], ["test", "Test yourself"]].map(([g, title]) => (
        <section key={g}>
          <h3 style={{ margin: "0 2px 10px", fontSize: 20, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-hand)" }}>{title}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {group(g).map(({ id, label, Icon, tint }, i) => (
              <button key={id} onClick={() => onOpen(id)} className="btn-press study-tile" style={{ "--tile": tint }}>
                <span style={{ color: tint, display: "flex", alignSelf: "flex-start", margin: "4px 0 0 4px" }}>
                  <HandCircle i={i} pad="9px"><Icon size={22} strokeWidth={1.8} /></HandCircle>
                </span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
