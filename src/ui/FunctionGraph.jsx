import { useMemo } from "react";
import { compile, evaluateAt } from "../lib/mathExpr.js";
import {
  scaleLinear, linearTicks, piTicks, sampleSegments, segmentToPath,
} from "../lib/graphGeometry.js";

/* A real, plotted function graph — not an illustration. The curve is sampled
 * from the actual expression, axes are labelled with the real tick values,
 * and asymptotes are genuine breaks in the path rather than a gap drawn by
 * eye. This is what makes a generated worksheet's graphs trustworthy instead
 * of decorative.
 *
 * `spec` fields (all but `expr` optional):
 *   expr        function of x, in the mathExpr grammar (sin, cos, tan, csc,
 *               sec, cot, sqrt, abs, ^, pi, e, x) — never eval'd, always
 *               compiled through the safe parser.
 *   xMin, xMax  domain, as a number or a constant expression string ("2pi").
 *               Default: one period at 0..2π.
 *   yMin, yMax  range. Default: -4..4.
 *   xUnit       "pi" (default) labels the x-axis in π fractions; "linear"
 *               uses plain numbers, for a non-trig function.
 *   asymptotes  array of x positions (number or expression string) that must
 *               never be drawn across.
 *   keyPoints   array of {x, y, label} to mark and annotate.
 *   midline     a dashed horizontal reference line.
 *   guide       a second function, drawn dashed and muted, for showing e.g.
 *               sin(x) under csc(x).
 *   label       caption and accessible name, e.g. "y = csc θ".
 *
 * A spec that fails to compile or evaluate renders nothing rather than
 * throwing — this sits inside model-generated content, and a malformed graph
 * spec must degrade to "no graph here", never to a broken notebook page.
 */
export function FunctionGraph({ spec }) {
  const built = useMemo(() => buildGraph(spec), [spec]);
  if (!built) return null;

  const {
    W, H, padL, padT, padR, padB, xMin, xMax, yMin, yMax,
    xTicks, yTicks, mainPaths, guidePath, asymptoteXs, midlineY, points, label,
  } = built;

  const pxLeft = padL, pxRight = W - padR, pxTop = padT, pxBottom = H - padB;
  const toPx = (x, y) => [
    scaleLinear(x, xMin, xMax, pxLeft, pxRight),
    scaleLinear(y, yMin, yMax, pxBottom, pxTop),
  ];
  const clipId = `fg-${built.id}`;

  return (
    <figure style={{ margin: "14px 0 8px", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label || "Function graph"}
        style={{ display: "block", width: "100%", maxWidth: 640, minWidth: 420, height: "auto" }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={pxLeft} y={pxTop} width={pxRight - pxLeft} height={pxBottom - pxTop} />
          </clipPath>
        </defs>

        <rect x={pxLeft} y={pxTop} width={pxRight - pxLeft} height={pxBottom - pxTop}
              fill="var(--bg-surface-2, var(--s2))" stroke="var(--border)" />

        {/* Gridlines + tick labels */}
        {xTicks.map((t, i) => {
          const [px] = toPx(t.value, 0);
          return (
            <g key={`xt${i}`}>
              <line x1={px} y1={pxTop} x2={px} y2={pxBottom} stroke="var(--border-subtle)" strokeWidth={1} />
              <text x={px} y={pxBottom + 18} textAnchor="middle" fontSize={12}
                    fontFamily="var(--mono)" fill="var(--text-tertiary)">{t.label}</text>
            </g>
          );
        })}
        {yTicks.map((v, i) => {
          const [, py] = toPx(0, v);
          return (
            <g key={`yt${i}`}>
              <line x1={pxLeft} y1={py} x2={pxRight} y2={py} stroke="var(--border-subtle)" strokeWidth={1} />
              <text x={pxLeft - 8} y={py + 4} textAnchor="end" fontSize={12}
                    fontFamily="var(--mono)" fill="var(--text-tertiary)">{fmtNum(v)}</text>
            </g>
          );
        })}

        {/* Axes, only where they actually fall inside the visible range */}
        {yMin <= 0 && 0 <= yMax && (
          <line x1={pxLeft} y1={toPx(0, 0)[1]} x2={pxRight} y2={toPx(0, 0)[1]} stroke="var(--text-tertiary)" strokeWidth={1.3} />
        )}
        {xMin <= 0 && 0 <= xMax && (
          <line x1={toPx(0, 0)[0]} y1={pxTop} x2={toPx(0, 0)[0]} y2={pxBottom} stroke="var(--text-tertiary)" strokeWidth={1.3} />
        )}

        {midlineY != null && (
          <line x1={pxLeft} y1={toPx(0, midlineY)[1]} x2={pxRight} y2={toPx(0, midlineY)[1]}
                stroke="var(--text-tertiary)" strokeWidth={1} strokeDasharray="5 5" />
        )}

        {asymptoteXs.map((x, i) => (
          <line key={`asym${i}`} x1={toPx(x, 0)[0]} y1={pxTop} x2={toPx(x, 0)[0]} y2={pxBottom}
                stroke="var(--danger)" strokeWidth={1.3} strokeDasharray="6 5" />
        ))}

        {guidePath && (
          <path d={guidePath} clipPath={`url(#${clipId})`} fill="none"
                stroke="var(--text-tertiary)" strokeWidth={1.4} strokeDasharray="3 4" />
        )}

        {mainPaths.map((d, i) => (
          <path key={i} d={d} clipPath={`url(#${clipId})`} fill="none"
                stroke="var(--acc)" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {points.map((p, i) => {
          const [px, py] = toPx(p.x, p.y);
          return (
            <g key={i}>
              <circle cx={px} cy={py} r={3.6} fill="var(--text-primary)" />
              {p.label && (
                <text x={px} y={py - 10} textAnchor="middle" fontSize={12.5}
                      fontFamily="var(--mono)" fill="var(--text-primary)"
                      paintOrder="stroke" stroke="var(--bg-surface-2, var(--s2))" strokeWidth={4}>
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {label && (
        <figcaption style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 4 }}>{label}</figcaption>
      )}
    </figure>
  );
}

let nextId = 0;

// A number or a constant expression ("2pi", "-pi/2") — never x-dependent, so
// evaluating at x=0 is exactly evaluating the constant.
function toNumber(v, fallback) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    try { const n = evaluateAt(v, 0); if (Number.isFinite(n)) return n; } catch { /* fall through */ }
  }
  return fallback;
}

function fmtNum(v) {
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function buildGraph(spec) {
  if (!spec || typeof spec.expr !== "string") return null;

  let fn;
  try { fn = compile(spec.expr); } catch { return null; }

  const xMin = toNumber(spec.xMin, 0);
  const xMax = toNumber(spec.xMax, 2 * Math.PI);
  const yMin = toNumber(spec.yMin, -4);
  const yMax = toNumber(spec.yMax, 4);
  if (!(xMax > xMin) || !(yMax > yMin)) return null;

  const asymptoteXs = (Array.isArray(spec.asymptotes) ? spec.asymptotes : [])
    .map(a => toNumber(a, null))
    .filter(x => x != null && x > xMin && x < xMax);

  const autoBreakY = Math.max(Math.abs(yMin), Math.abs(yMax)) * 8;
  const segments = sampleSegments(fn, xMin, xMax, { breaks: asymptoteXs, autoBreakY, steps: 700 });

  const W = 620, H = 290, padL = 46, padT = 12, padR = 12, padB = 26;
  const geo = { xMin, xMax, yMin, yMax, pxLeft: padL, pxRight: W - padR, pxTop: padT, pxBottom: H - padB };
  const mainPaths = segments.map(seg => segmentToPath(seg, geo));

  let guidePath = null;
  if (typeof spec.guide === "string") {
    try {
      const gfn = compile(spec.guide);
      const gsegs = sampleSegments(gfn, xMin, xMax, { autoBreakY, steps: 700 });
      guidePath = gsegs.map(seg => segmentToPath(seg, geo)).join(" ");
    } catch { /* draw without the guide curve */ }
  }

  const points = (Array.isArray(spec.keyPoints) ? spec.keyPoints : [])
    .map(p => ({ x: toNumber(p.x, null), y: toNumber(p.y, null), label: typeof p.label === "string" ? p.label : "" }))
    .filter(p => p.x != null && p.y != null && p.x >= xMin && p.x <= xMax && p.y >= yMin && p.y <= yMax);

  const xTicks = spec.xUnit === "linear" ? linearTicks(xMin, xMax).map(v => ({ value: v, label: fmtNum(v) })) : piTicks(xMin, xMax);
  const yTicks = linearTicks(yMin, yMax);
  const midlineY = spec.midline != null ? toNumber(spec.midline, null) : null;

  return {
    id: nextId++, W, H, padL, padT, padR, padB, xMin, xMax, yMin, yMax,
    xTicks, yTicks, mainPaths, guidePath, asymptoteXs,
    midlineY: midlineY != null && midlineY > yMin && midlineY < yMax ? midlineY : null,
    points, label: typeof spec.label === "string" ? spec.label : "",
  };
}
