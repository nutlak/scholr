// The landing hero: a hand-drawn explainer of the whole app in one line —
// your notes → Derek → your friends. Ink lines, handwritten notes in the three
// annotation colours (blue = what it is, orange = the flow, red = the point).
// The lines draw themselves in once; reduced motion gets them already drawn.
const INK = "var(--text-primary, #1C1C1C)";
const ORANGE = "#E8590C";
const BLUE = "#1D4ED8";
const RED = "#DC2626";
const hand = { fontFamily: "Kalam, cursive" };

export function HeroSketch({ width = 560 }) {
  return (
    <svg viewBox="0 0 560 300" width="100%" style={{ maxWidth: width, overflow: "visible" }} role="img"
      aria-label="Your notes go to Derek, the AI tutor, and from Derek to your friends.">
      <style>{`
        .hs-draw { stroke-dasharray: 900; stroke-dashoffset: 900; animation: hsDraw 1.6s ease-out forwards; }
        .hs-d2 { animation-delay: .5s } .hs-d3 { animation-delay: 1s } .hs-d4 { animation-delay: 1.4s }
        .hs-fade { opacity: 0; animation: hsFade .6s ease-out forwards; }
        @keyframes hsDraw { to { stroke-dashoffset: 0; } }
        @keyframes hsFade { to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .hs-draw { animation: none; stroke-dashoffset: 0; } .hs-fade { animation: none; opacity: 1; }
        }
      `}</style>

      {/* Your notes: a messy stack of pages */}
      <g fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
        <path className="hs-draw" d="M44 126c18-2 41-3 60-1l2 72c-20 2-42 2-61 0z" transform="rotate(-8 75 160)" />
        <path className="hs-draw" d="M52 120c18-1 40-2 59 0l1 73c-19 2-41 2-60 0z" transform="rotate(4 82 156)" />
        <path className="hs-draw" d="M62 130h4m6 0h24M62 144c10 0 22-1 34 0M62 158h20m6 0h12M62 172c8 0 18 0 26-1" fill="none" strokeWidth="1.8" transform="rotate(4 82 156)" />
      </g>
      <text className="hs-fade hs-d2" x="40" y="96" fill={BLUE} fontSize="19" style={hand}>your notes</text>
      <path className="hs-draw hs-d2" d="M80 102c1 5 1 9 0 14m-4-5 4 6 4-6" fill="none" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" />

      {/* The flow, orange and a little wavy */}
      <path className="hs-draw hs-d2" d="M128 162c22-8 38 6 58-2s34-6 52-1" fill="none" stroke={ORANGE} strokeWidth="3" strokeLinecap="round" />
      <path className="hs-draw hs-d2" d="M230 152l11 7-12 6" fill="none" stroke={ORANGE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {/* Derek: a speech bubble with dot eyes, serious about your notes */}
      <path className="hs-draw hs-d3" d="M258 112c20-3 46-3 66-1 7 1 10 6 10 13 1 16 0 30-2 42-1 7-5 10-12 10-12 1-24 0-36 1l-17 15c-2 1-3 0-3-2l3-13c-7-1-11-5-11-12-1-13-1-25 0-36 0-9 2-15 2-17z"
        fill={INK} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <circle className="hs-fade hs-d3" cx="282" cy="140" r="4.2" fill="#fff" />
      <circle className="hs-fade hs-d3" cx="306" cy="140" r="4.2" fill="#fff" />
      <path className="hs-draw hs-d3" d="M284 178l-6 24m26-24 6 24" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      <text className="hs-fade hs-d3" x="244" y="88" fill={ORANGE} fontSize="21" style={hand}>ask Derek anything</text>
      <path className="hs-draw hs-d3" d="M296 94c-1 4-1 8 0 12m-4-4 4 5 4-5" fill="none" stroke={ORANGE} strokeWidth="1.8" strokeLinecap="round" />

      {/* Out to friends: the line splits three ways */}
      <path className="hs-draw hs-d4" d="M342 150c22-10 44-26 74-30M342 158c26 0 50 4 80 2M342 166c22 10 46 26 76 30" fill="none" stroke={ORANGE} strokeWidth="2.6" strokeLinecap="round" />
      <g fill="#fff" stroke={INK} strokeWidth="2.2">
        <circle className="hs-draw hs-d4" cx="436" cy="116" r="17" />
        <circle className="hs-draw hs-d4" cx="444" cy="160" r="17" />
        <circle className="hs-draw hs-d4" cx="436" cy="204" r="17" />
      </g>
      <g className="hs-fade hs-d4" fill={INK}>
        <circle cx="430" cy="114" r="2.2" /><circle cx="442" cy="114" r="2.2" />
        <circle cx="438" cy="158" r="2.2" /><circle cx="450" cy="158" r="2.2" />
        <circle cx="430" cy="202" r="2.2" /><circle cx="442" cy="202" r="2.2" />
      </g>
      <text className="hs-fade hs-d4" x="486" y="166" fill={RED} fontSize="22" style={hand}>together</text>
      <path className="hs-draw hs-d4" d="M482 158c-6-2-11-1-16 1" fill="none" stroke={RED} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
