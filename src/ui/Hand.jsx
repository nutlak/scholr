// Hand-drawn pen marks: a loop drawn around something, a tick, a wavy rule.
// Each is one SVG stroke in currentColor, so it takes the colour of whatever
// it sits in. Strokes don't scale with the box (vector-effect), so a loop
// around a long label and one around an icon are the same pen width.
// Loops vary by `i` so a row of them doesn't look stamped.
const LOOPS = [
  "M9 31C6 14 44 4 101 5s94 10 92 27-52 24-99 23S11 47 9 31c-1-9 11-18 28-22",
  "M7 27C9 11 52 3 105 6s91 12 88 28-57 21-101 19S5 43 7 27c1-9 15-16 31-19",
  "M11 25C13 9 57 5 102 6s88 15 85 28-49 22-96 20S9 39 11 25c2-7 13-14 29-17",
];

const fill = { position: "absolute", left: -6, top: -5, width: "calc(100% + 12px)", height: "calc(100% + 10px)", overflow: "visible", pointerEvents: "none" };

export function HandCircle({ children, i = 0, stroke = 1.8, pad = "6px 16px", style }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: pad, ...style }}>
      <svg viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true" style={fill}>
        <path d={LOOPS[i % LOOPS.length]} fill="none" stroke="currentColor" strokeWidth={stroke}
          strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {children}
    </span>
  );
}

export function HandCheck({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, overflow: "visible" }}>
      <path d="M3.5 13.2c2.2 1.4 3.8 3.1 5.2 5.6C11.6 12 15.6 7.2 21 3.8" fill="none" stroke="currentColor"
        strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HandRule({ style }) {
  return (
    <svg viewBox="0 0 300 8" preserveAspectRatio="none" aria-hidden="true" style={{ display: "block", width: "100%", height: 8, overflow: "visible", ...style }}>
      <path d="M2 5c40-3 70 2 110-1s80-3 120 0 50 1 66-1" fill="none" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Handwritten text whose digits stay in the UI face: Kalam's "1" is a bare
// stroke that reads as a slash or an "l" ("Oct 17", "1 member").
// One wrapping span, so a flex parent (HandCircle) doesn't trim the spaces
// around the digits.
export function HandText({ children }) {
  return <span>{String(children).split(/(\d+)/).map((part, i) =>
    /\d/.test(part) ? <span key={i} className="num">{part}</span> : part)}</span>;
}
