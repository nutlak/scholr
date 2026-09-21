import { useEffect, useRef, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { FONT, FONT_HEADING } from "../../lib/theme.js";
import { useEscape } from "../../ui/useEscape.js";

const W = 1080, H = 1080;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Draws the shareable streak card onto a canvas — same void/grid/glow motif
// as hud.css's backplate, reproduced with canvas draw calls rather than
// screenshotting the DOM, so it renders identically regardless of what's
// currently scrolled/open behind it.
async function drawCard(canvas, { streak, longest, daysVisited }) {
  const ctx = canvas.getContext("2d");
  canvas.width = W; canvas.height = H;

  // Void background
  ctx.fillStyle = "#05030c";
  ctx.fillRect(0, 0, W, H);

  // Reactor glow (mirrors body::after in hud.css)
  const glow = ctx.createRadialGradient(W * 0.5, H * 0.32, 0, W * 0.5, H * 0.32, W * 0.6);
  glow.addColorStop(0, "rgba(167,139,250,0.16)");
  glow.addColorStop(1, "rgba(167,139,250,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Faint grid (mirrors body::before)
  ctx.strokeStyle = "rgba(167,139,250,0.09)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Logo
  try {
    const logo = await loadImage("/scholr-logo-final.png");
    const size = 72;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(W / 2 - size / 2, 96, size, size, 16);
    ctx.clip();
    ctx.drawImage(logo, W / 2 - size / 2, 96, size, size);
    ctx.restore();
  } catch { /* logo optional */ }

  ctx.textAlign = "center";
  ctx.fillStyle = "#F5F5FA";
  ctx.font = "600 40px " + FONT;
  ctx.fillText("scholr", W / 2, 250);

  // Big streak number
  ctx.font = "700 340px " + FONT_HEADING;
  const grad = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
  grad.addColorStop(0, "#C4B5FD"); grad.addColorStop(0.45, "#A78BFA"); grad.addColorStop(1, "#8B5CF6");
  ctx.fillStyle = grad;
  ctx.fillText(String(streak), W / 2, 640);

  ctx.font = "600 44px " + FONT;
  ctx.fillStyle = "#F5F5FA";
  ctx.fillText(streak === 1 ? "DAY STREAK" : "DAY STREAK", W / 2, 710);

  // Secondary stats row
  ctx.font = "500 32px " + FONT;
  ctx.fillStyle = "rgba(245,245,250,0.65)";
  ctx.fillText(`Longest: ${Math.max(longest, streak)}   ·   ${daysVisited} days studied`, W / 2, 800);

  // Footer
  ctx.font = "500 28px " + FONT;
  ctx.fillStyle = "rgba(245,245,250,0.4)";
  ctx.fillText("scholr.dev — study smarter, study together", W / 2, H - 80);
}

export function ShareStreakCard({ streak, longest, daysVisited, onClose }) {
  useEscape(onClose);
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    drawCard(canvasRef.current, { streak, longest, daysVisited }).then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [streak, longest, daysVisited]);

  function download() {
    canvasRef.current.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `scholr-streak-${streak}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  async function share() {
    canvasRef.current.toBlob(async blob => {
      const file = new File([blob], `scholr-streak-${streak}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "My scholr streak" }); }
        catch { /* user cancelled */ }
      } else {
        download();
      }
    }, "image/png");
  }

  return (
    <div className="mobile-sheet-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(8,8,14,0.82)",
      backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "var(--bg-surface-1)", border: "1px solid var(--border-default)",
        borderRadius: 18, padding: 20, maxWidth: 400, width: "100%",
        boxShadow: "var(--sh-modal)", fontFamily: FONT,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Share your streak</div>
          <button onClick={onClose} className="btn-press" style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <canvas ref={canvasRef} style={{ width: "100%", borderRadius: 12, display: "block", opacity: ready ? 1 : 0, transition: "opacity 0.2s ease" }} />
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={download} disabled={!ready} className="btn-press" style={{
            flex: 1, minHeight: 42, borderRadius: 10, border: "1px solid var(--border-default)",
            background: "transparent", color: "var(--text-secondary)", fontFamily: FONT, fontSize: 13.5,
            cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}><Download size={15} strokeWidth={1.9} /> Download</button>
          <button onClick={share} disabled={!ready} className="btn-press" style={{
            flex: 1, minHeight: 42, borderRadius: 10, border: 0,
            background: "var(--acc)", color: "var(--on-acc)",
            fontFamily: FONT, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}><Share2 size={15} strokeWidth={1.9} /> Share</button>
        </div>
      </div>
    </div>
  );
}
