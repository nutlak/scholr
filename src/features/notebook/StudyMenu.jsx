import { useEffect, useState } from "react";
import { ChevronRight, Orbit } from "lucide-react";
import { api } from "../../api.js";
import { FONT } from "../../lib/theme.js";

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
        <span className="study-hero-orb"><Orbit size={26} strokeWidth={1.7} /></span>
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
          <h3 style={{ margin: "0 2px 10px", fontSize: 15, fontWeight: 650, color: "var(--text-primary)", fontFamily: FONT }}>{title}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {group(g).map(({ id, label, Icon, tint }) => (
              <button key={id} onClick={() => onOpen(id)} className="btn-press study-tile" style={{ "--tile": tint }}>
                <Icon size={24} strokeWidth={1.8} style={{ color: tint }} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
