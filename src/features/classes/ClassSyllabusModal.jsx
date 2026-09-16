import { Calendar, X } from "lucide-react";
import { FONT, FONT_HEADING, classTint } from "../../lib/theme.js";
import { dueDateTone } from "../../lib/format.js";
import { StatusPill } from "../../ui/StatusPill.jsx";
import { useEscape } from "../../ui/useEscape.js";

// "Click a class, see the whole syllabus" — every unit in one place, sorted
// by due date, with the assessment type and status editable inline. Both
// PATCH endpoints (due-date, assessment-type) already existed server-side;
// this is the first client UI to actually use either one.
export function ClassSyllabusModal({ cls, units, onClose, onOpenUnit, onDueDateChange, onAssessmentTypeChange, onStatusChange }) {
  useEscape(onClose);
  const tint = classTint(cls.color);

  const sorted = [...(units || [])].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date) - new Date(b.due_date);
  });

  return (
    <div className="mobile-sheet-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
      backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div className="mobile-sheet" style={{
        background: "linear-gradient(180deg, var(--bg-surface-1) 0%, var(--bg-surface-2) 100%)",
        border: "1px solid var(--border-default)",
        borderRadius: 18, width: "100%", maxWidth: 640,
        padding: "24px 26px", maxHeight: "85vh", overflowY: "auto",
        boxShadow: "var(--sh-modal)", fontFamily: FONT,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: tint.hue, flexShrink: 0 }} />
            <div style={{ fontSize: 19, fontWeight: 600, color: "var(--t1)", fontFamily: FONT_HEADING, letterSpacing: "-0.01em" }}>
              {cls.title} — Syllabus
            </div>
          </div>
          <button onClick={onClose} className="btn-press" style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {sorted.length === 0 ? (
          <div style={{ fontSize: 13.5, color: "var(--text-secondary)", padding: "20px 0", textAlign: "center" }}>
            No units yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sorted.map(unit => {
              const tone = dueDateTone(unit.due_date);
              return (
                <div key={unit.id} style={{
                  display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                  padding: "10px 12px", borderRadius: 10, background: "var(--s1)",
                  border: "1px solid var(--border-subtle)",
                }}>
                  <button
                    onClick={() => onOpenUnit(unit)}
                    className="btn-press"
                    style={{
                      background: "transparent", border: "none", cursor: "pointer",
                      fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT,
                      textAlign: "left", flex: "1 1 160px", minWidth: 0,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >{unit.title}</button>

                  <input
                    placeholder="Assessment type"
                    value={unit.assessment_type || ""}
                    onChange={e => onAssessmentTypeChange(unit, e.target.value || null)}
                    style={{
                      width: 130, height: 30, borderRadius: 8, padding: "0 8px",
                      background: "var(--bg-surface-2)", border: "1px solid var(--border-default)",
                      color: "var(--text-secondary)", fontSize: 12, fontFamily: FONT, outline: "none",
                    }}
                  />

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Calendar size={13} strokeWidth={1.8} color={tone?.color ?? "var(--text-tertiary)"} />
                    <input
                      type="date"
                      value={unit.due_date ? unit.due_date.slice(0, 10) : ""}
                      onChange={e => onDueDateChange(unit, e.target.value || null)}
                      style={{
                        height: 30, borderRadius: 8, padding: "0 6px", width: 128,
                        background: "var(--bg-surface-2)", border: "1px solid var(--border-default)",
                        color: tone?.color ?? "var(--text-secondary)", fontSize: 12, fontFamily: FONT, outline: "none",
                      }}
                    />
                  </div>

                  <StatusPill status={unit.status ?? "in_progress"} onChange={s => onStatusChange(unit, s)} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
