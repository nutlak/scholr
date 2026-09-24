import { useEffect, useRef } from "react";

// A rotating wireframe icosahedron, projected by hand into a canvas.
//
// The reference site Noah sent leads with a 3D object, and a 3D object is the
// thing that actually reads as "built by someone who can". Reaching for
// three.js to draw twelve vertices would add ~150kb gzipped to a study app's
// landing page for one decorative shape — the maths here is a dozen lines and
// ships nothing.
//
// Deliberately slow and low-contrast: this sits behind a headline that has to
// be read, so it is atmosphere, not the subject.

// Icosahedron from the golden ratio: (0, ±1, ±φ) and its cyclic permutations.
const PHI = (1 + Math.sqrt(5)) / 2;
const VERTS = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
];
// Every vertex pair exactly 2 apart is an edge (edge length is 2 at this scale).
const EDGES = [];
for (let i = 0; i < VERTS.length; i++) {
  for (let j = i + 1; j < VERTS.length; j++) {
    const d = Math.hypot(...VERTS[i].map((v, k) => v - VERTS[j][k]));
    if (Math.abs(d - 2) < 0.001) EDGES.push([i, j]);
  }
}

export function HeroMesh({ size = 340 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const c = size / 2;
    const R = size * 0.30;
    let raf = 0;
    let t = reduced ? 0.6 : 0;      // a fixed, pleasant angle when motion is off
    let running = true;

    // Stop burning a frame loop when the hero is scrolled away or the tab is
    // hidden — this runs on phones.
    const io = new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running && !reduced) tick(); });
    io.observe(canvas);
    const onVis = () => { running = !document.hidden; if (running && !reduced) tick(); };
    document.addEventListener("visibilitychange", onVis);

    function draw() {
      ctx.clearRect(0, 0, size, size);
      const cosY = Math.cos(t), sinY = Math.sin(t);
      const cosX = Math.cos(t * 0.45), sinX = Math.sin(t * 0.45);

      const pts = VERTS.map(([x, y, z]) => {
        // rotate Y, then X
        let X = x * cosY + z * sinY;
        let Z = -x * sinY + z * cosY;
        const Y = y * cosX - Z * sinX;
        Z = y * sinX + Z * cosX;
        const p = 2.6 / (2.6 + Z * 0.42);        // weak perspective
        return { x: c + X * R * p, y: c + Y * R * p, depth: Z, p };
      });

      for (const [a, b] of EDGES) {
        const A = pts[a], B = pts[b];
        // Depth fade: far edges recede instead of tangling with near ones.
        const near = (A.depth + B.depth) / 2;
        const alpha = 0.10 + 0.20 * (1 - (near + PHI) / (PHI * 2));
        ctx.strokeStyle = `rgba(167,139,250,${alpha.toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      }

      for (const P of pts) {
        const alpha = 0.25 + 0.45 * (1 - (P.depth + PHI) / (PHI * 2));
        ctx.fillStyle = `rgba(196,181,253,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(P.x, P.y, 1.6 * P.p, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function tick() {
      if (!running || reduced) return;
      t += 0.0022;                    // one turn ≈ 48s. Atmosphere, not motion.
      draw();
      raf = requestAnimationFrame(tick);
    }

    draw();
    if (!reduced) tick();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [size]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: size, height: size,
        pointerEvents: "none", zIndex: 0,
        // Fade the lower third so the badge and headline below sit on clean
        // background instead of on wireframe. The mesh is atmosphere; the words
        // are the point.
        maskImage: "radial-gradient(ellipse 70% 60% at 50% 42%, #000 55%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 42%, #000 55%, transparent 100%)",
      }}
    />
  );
}
