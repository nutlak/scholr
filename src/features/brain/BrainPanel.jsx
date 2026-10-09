import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Brain, RefreshCw } from "lucide-react";
import { api } from "../../api.js";
import { FONT } from "../../lib/theme.js";
import { feynmanScoreColor } from "../../lib/format.js";


// ── BrainPanel ────────────────────────────────────────────────────────────────
// The unit's key concepts around a hand-drawn circle, coloured by how well *you*
// understand each one (your Feynman grades, same bands as Feynman Mode). Links
// run behind the ball. Under the picture is the same information as a plain
// list, which is the part that has to work for everyone — the picture is the
// fun part, the list is the readable one.

// Logical stage; the SVGs scale it to the panel width.
// Sized for the ~315px dock and a phone: 17-unit labels land at ~13px there.
const W = 420, H = 320, CX = 210, CY = 158;
const BALL_R = 62, NODE_R = 92, LABEL_R = 104;

const BANDS = [
  { id: "untried", label: "Not tried yet" },
  { id: "shaky",   label: "Shaky" },
  { id: "close",   label: "Getting there" },
  { id: "solid",   label: "Solid" },
];
function band(score) {
  if (score === undefined) return "untried";
  return score >= 80 ? "solid" : score >= 55 ? "close" : "shaky";
}

// Up to two lines of ~10 characters, so labels stay inside the stage.
function wrap(name) {
  const lines = [""];
  for (const word of name.split(/\s+/)) {
    const cur = lines[lines.length - 1];
    if (cur && (cur + " " + word).length > 10 && lines.length < 2) lines.push(word);
    else lines[lines.length - 1] = cur ? `${cur} ${word}` : word;
  }
  return lines;
}

// The unit at the centre: a hand-drawn ink circle with its name lettered in.
function HandOrb({ label }) {
  const lines = wrap(label || "This unit").slice(0, 2);
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" style={{ overflow: "visible" }}>
      <path d="M50 6c22 0 42 15 43 41 1 25-17 46-42 47C26 95 7 77 6 52 5 27 24 7 47 6m6 1c18 2 32 12 37 29"
        fill="var(--paper)" stroke="var(--text-primary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <text x="50" y={lines.length > 1 ? 47 : 56} textAnchor="middle" fill="var(--acc)"
        style={{ fontFamily: "Kalam, cursive", fontWeight: 700, fontSize: 12.5 }}>
        {lines.map((l, k) => <tspan key={k} x="50" dy={k ? 15 : 0}>{l}</tspan>)}
      </text>
    </svg>
  );
}

export function BrainPanel({ nb, members = [], currentUserId, onExplain, onAsk, onToast, onUpgradeNeeded }) {
  const [state, setState] = useState({ loading: true, map: null, scores: {} });
  const [building, setBuilding] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let live = true;
    api.getBrain(nb.id)
      .then(d => live && setState({ loading: false, map: d.map, scores: d.scores ?? {} }))
      .catch(() => live && setState(s => ({ ...s, loading: false })));
    return () => { live = false; };
  }, [nb.id]);

  async function build() {
    setBuilding(true);
    try {
      const { map } = await api.buildBrain(nb.id);
      setState(s => ({ ...s, map }));
      setSelected(null);
    } catch (e) {
      if (e.code === "forge_limit_reached") onUpgradeNeeded?.("forge_limit");
      else onToast?.(e.message);
    } finally {
      setBuilding(false);
    }
  }

  const { map, scores } = state;

  const nodes = useMemo(() => (map?.concepts ?? []).map((c, i, all) => {
    const a = -Math.PI / 2 + (i / all.length) * Math.PI * 2;
    const score = scores[currentUserId]?.[c.name.toLowerCase()];
    const lines = wrap(c.name);
    const sin = Math.sin(a);
    // A friend who has this one down, when you don't yet.
    const friend = band(score) === "solid" ? null : members.find(m =>
      m.user_id !== currentUserId && (scores[m.user_id]?.[c.name.toLowerCase()] ?? 0) >= 80);
    return {
      ...c, i, score, friend, lines,
      x: CX + Math.cos(a) * NODE_R, y: CY + Math.sin(a) * NODE_R,
      // Friend dot sits on the side facing the ball, never on the label side.
      fx: CX + Math.cos(a) * (NODE_R - 11), fy: CY + Math.sin(a) * (NODE_R - 11),
      lx: CX + Math.cos(a) * LABEL_R, ly: CY + Math.sin(a) * LABEL_R,
      anchor: Math.abs(Math.cos(a)) < 0.3 ? "middle" : Math.cos(a) > 0 ? "start" : "end",
      // First baseline: below the node, above it, or centred beside it.
      ty: sin > 0.7 ? 15 : sin < -0.7 ? -5 - (lines.length - 1) * 18 : 6 - (lines.length - 1) * 9,
    };
  }), [map, scores, members, currentUserId]);

  if (state.loading) {
    return <div style={{ textAlign: "center", padding: 40, fontFamily: FONT, fontSize: 13 }}><span className="shimmer">Loading…</span></div>;
  }

  const ball = <HandOrb label={nb.topic || nb.title} />;

  if (!map) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14, fontFamily: FONT, padding: "4px 4px 8px" }}>
        <div style={{ width: 160, height: 160 }}>{ball}</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>Map this unit's brain</div>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-secondary)", margin: 0, maxWidth: 340 }}>
          Scholr reads your notes and finds the key ideas and how they connect. Explain each one in
          Feynman Mode and it lights up as you learn it.
        </p>
        <button onClick={build} disabled={building} className="btn-press" style={primaryBtn(building)}>
          {building ? <span className="shimmer">Reading your notes…</span> : "Build the brain"}
        </button>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Uses one AI generation</div>
      </div>
    );
  }

  const sel = selected === null ? null : nodes[selected];
  const linked = new Set(sel ? map.links.filter(l => l.includes(sel.i)).flat() : []);

  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Stage: links behind the ball, nodes in front of it. */}
      <div style={{ position: "relative", width: "100%", aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden="true">
          {map.links.map(([a, b]) => {
            const A = nodes[a], B = nodes[b];
            if (!A || !B) return null;
            const mx = CX + ((A.x + B.x) / 2 - CX) * 0.35, my = CY + ((A.y + B.y) / 2 - CY) * 0.35;
            const on = sel && (a === sel.i || b === sel.i);
            return <path key={`${a}-${b}`} d={`M${A.x},${A.y} Q${mx},${my} ${B.x},${B.y}`}
              style={{ fill: "none", stroke: "var(--acc)", strokeWidth: on ? 2 : 1, opacity: on ? 0.9 : sel ? 0.12 : 0.3, transition: "opacity .2s" }} />;
          })}
        </svg>
        <div style={{
          position: "absolute",
          left: `${((CX - BALL_R) / W) * 100}%`, top: `${((CY - BALL_R) / H) * 100}%`,
          width: `${((BALL_R * 2) / W) * 100}%`, height: `${((BALL_R * 2) / H) * 100}%`,
        }}>{ball}</div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {nodes.map(n => {
            const color = n.score === undefined ? "var(--text-tertiary)" : feynmanScoreColor(n.score);
            const dim = sel && sel.i !== n.i && !linked.has(n.i);
            return (
              <g key={n.i} role="button" tabIndex={0} aria-label={`${n.name}: ${BANDS.find(b => b.id === band(n.score)).label}`}
                 onClick={() => setSelected(selected === n.i ? null : n.i)}
                 onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(selected === n.i ? null : n.i); } }}
                 style={{ cursor: "pointer", pointerEvents: "auto", opacity: dim ? 0.35 : 1, transition: "opacity .2s", outline: "none" }}>
                <circle cx={n.x} cy={n.y} r={20} style={{ fill: "transparent" }} />
                <circle cx={n.x} cy={n.y} r={sel?.i === n.i ? 9 : 7}
                  style={{ fill: n.score === undefined ? "var(--bg-base)" : color, stroke: color, strokeWidth: 2, transition: "r .2s" }} />
                {n.friend && <circle cx={n.fx} cy={n.fy} r={3.5} style={{ fill: "var(--acc)", stroke: "var(--bg-base)", strokeWidth: 1.5 }} />}
                <text x={n.lx} y={n.ly + n.ty} textAnchor={n.anchor}
                  style={{ fill: "var(--text-primary)", fontSize: 17, fontWeight: sel?.i === n.i ? 700 : 500, fontFamily: FONT }}>
                  {n.lines.map((l, k) => <tspan key={k} x={n.lx} dy={k ? 18 : 0}>{l}</tspan>)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {sel && (
        <div style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 650, color: "var(--text-primary)" }}>{sel.name}</div>
            <div style={{ fontSize: 13, color: sel.score === undefined ? "var(--text-tertiary)" : feynmanScoreColor(sel.score), whiteSpace: "nowrap" }}>
              {sel.score === undefined ? "Not tried yet" : `You scored ${sel.score}`}
            </div>
          </div>
          {sel.summary && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--text-secondary)" }}>{sel.summary}</p>}
          {sel.friend && (
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {sel.friend.first_name || sel.friend.display_name || sel.friend.username} has this one down. Ask them.
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button className="btn-press" onClick={() => onExplain?.(sel.name)} style={primaryBtn(false)}>
              <Brain size={16} strokeWidth={1.9} /> Explain it
            </button>
            <button className="btn-press" onClick={() => onAsk?.(`Explain ${sel.name} using my notes.`)} style={secondaryBtn}>
              <MessageCircle size={16} strokeWidth={1.9} /> Ask Derek
            </button>
          </div>
        </div>
      )}

      {/* The same map as a list, grouped by how well you know each concept. */}
      {BANDS.slice().reverse().map(b => {
        const group = nodes.filter(n => band(n.score) === b.id);
        if (!group.length) return null;
        return (
          <div key={b.id}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-tertiary)", margin: "4px 2px 6px" }}>{b.label} · {group.length}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {group.map(n => (
                <button key={n.i} onClick={() => setSelected(n.i)} className="btn-press" style={{
                  display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "0 12px", textAlign: "left",
                  background: selected === n.i ? "var(--acc-bg)" : "transparent", border: "1px solid var(--border-subtle)",
                  borderRadius: 10, color: "var(--text-primary)", fontFamily: FONT, fontSize: 14, cursor: "pointer",
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                    background: n.score === undefined ? "transparent" : feynmanScoreColor(n.score),
                    border: `2px solid ${n.score === undefined ? "var(--text-tertiary)" : feynmanScoreColor(n.score)}` }} />
                  <span style={{ flex: 1 }}>{n.name}</span>
                  {n.score !== undefined && <span style={{ fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums", fontSize: 13, color: "var(--text-secondary)" }}>{n.score}</span>}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <button onClick={build} disabled={building} className="btn-press" style={{ ...secondaryBtn, alignSelf: "center", padding: "0 16px" }}>
        {building ? <span className="shimmer">Rebuilding…</span> : <><RefreshCw size={15} strokeWidth={1.9} /> Rebuild from the latest notes</>}
      </button>
    </div>
  );
}

const primaryBtn = (busy) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
  minHeight: 46, padding: "0 22px", borderRadius: 12, border: "none",
  background: "var(--acc)", color: "var(--on-acc)", fontFamily: FONT, fontSize: 15, fontWeight: 600,
  cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1,
});
const secondaryBtn = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
  minHeight: 46, borderRadius: 12, background: "var(--bg-surface-2)",
  border: "1px solid var(--border-default)", color: "var(--text-primary)",
  fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: "pointer",
};
