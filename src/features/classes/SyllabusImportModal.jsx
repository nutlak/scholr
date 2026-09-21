import { useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { FONT, FONT_HEADING } from "../../lib/theme.js";
import { useEscape } from "../../ui/useEscape.js";
import { api } from "../../api.js";

// Upload a syllabus -> Claude extracts a class name + unit list -> review and
// edit before anything is created. Feeds the exact same createClass +
// apply-template pair NewClassModal uses, so it's just a different way to
// arrive at the same class-with-notebooks shape, not a parallel code path.
//
// With `targetClass` it adds the units to a class that already exists —
// same parse, same review, minus the createClass step and the name field.
const inp = {
  width: "100%", background: "var(--s1)", border: "1px solid var(--border)",
  borderRadius: 10, padding: "0 14px", height: 42, color: "var(--t1)", fontSize: 14,
  fontFamily: FONT, outline: "none", letterSpacing: "-0.01em",
};
const lbl = {
  fontSize: 11, color: "var(--t2)", fontFamily: FONT,
  letterSpacing: "0.5px", textTransform: "uppercase",
  display: "block", marginBottom: 9, fontWeight: 600,
};

export function SyllabusImportModal({ onClose, onCreated, targetClass = null }) {
  useEscape(onClose);
  const [stage, setStage] = useState("upload"); // upload | parsing | review | creating
  const [error, setError] = useState("");
  const [className, setClassName] = useState(targetClass?.title ?? "");
  const [notebooks, setNotebooks] = useState([]); // [{ name, dueDate }]
  const fileRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStage("parsing");
    setError("");
    try {
      const result = await api.parseSyllabus(file);
      if (!targetClass) setClassName(result.className);
      setNotebooks(result.notebooks);
      setStage(result.notebooks.length ? "review" : "upload");
      if (!result.notebooks.length) setError("Couldn't find any units in that file — try a clearer syllabus, or add the class manually.");
    } catch (err) {
      setError(err.message || "Couldn't read that syllabus.");
      setStage("upload");
    }
  }

  function updateNotebook(i, patch) {
    setNotebooks(ns => ns.map((n, idx) => idx === i ? { ...n, ...patch } : n));
  }
  function removeNotebook(i) {
    setNotebooks(ns => ns.filter((_, idx) => idx !== i));
  }

  async function handleCreate() {
    if ((!targetClass && !className.trim()) || notebooks.length === 0) return;
    setStage("creating");
    setError("");
    try {
      await onCreated(className.trim(), notebooks);
      onClose();
    } catch (err) {
      setError(err.message || (targetClass ? "Couldn't add those units." : "Couldn't create the class."));
      setStage("review");
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
        border: "1px solid var(--border-default)",
        borderRadius: 18, width: "100%", maxWidth: 460,
        padding: "28px 26px", maxHeight: "85vh", overflowY: "auto",
        boxShadow: "var(--sh-modal)", animation: "fadeIn 0.2s ease",
      }}>
        <div style={{ fontSize: 19, fontWeight: 600, color: "var(--t1)", fontFamily: FONT_HEADING, marginBottom: 5, letterSpacing: "-0.01em" }}>
          {targetClass ? `Import a syllabus into ${targetClass.title}` : "Import a syllabus"}
        </div>
        <div style={{ fontSize: 13, color: "var(--t2)", fontFamily: FONT, lineHeight: 1.6, marginBottom: 18 }}>
          {targetClass
            ? "Upload this class's syllabus and Derek pulls out its units — review before anything's added."
            : "Upload a syllabus PDF and Derek sets up the class and units for you — review before anything's created."}
        </div>

        {(stage === "upload" || stage === "parsing") && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={stage === "parsing"}
            className="btn-press"
            style={{
              width: "100%", minHeight: 110, borderRadius: 12,
              border: "1.5px dashed var(--border-default)", background: "var(--s1)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
              cursor: stage === "parsing" ? "default" : "pointer", fontFamily: FONT,
            }}
          >
            {stage === "parsing" ? (
              <span className="shimmer" style={{ fontSize: 13 }}>Reading your syllabus…</span>
            ) : (
              <>
                <Upload size={22} strokeWidth={1.8} color="var(--text-tertiary)" />
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Click to upload a PDF or text file</span>
              </>
            )}
          </button>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={handleFile} style={{ display: "none" }} />

        {stage === "review" && (
          <>
            {!targetClass && (
              <>
                <label style={lbl}>Class name</label>
                <input style={{ ...inp, marginBottom: 16 }} value={className} onChange={e => setClassName(e.target.value)} />
              </>
            )}

            <label style={lbl}>Units ({notebooks.length})</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
              {notebooks.map((n, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", background: "var(--s1)", borderRadius: 10 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <FileText size={14} strokeWidth={1.8} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                    <input
                      style={{ ...inp, height: 34, flex: 1, background: "transparent", border: "none", padding: "0 4px" }}
                      value={n.name}
                      onChange={e => updateNotebook(i, { name: e.target.value })}
                    />
                    <button type="button" onClick={() => removeNotebook(i)} className="btn-press" style={{
                      background: "transparent", border: "none", color: "var(--text-tertiary)",
                      cursor: "pointer", padding: 4, flexShrink: 0,
                    }}><Trash2 size={14} strokeWidth={1.8} /></button>
                  </div>
                  <div style={{ display: "flex", gap: 8, paddingLeft: 22 }}>
                    <input
                      type="date"
                      style={{ ...inp, height: 32, flex: 1, padding: "0 8px" }}
                      value={n.dueDate || ""}
                      onChange={e => updateNotebook(i, { dueDate: e.target.value || null })}
                    />
                    <input
                      style={{ ...inp, height: 32, flex: 1, padding: "0 8px" }}
                      placeholder="Assessment type (optional)"
                      value={n.assessmentType || ""}
                      onChange={e => updateNotebook(i, { assessmentType: e.target.value || null })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {error && <div style={{ fontSize: 12.5, color: "var(--danger)", fontFamily: FONT, marginBottom: 14 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} className="btn-press" style={{
            minHeight: 40, padding: "0 16px", background: "transparent",
            border: "1px solid var(--border-default)", color: "var(--text-secondary)",
            fontFamily: FONT, fontSize: 13.5, cursor: "pointer", borderRadius: 10,
          }}>Cancel</button>
          {stage === "review" && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={(!targetClass && !className.trim()) || notebooks.length === 0}
              className="btn-press"
              style={{
                minHeight: 40, padding: "0 18px", borderRadius: 10, border: 0,
                background: "var(--acc)", color: "#fff",
                fontFamily: FONT, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
              }}
            >{targetClass ? `Add ${notebooks.length} unit${notebooks.length === 1 ? "" : "s"}` : "Create class"}</button>
          )}
          {stage === "creating" && (
            <span className="shimmer" style={{ fontSize: 13, alignSelf: "center", fontFamily: FONT }}>{targetClass ? "Adding…" : "Creating…"}</span>
          )}
        </div>
      </div>
    </div>
  );
}
