/* Pure geometry helpers for plotting a function's graph — no DOM, no SVG,
 * so they're unit-testable on their own. FunctionGraph.jsx wires these into
 * markup; this file is where the actual maths of "where does this point go"
 * and "what does this axis look like" lives.
 */

/** Map a data-space value to pixel space, given the visible [min, max] and
 * the pixel span it should fill. No y-flip here — callers pass the flip
 * themselves by giving pxLow > pxHigh for an axis that increases upward. */
export function scaleLinear(value, min, max, pxLow, pxHigh) {
  if (max === min) return (pxLow + pxHigh) / 2;
  const t = (value - min) / (max - min);
  return pxLow + t * (pxHigh - pxLow);
}

/** A "nice" axis step (1, 2, 2.5, 5, ×10^n) for a given range and a rough
 * target tick count — the standard nice-numbers algorithm, so a y-axis from
 * -4.2 to 4.2 gets ticks at -4,-2,0,2,4 rather than at 0.84 intervals. */
export function niceStep(range, targetCount = 6) {
  if (!(range > 0)) return 1;
  const raw = range / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * mag;
}

/** Tick values for a linear axis: nice steps, inclusive of both ends,
 * snapped so 0 is always exactly on a tick when it's in range (which it
 * almost always is for these graphs, and matters more than usual — a
 * midline or x-axis that doesn't land on a gridline looks like an error). */
export function linearTicks(min, max, targetCount = 6) {
  const step = niceStep(max - min, targetCount);
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  // Floating point: 30 iterations is far more than any sane axis needs, and
  // caps a malformed spec (e.g. yMax < yMin) from looping forever.
  for (let v = start, i = 0; v <= max + step * 1e-9 && i < 60; v += step, i++) {
    ticks.push(Math.abs(v) < step * 1e-9 ? 0 : Math.round(v * 1e9) / 1e9);
  }
  return ticks;
}

/** Choose a tick spacing in units of π: π/4, π/2, or π, matching how a
 * textbook actually spaces a trig axis — quarter-period ticks on a narrow
 * view (so the five key points of one arch each land on a gridline),
 * half-π on the common one-to-three-period view, and whole-π once the
 * domain spans enough periods that finer ticks would just crowd the labels.
 *
 * This has to check narrowest first: an early version checked coarsest
 * first and returned the first step that kept the tick count under budget,
 * which is backwards — every span keeps a large enough step under budget,
 * so it always returned the coarsest option and a single-period graph got
 * whole-π ticks instead of the five-key-point half-π ticks it needs. */
export function piTickStep(xMin, xMax) {
  const span = (xMax - xMin) / Math.PI; // domain width, in units of π
  if (span <= 1) return 0.25;
  if (span <= 6) return 0.5;
  return 1;
}

/** Format a multiple of π as the fraction a student would actually write:
 * 0 -> "0", 1 -> "π", -1 -> "−π", 0.5 -> "π/2", 1.5 -> "3π/2", 2 -> "2π",
 * 0.25 -> "π/4". `denom` is the tick step's own denominator (4 for quarter
 * steps, 2 for halves, 1 for whole), so 3/4 doesn't get reduced to 0.75π. */
export function formatPiMultiple(k, denom) {
  if (Math.abs(k) < 1e-9) return "0";
  const sign = k < 0 ? "−" : "";
  const num = Math.round(Math.abs(k) * denom);
  if (num % denom === 0) {
    const whole = num / denom;
    return whole === 1 ? `${sign}π` : `${sign}${whole}π`;
  }
  // Reduce the fraction (e.g. 2/4 -> 1/2) rather than trusting the caller.
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(num, denom);
  const n = num / g, d = denom / g;
  return `${sign}${n === 1 ? "" : n}π/${d}`;
}

/** x-axis ticks for a π-scaled graph: [{value (radians), label}]. */
export function piTicks(xMin, xMax) {
  const step = piTickStep(xMin, xMax);
  const denom = step === 1 ? 1 : step === 0.5 ? 2 : 4;
  const stepRad = step * Math.PI;
  const startK = Math.ceil(xMin / stepRad);
  const endK = Math.floor(xMax / stepRad);
  const ticks = [];
  for (let k = startK; k <= endK && ticks.length < 60; k++) {
    const value = k * stepRad;
    ticks.push({ value, label: formatPiMultiple(k * step, denom) });
  }
  return ticks;
}

/**
 * Sample fn(x) across [xMin, xMax], returning an array of segments (each an
 * array of {x, y} in DATA space) — broken wherever the function should not
 * be drawn as continuous.
 *
 * Two independent reasons to break, both needed: `breaks` are asymptote
 * positions the caller already knows (from the graph spec, or the model's
 * stated domain), which get a small excluded window either side so the
 * sampler never evaluates exactly on one. `autoBreakY` is a magnitude — any
 * sample whose |y| exceeds it starts a new segment, which catches a real
 * asymptote the caller didn't list (a wrong or incomplete spec should still
 * render sensibly rather than draw a near-vertical line across the whole
 * plot, which is what an unbroken tan(x) looks like).
 */
export function sampleSegments(fn, xMin, xMax, { breaks = [], autoBreakY, steps = 700 } = {}) {
  const dx = (xMax - xMin) / steps;
  const segments = [];
  let current = [];

  const nearBreak = x => breaks.some(b => Math.abs(x - b) < dx * 0.4);

  for (let i = 0; i <= steps; i++) {
    const x = xMin + i * dx;
    if (nearBreak(x)) {
      if (current.length > 1) segments.push(current);
      current = [];
      continue;
    }
    let y;
    try { y = fn(x); } catch { y = NaN; }
    const finite = Number.isFinite(y);
    const withinAuto = autoBreakY == null || Math.abs(y) <= autoBreakY;
    if (!finite || !withinAuto) {
      if (current.length > 1) segments.push(current);
      current = [];
      continue;
    }
    current.push({ x, y });
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

/** Build an SVG path `d` for one segment, mapping data space to pixel space
 * and clamping y so a branch that runs off the plot draws a clean vertical
 * exit instead of a wild, off-scale spike — the caller clips with an SVG
 * clipPath so only the in-bounds portion shows, matching how a graphing
 * calculator draws an asymptote's branches. */
export function segmentToPath(segment, { xMin, xMax, yMin, yMax, pxLeft, pxRight, pxTop, pxBottom }) {
  const clampMargin = (pxBottom - pxTop); // one plot-height of overrun is plenty
  const yLo = pxTop - clampMargin, yHi = pxBottom + clampMargin;
  const pts = segment.map(({ x, y }) => {
    const px = scaleLinear(x, xMin, xMax, pxLeft, pxRight);
    let py = scaleLinear(y, yMin, yMax, pxBottom, pxTop); // flipped: y increases upward
    if (py < yLo) py = yLo;
    if (py > yHi) py = yHi;
    return [px, py];
  });
  return pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(2)},${py.toFixed(2)}`).join("");
}
