import { useEffect, useState } from "react";
import { ChevronDown, FileText, Plus, Trash2 } from "lucide-react";
import { api } from "../../api.js";
import { FONT } from "../../lib/theme.js";

// ── SourcesPanel ──────────────────────────────────────────────────────────────
// What Derek reads: every source in the unit, NotebookLM's Sources tab. Before
// this an uploaded source couldn't be seen again or removed anywhere in the
// app, and a separate "Unit notes" feature kept typed notes in a second
// table Derek never read. Writing a note is now just a kind of source.
export function SourcesPanel({ nb, currentUserId, isOwner, members = [], refreshKey, onAdd, onToast }) {
  const [sources, setSources] = useState(null);
  const [open, setOpen] = useState(null);
  const [confirming, setConfirming] = useState(null);

  useEffect(() => {
    let live = true;
    api.listNotes(nb.id).then(s => live && setSources(s)).catch(() => live && setSources([]));
    return () => { live = false; };
  }, [nb.id, refreshKey]);

  async function remove(id) {
    try {
      await api.deleteNote(nb.id, id);
      setSources(s => s.filter(x => x.id !== id));
      setConfirming(null);
    } catch (e) {
      onToast?.(e.message);
    }
  }

  const who = (uid) => uid === currentUserId ? "You"
    : members.find(m => m.user_id === uid)?.display_name ?? "Someone";

  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 12 }}>
      <button onClick={onAdd} className="btn-press" style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
        minHeight: 50, borderRadius: 12, border: "none", background: "var(--acc)", color: "var(--on-acc)",
        fontFamily: FONT, fontSize: 15, fontWeight: 650, cursor: "pointer",
      }}><Plus size={18} strokeWidth={2.2} /> Add a source</button>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
        Derek, the Forge and the brain all read these. Upload a file, or write or paste a note.
      </p>

      {sources === null ? (
        <span className="shimmer" style={{ fontSize: 13 }}>Loading…</span>
      ) : sources.length === 0 ? (
        <div style={{ fontSize: 14, color: "var(--text-secondary)", padding: "8px 2px" }}>No sources yet.</div>
      ) : sources.map(src => {
        const expanded = open === src.id;
        const canDelete = isOwner || src.uploader_id === currentUserId;
        return (
          <div key={src.id} style={{ background: "var(--bg-surface-1)", border: "1px solid var(--border-subtle)", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <button onClick={() => setOpen(expanded ? null : src.id)} aria-expanded={expanded} style={{
                flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, padding: "12px 4px 12px 14px",
                background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FONT,
              }}>
                <FileText size={18} strokeWidth={1.8} style={{ color: "var(--acc)", flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{src.title || "Untitled"}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 2 }}>
                    {who(src.uploader_id)} · {new Date(src.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {src.content ? ` · ${Math.max(1, Math.round(src.content.split(/\s+/).length / 250))} min read` : ""}
                  </span>
                </span>
                <ChevronDown size={18} strokeWidth={1.8} style={{ color: "var(--text-tertiary)", flexShrink: 0, transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </button>
              {canDelete && (
                <button onClick={() => setConfirming(src.id)} aria-label={`Remove ${src.title}`} title="Remove source" className="btn-press" style={{
                  width: 44, height: 44, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer",
                }}><Trash2 size={16} strokeWidth={1.8} /></button>
              )}
            </div>
            {confirming === src.id && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px 12px", fontSize: 13.5, color: "var(--text-secondary)" }}>
                <span style={{ flex: 1 }}>Remove for everyone in this unit?</span>
                <button onClick={() => setConfirming(null)} className="btn-press" style={smallBtn("transparent", "var(--text-secondary)")}>Keep</button>
                <button onClick={() => remove(src.id)} className="btn-press" style={smallBtn("var(--danger)", "var(--bg-base)")}>Remove</button>
              </div>
            )}
            {expanded && (
              <div style={{
                padding: "0 14px 14px", fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)",
                whiteSpace: "pre-wrap", maxHeight: 360, overflowY: "auto",
              }}>{src.content || "No text could be read from this file."}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const smallBtn = (bg, color) => ({
  minHeight: 36, padding: "0 12px", borderRadius: 9, border: bg === "transparent" ? "1px solid var(--border-default)" : "none",
  background: bg, color, fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: "pointer",
});
