import { useEffect, useState } from "react";
import { ChevronRight, Orbit } from "lucide-react";
import { api } from "../../api.js";
import { FONT } from "../../lib/theme.js";
import { HandCircle } from "../../ui/Hand.jsx";

// ── StudyMenu ─────────────────────────────────────────────────────────────────
// The notebook's study tools as a destination rather than a row of equal
// boxes: NotebookLM's Studio shape (a few big tiles, everything grouped), with
// Quizlet's split between reviewing and testing yourself. One hero — the
// brain, because it's the map of what you know — then two short groups of
// large colour-coded tiles with one-line labels. Colour is fine here: this is
// a place you go to, not chrome you read around.
//
// Shared by the phone's "Study" tab and the desktop Forge sheet.
export function StudyMenu({ nb, tools, currentUserId, onOpen }) {
  const [brain, setBrain] = useState(null); // { solid, total } | null

  useEffect(() => {
    let live = true;
    api.getBrain(nb.id).then(({ map, scores }) => {
      if (!live || !map) return;
      const mine = scores?.[currentUserId] ?? {};
      const solid = map.concepts.filter(c => (mine[c.name.toLowerCase()] ?? 0) >= 80).length;
      setBrain({ solid, total: map.concepts.length });
    }).catch(() => {});
    return () => { live = false; };
  }, [nb.id, currentUserId]);

  const group = (g) => tools.filter(t => t.group === g);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: FONT }}>
      <button onClick={() => onOpen("brain")} className="btn-press study-hero">
        <span style={{ color: "var(--acc)", flexShrink: 0, display: "flex" }}><HandCircle i={1} pad="13px"><Orbit size={26} strokeWidth={1.7} /></HandCircle></span>
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <span style={{ display: "block", fontSize: 17, fontWeight: 650, color: "var(--text-primary)" }}>Unit brain</span>
          <span style={{ display: "block", fontSize: 14, color: "var(--text-secondary)", marginTop: 3, lineHeight: 1.4 }}>
            {brain ? `${brain.solid} of ${brain.total} ideas solid` : "Map every key idea in this unit"}
          </span>
          {brain && (
            <span className="study-hero-bar" aria-hidden="true">
              <span style={{ width: `${(brain.solid / brain.total) * 100}%` }} />
            </span>
          )}
        </span>
        <ChevronRight size={20} strokeWidth={1.8} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
      </button>

      {[["learn", "Learn it"], ["test", "Test yourself"]].map(([g, title]) => (
        <section key={g}>
          <h3 style={{ margin: "0 2px 10px", fontSize: 20, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-hand)" }}>{title}</h3>
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
