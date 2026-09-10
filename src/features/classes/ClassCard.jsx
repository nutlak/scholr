import { useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, Trash2, X } from "lucide-react";
import { StatusPill } from "../../ui/StatusPill.jsx";
import { CLASS_COLORS, FONT, classTint } from "../../lib/theme.js";
import { dueDateTone, formatDueDate } from "../../lib/format.js";

function UnitRow({ unit, color, onClick, onStatusChange }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "0 14px", height: 48,
        background: hovered ? "var(--bg-surface-1)" : "transparent",
        borderBottom: "1px solid var(--border-subtle)",
        cursor: "pointer", transition: "background 0.15s",
        position: "relative",
      }}
    >
      <div style={{
        width: 4, height: 24, borderRadius: 2,
        background: hovered ? color : "var(--border-default)",
        transition: "background 0.18s",
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", fontFamily: FONT,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          letterSpacing: "-0.01em",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>{unit.title}</span>
          {unit.due_date && (
            <span style={{
              fontSize: 10.5, fontWeight: 600,
              color: dueDateTone(unit.due_date).color,
              background: `${dueDateTone(unit.due_date).color}1A`,
              border: `1px solid ${dueDateTone(unit.due_date).color}55`,
              padding: "1px 7px", borderRadius: 999,
            }}>Due {formatDueDate(unit.due_date)}</span>
          )}
        </div>
        {unit.topic && (
          <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: FONT, marginTop: 1 }}>{unit.topic}</div>
        )}
      </div>
      {onStatusChange && (
        <span onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <StatusPill status={unit.status ?? "in_progress"} onChange={s => onStatusChange(s)} />
        </span>
      )}
      <div style={{
        fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT,
        flexShrink: 0, padding: "2px 8px", background: "var(--bg-surface-2)",
        borderRadius: 6, fontWeight: 500,
      }}>
        {unit.notes} {unit.notes === 1 ? "note" : "notes"}
      </div>
      <div style={{
        fontSize: 13, color, flexShrink: 0,
        opacity: hovered ? 1 : 0, transform: hovered ? "translateX(0)" : "translateX(-4px)",
        transition: "opacity 0.18s, transform 0.18s", fontWeight: 600,
      }}>→</div>
    </div>
  );
}
export function ClassCard({ cls, expanded, units, onToggle, onOpenUnit, onNewUnit, onDeleteClass, onChangeColor, onUnitStatusChange }) {
  const [hovered, setHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, right: 0 });
  const pickerBtnRef = useRef(null);
  const t = classTint(cls.color);

  function openPicker(e) {
    e.stopPropagation();
    if (!pickerOpen && pickerBtnRef.current) {
      const r = pickerBtnRef.current.getBoundingClientRect();
      setPickerPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setPickerOpen(v => !v);
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Card header */}
      <div
        className="class-card-header"
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: 11,
          padding: "11px 14px",
          background: "var(--bg-surface-1)",
          border: `1px solid ${hovered ? "var(--border-strong)" : "var(--border-default)"}`,
          borderRadius: 8,
          cursor: "pointer",
          transition: "border-color 200ms ease, transform 200ms ease",
          transform: hovered ? "translateY(-1px)" : "translateY(0)",
        }}
      >
        {/* Color dot */}
        <div style={{
          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
          background: t.hue,
        }} />

        {/* Class name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13.5, fontWeight: 550, color: "var(--text-primary)",
            fontFamily: FONT, letterSpacing: "-0.01em",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {cls.title}
          </div>
        </div>

        {/* Unit count — from the loaded list once expanded, otherwise the count
            the classes endpoint embeds, so a collapsed card still says something. */}
        {(() => {
          const n = units === null ? cls.unit_count : units.length;
          if (n === null || n === undefined) return null;
          return (
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", fontFamily: FONT, flexShrink: 0 }}>
              {n === 0 ? "Empty" : `${n} ${n === 1 ? "unit" : "units"}`}
            </div>
          );
        })()}

        {/* Color picker swatch */}
        {onChangeColor && (
          <div style={{ flexShrink: 0 }}>
            <button
              ref={pickerBtnRef}
              onClick={openPicker}
              title="Change color"
              className="class-color-swatch"
              style={{
                width: 16, height: 16, borderRadius: 4, padding: 0,
                border: "1.5px solid var(--border-h)",
                background: `linear-gradient(135deg, ${t.hue} 0%, ${t.deep} 100%)`,
                cursor: "pointer",
                opacity: hovered || pickerOpen ? 1 : 0,
                transition: "opacity 0.18s, transform 0.15s",
              }}
              onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.transform = "scale(1.15)"; }}
              onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.transform = "scale(1)"; }}
            />
            {pickerOpen && (
              <>
                <div onClick={e => { e.stopPropagation(); setPickerOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
                <div
                  className="class-color-popover"
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: "fixed", top: pickerPos.top, right: pickerPos.right,
                    background: "var(--bg-surface-1)",
                    backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 12, padding: 12, zIndex: 60,
                    boxShadow: "var(--sh-modal)",
                    animation: "fadeIn 0.15s ease",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 10, padding: "0 2px" }}>
                    Class Color
                  </div>
                  <ColorSwatchPicker value={cls.color} onChange={hue => { onChangeColor(hue); setPickerOpen(false); }} />
                </div>
              </>
            )}
          </div>
        )}

        {/* Delete */}
        {onDeleteClass && (
          <button
            onClick={e => { e.stopPropagation(); onDeleteClass(); }}
            title="Delete class"
            className="class-delete-btn"
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "4px 6px", fontSize: 13, lineHeight: 1, color: "var(--text-tertiary)",
              opacity: hovered ? 1 : 0,
              transition: "opacity 0.18s, color 0.18s", flexShrink: 0, borderRadius: 6,
            }}
            onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = "rgba(248,113,113,0.08)"; }}
            onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.background = "transparent"; }}
          ><X size={13} strokeWidth={2} /></button>
        )}

        {/* Chevron */}
        <div className="class-chevron" style={{
          color: expanded ? t.hue : "var(--text-tertiary)",
          transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.18s",
          transform: expanded ? "rotate(90deg)" : "none", flexShrink: 0,
          display: "inline-flex",
        }}><ChevronRight size={16} strokeWidth={1.75} /></div>
      </div>

      {/* Expanded units */}
      {expanded && (
        <div style={{ animation: "fadeIn 0.2s ease", paddingLeft: 22, paddingTop: 4 }}>
          {units === null ? (
            <div style={{ padding: "12px 0", fontSize: 12.5, color: "var(--text-tertiary)", fontFamily: FONT, display: "flex", alignItems: "center", gap: 8 }}>
              <div className="forge-spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
              Loading units…
            </div>
          ) : units.length === 0 ? (
            <div style={{ padding: "16px 0", fontSize: 12.5, color: "var(--text-tertiary)", fontFamily: FONT }}>
              <div>No units yet</div>
              <div style={{ fontSize: 11.5, color: "var(--t4)", marginTop: 2 }}>Create your first unit below to start studying</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {units.map(unit => (
                <UnitRow
                  key={unit.id}
                  unit={unit}
                  color={t.hue}
                  onClick={() => onOpenUnit(unit)}
                  onStatusChange={onUnitStatusChange ? (status) => onUnitStatusChange(unit, status) : undefined}
                />
              ))}
            </div>
          )}
          <div style={{ padding: "10px 0" }}>
            <button
              onClick={onNewUnit}
              className="btn-press"
              style={{
                background: "transparent",
                border: `1px dashed ${t.hue}55`,
                borderRadius: 8, padding: "7px 14px",
                color: t.hue, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: FONT, transition: "all 0.18s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.hue; e.currentTarget.style.background = `${t.hue}10`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = `${t.hue}55`; e.currentTarget.style.background = "transparent"; }}
            >+ New Unit</button>
          </div>
        </div>
      )}
    </div>
  );
}
// Wraps ClassCard with dnd-kit sortable behavior. The drag listeners are
// bound to the handle (not the wrapper) so clicking the card body still
// opens it. While dragging: slight scale, drop shadow, lifted z-index.
export function SortableClassCard({ cls, dragDisabled, ...rest }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: cls.id, disabled: dragDisabled });

  // Compose the transform with a small scale while dragging.
  const scaled = isDragging && transform
    ? { ...transform, scaleX: 1.02, scaleY: 1.02 }
    : transform;

  const style = {
    position: "relative",
    transform: CSS.Transform.toString(scaled),
    transition,
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 10 : "auto",
    boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.35)" : "none",
    borderRadius: isDragging ? 6 : 0,
    background: isDragging ? "var(--bg-surface-1)" : "transparent",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-class-row${isDragging ? " is-dragging" : ""}`}
    >
      {!dragDisabled && (
        <button
          type="button"
          className="class-drag-handle"
          aria-label="Drag to reorder class"
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      )}
      <ClassCard cls={cls} {...rest} />
    </div>
  );
}
export function ColorSwatchPicker({ value, onChange }) {
  return (
    <div className="color-swatch-grid" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {CLASS_COLORS.map(c => {
        const selected = c.hue.toLowerCase() === (value ?? "").toLowerCase();
        return (
          <button
            key={c.id}
            type="button"
            title={c.label}
            onClick={() => onChange(c.hue)}
            className="btn-press color-swatch"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${c.hue} 0%, ${c.deep} 100%)`,
              border: selected
                ? `2px solid #F5F5FA`
                : "2px solid transparent",
              cursor: "pointer", padding: 0,
              boxShadow: selected
                ? `0 0 0 3px ${c.hue}44, 0 6px 16px ${c.hue}55`
                : `0 2px 6px ${c.hue}30`,
              transition: "all 0.18s",
              outline: "none",
            }}
          />
        );
      })}
    </div>
  );
}
export function ConfirmDeleteClassModal({ cls, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setLoading(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="mobile-sheet-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
      backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div className="mobile-sheet" style={{
        background: "linear-gradient(180deg, var(--bg-surface-1) 0%, var(--bg-surface-2) 100%)",
        border: "1px solid rgba(248,113,113,0.18)",
        borderRadius: 18, width: "100%", maxWidth: 400,
        padding: "24px",
        boxShadow: "var(--sh-modal)",
        animation: "fadeIn 0.2s ease",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.28)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 14, color: "var(--danger)",
        }}><Trash2 size={20} strokeWidth={1.75} /></div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)", fontFamily: FONT, marginBottom: 6, letterSpacing: "-0.015em" }}>
          Delete "{cls.title}"?
        </div>
        <div style={{ fontSize: 13, color: "var(--t2)", fontFamily: FONT, lineHeight: 1.55, marginBottom: 20 }}>
          All units and notes inside will be permanently deleted.
        </div>
        {error && (
          <div style={{
            background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)",
            borderRadius: 10, padding: "10px 12px", fontSize: 12.5,
            color: "#F87171", fontFamily: FONT, marginBottom: 16,
          }}>{error}</div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button" onClick={onClose}
            className="btn-press"
            style={{
              background: "transparent", border: "1px solid var(--border-h)",
              borderRadius: 10, padding: "0 16px", height: 36,
              color: "var(--t2)", fontSize: 13, fontWeight: 500,
              cursor: "pointer", fontFamily: FONT, letterSpacing: "-0.01em",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t1)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t2)"; }}
          >Cancel</button>
          <button
            type="button" onClick={handleConfirm} disabled={loading}
            className="btn-press"
            style={{
              background: "linear-gradient(135deg, #F87171 0%, #EF4444 100%)",
              border: "none", borderRadius: 10, padding: "0 18px", height: 36,
              color: "#fff", fontWeight: 600, fontSize: 13,
              cursor: loading ? "not-allowed" : "pointer", fontFamily: FONT,
              opacity: loading ? 0.65 : 1, boxShadow: "0 4px 14px rgba(248,113,113,0.35)",
              letterSpacing: "-0.01em",
            }}
          >{loading ? "Deleting…" : "Delete class"}</button>
        </div>
      </div>
    </div>
  );
}
