import { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { FONT } from "../../lib/theme.js";
import { HandCheck, HandCircle } from "../../ui/Hand.jsx";

// ── Getting started ──────────────────────────────────────────────────────────
// The four steps that make scholr click, in order, ending where the product's
// point is: a friend in your class. Each step checks itself off from real
// data rather than from clicks, and each row does the thing it names.
// Completed steps are remembered per account on this device, because some
// signals reset (messages count monthly). Hidden once all four are done or
// the student dismisses it.
const key = (uid) => `scholr:getting-started:${uid}`;
const read = (uid) => { try { return JSON.parse(localStorage.getItem(key(uid)) || "{}"); } catch { return {}; } };
const write = (uid, v) => { try { localStorage.setItem(key(uid), JSON.stringify(v)); } catch { /* private mode */ } };

export function GettingStarted({
  userId, classes, notebooks, messagesUsed, friendCount,
  onNewClass, onJoinClass, onOpenUnit, onNewUnit, onInvite,
}) {
  const [saved, setSaved] = useState(() => read(userId));
  const [open, setOpen] = useState(false);

  const classUnits = notebooks.filter(n => n.class_id);
  // notes_filled, not notes: a course template adds empty placeholder notes.
  const unitWithNotes = classUnits.find(n => n.notes_filled > 0);
  const live = {
    cls: classes.length > 0,
    notes: !!unitWithNotes,
    derek: messagesUsed > 0 && !!unitWithNotes,
    friend: friendCount > 0,
  };
  const done = Object.fromEntries(Object.keys(live).map(k => [k, live[k] || !!saved[k]]));
  // Persist newly completed steps for next time; this session already shows
  // them as done via `live`.
  const doneKey = Object.keys(done).filter(k => done[k]).join(",");
  useEffect(() => {
    if (!userId || !doneKey) return;
    const stored = read(userId);
    write(userId, { ...stored, ...Object.fromEntries(doneKey.split(",").map(k => [k, true])) });
  }, [userId, doneKey]);

  const count = Object.values(done).filter(Boolean).length;
  if (!userId || saved.dismissed || count === 4) return null;

  const firstClass = classes[0];
  const steps = [
    { id: "cls", title: "Make a class", hint: "One per course: AP Bio, Algebra II…", act: onNewClass,
      alt: { label: "or join one with a PIN", act: onJoinClass } },
    { id: "notes", title: "Add your notes", hint: "A PDF, slides, a photo, or pasted text",
      act: () => (classUnits[0] ? onOpenUnit(classUnits[0].id) : firstClass && onNewUnit(firstClass)) },
    { id: "derek", title: "Ask Derek something", hint: "He answers from your notes, not the internet",
      act: () => unitWithNotes && onOpenUnit(unitWithNotes.id) },
    { id: "friend", title: "Bring a friend", hint: "Share your class PIN in the group chat",
      act: () => firstClass && onInvite(firstClass) },
  ];
  const next = steps.find(s => !done[s.id]);

  return (
    <section className="lift-card" style={{
      background: "var(--card-bg)", borderRadius: 18, padding: "18px 18px 10px",
      marginBottom: 28, position: "relative", fontFamily: FONT,
    }}>
      <button
        onClick={() => { const v = { ...saved, dismissed: true }; write(userId, v); setSaved(v); }}
        aria-label="Hide getting started"
        style={{ position: "absolute", top: 10, right: 10, width: 36, height: 36, background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
      ><X size={16} strokeWidth={1.8} /></button>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6, paddingRight: 36 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>Get started</h2>
        <span className="hand" style={{ color: "var(--text-tertiary)" }}>{count} of 4 done</span>
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {steps.map((s, i) => {
          // Collapsed: just the one step to do next. "See all steps" opens the list.
          if (!open && s !== next) return null;
          const isDone = done[s.id];
          const isNext = s === next;
          return (
            <li key={s.id} style={{ borderTop: open && i ? "1px solid var(--border-subtle)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 60 }}>
                <span style={{ width: 40, display: "flex", justifyContent: "center", flexShrink: 0, color: isDone ? "var(--success)" : isNext ? "var(--acc)" : "var(--text-tertiary)" }}>
                  {isDone
                    ? <HandCheck size={22} />
                    : <span className="hand" style={{ "--hand-size": "16px" }}><HandCircle i={i} pad="0" style={{ width: 30, height: 28 }}>{i + 1}</HandCircle></span>}
                </span>
                <button
                  onClick={isDone ? undefined : s.act}
                  disabled={isDone}
                  className={isDone ? undefined : "btn-press"}
                  style={{
                    flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, textAlign: "left",
                    background: "none", border: "none", padding: "10px 0", cursor: isDone ? "default" : "pointer",
                    fontFamily: FONT, color: "var(--text-primary)",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 15, fontWeight: isNext ? 700 : 600, color: isDone ? "var(--text-tertiary)" : "var(--text-primary)", textDecoration: isDone ? "line-through" : "none" }}>{s.title}</span>
                    {!isDone && <span style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{s.hint}</span>}
                  </span>
                  {!isDone && <ChevronRight size={18} strokeWidth={1.8} style={{ color: isNext ? "var(--acc)" : "var(--text-tertiary)", flexShrink: 0 }} />}
                </button>
              </div>
              {s.alt && !isDone && (
                <button onClick={s.alt.act} className="hand" style={{ margin: "-6px 0 10px 52px", background: "none", border: "none", padding: "4px 0", color: "var(--acc)", cursor: "pointer" }}>
                  {s.alt.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <button onClick={() => setOpen(v => !v)} className="hand" style={{
        display: "block", margin: "0 0 4px 52px", minHeight: 44, padding: "0 2px", background: "none", border: "none",
        color: "var(--text-secondary)", cursor: "pointer", fontSize: 15,
      }}>{open ? "Show less" : "See all 4 steps"}</button>
    </section>
  );
}
