import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Check, X } from "lucide-react";
import { api } from "../../api.js";
import { sessionWhen } from "../../lib/format.js";
import { FONT } from "../../lib/theme.js";
import { Sheet } from "../../ui/Sheet.jsx";

// ── Study sessions ───────────────────────────────────────────────────────────
// "Study for this unit tonight at 8" — a time everyone in the unit sees, can
// say "I'm in" to, and gets reminded about. Sits above the chat. Shows nothing
// but a quiet "Plan a session" link until one exists, so it costs no space.

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm".
const toLocalInput = (d) => {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
// Tonight at 8pm, or an hour from now if that has passed.
const suggested = () => {
  const t = new Date(); t.setHours(20, 0, 0, 0);
  return t.getTime() > Date.now() + 30 * 60 * 1000 ? t : new Date(Date.now() + 60 * 60 * 1000);
};

function PlanSheet({ notebookId, onClose, onPlanned }) {
  const [when, setWhen] = useState(() => toLocalInput(suggested()));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api.createSession(notebookId, { startsAt: new Date(when).toISOString(), note });
      onPlanned();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Sheet title="Plan a study session" onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Everyone in this unit gets a heads-up, and a reminder just before it starts.
        </p>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
          When
          <input type="datetime-local" required value={when} onChange={e => setWhen(e.target.value)}
            style={{ height: 44, padding: "0 12px", fontSize: 15, fontFamily: FONT, background: "var(--s2)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
          <span>What are you covering? <span style={{ fontWeight: 400, color: "var(--text-tertiary)" }}>(optional)</span></span>
          <input type="text" maxLength={80} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. chapter 4 review"
            style={{ height: 44, padding: "0 12px", fontSize: 15, fontFamily: FONT, background: "var(--s2)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
        </label>
        {error && <div role="alert" style={{ fontSize: 13, color: "var(--danger)" }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} className="btn-press" style={{ height: 44, padding: "0 18px", fontFamily: FONT, fontSize: 14, fontWeight: 600, background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-default)", cursor: "pointer" }}>Cancel</button>
          <button type="submit" disabled={busy} className="btn-press" style={{ height: 44, padding: "0 22px", fontFamily: FONT, fontSize: 14, fontWeight: 700, background: "var(--acc)", color: "var(--on-acc)", border: "none", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>Plan it</button>
        </div>
      </form>
    </Sheet>
  );
}

export function StudySessions({ notebookId, me, onToast }) {
  const [sessions, setSessions] = useState([]);
  const [planning, setPlanning] = useState(false);
  const [pending, setPending] = useState(null); // session id mid-request

  const load = useCallback(() => {
    api.listSessions(notebookId).then(setSessions).catch(() => {});
  }, [notebookId]);
  useEffect(() => { load(); }, [load]);
  // A session someone plans while you're here shows up without a reload.
  useEffect(() => { const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  async function rsvp(s, going) {
    setPending(s.id);
    try {
      const next = await api.rsvpSession(s.id, going);
      setSessions(prev => prev.map(x => (x.id === s.id ? (next ?? x) : x)));
    } catch (e) { onToast?.(e.message); }
    setPending(null);
  }
  async function cancel(s) {
    setPending(s.id);
    try { await api.cancelSession(s.id); setSessions(prev => prev.filter(x => x.id !== s.id)); onToast?.("Session cancelled"); }
    catch (e) { onToast?.(e.message || "Couldn't cancel that."); }
    setPending(null);
  }

  const small = { fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: "pointer", minHeight: 36, padding: "0 14px" };

  return (
    <div className="no-print" style={{ marginBottom: sessions.length ? 14 : 6 }}>
      {sessions.map(s => {
        const names = s.going.map(g => (g.userId === me?.userId ? "You" : g.name));
        const planner = s.createdBy === me?.userId;
        return (
          <div key={s.id} className="lift-card" style={{ background: "var(--card-bg)", borderRadius: 14, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontFamily: FONT }}>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                Study session <span className="hand" style={{ color: "var(--text-secondary)", marginLeft: 4 }}>{sessionWhen(s.startsAt)}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2, overflowWrap: "anywhere" }}>
                {s.note ? `${s.note} · ` : ""}{names.length ? `${names.join(", ")} ${names.length === 1 && names[0] !== "You" ? "is" : "are"} in` : "Nobody yet"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {s.mine ? (
                <button onClick={() => rsvp(s, false)} disabled={pending === s.id} className="btn-press" style={{ ...small, background: "var(--acc-bg)", color: "var(--acc)", border: "1px solid var(--acc)" }}>
                  <Check size={14} strokeWidth={2.2} style={{ verticalAlign: "-2px", marginRight: 4 }} />You're in
                </button>
              ) : (
                <button onClick={() => rsvp(s, true)} disabled={pending === s.id} className="btn-press" style={{ ...small, background: "var(--acc)", color: "var(--on-acc)", border: "none" }}>I'm in</button>
              )}
              {planner && (
                <button onClick={() => cancel(s)} disabled={pending === s.id} aria-label="Cancel this session" title="Cancel this session" className="btn-press" style={{ ...small, width: 36, padding: 0, background: "transparent", color: "var(--text-tertiary)", border: "1px solid var(--border-default)" }}>
                  <X size={15} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
        );
      })}
      <button onClick={() => setPlanning(true)} className="hand" style={{ background: "none", border: "none", color: "var(--acc)", cursor: "pointer", padding: "6px 2px", display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36 }}>
        <CalendarPlus size={16} strokeWidth={1.9} /> Plan a study session
      </button>
      {planning && <PlanSheet notebookId={notebookId} onClose={() => setPlanning(false)} onPlanned={() => { setPlanning(false); load(); onToast?.("Planned. Your classmates have been told."); }} />}
    </div>
  );
}
