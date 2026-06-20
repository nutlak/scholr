import { useState, useEffect } from "react";
import { api } from "../api.js";

const FONT = `"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
const FONT_HEADING = `"Newsreader", Georgia, "Times New Roman", serif`;
const FONT_SERIF = `"Newsreader", Georgia, "Times New Roman", serif`;

// Public, read-only notebook view (no auth, no sidebar). Viral growth surface.
export default function SharedNotebook({ slug }) {
  const [state, setState] = useState("loading"); // loading | ready | notfound
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    api.getSharedNotebook(slug)
      .then(d => { if (alive) { setData(d); setState("ready"); } })
      .catch(() => { if (alive) setState("notfound"); });
    return () => { alive = false; };
  }, [slug]);

  const page = {
    minHeight: "100vh", background: "#08080C", color: "#E8E8F0",
    fontFamily: FONT, padding: "0 20px",
  };
  const wordmark = (
    <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em", color: "#E8E8F0" }}>
      schol<span style={{ color: "#A78BFA" }}>r</span>
    </div>
  );

  if (state === "loading") {
    return (
      <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#808098", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (state === "notfound") {
    return (
      <div style={{ ...page, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 16 }}>
        {wordmark}
        <div style={{ fontFamily: FONT_HEADING, fontSize: 26, fontWeight: 700 }}>Notebook not found</div>
        <div style={{ color: "#808098", fontSize: 14, maxWidth: 360, lineHeight: 1.6 }}>
          This shared notebook doesn't exist or is no longer public.
        </div>
        <a href="https://scholr.dev" style={ctaBtn}>Go to Scholr →</a>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 80 }}>
        {/* Brand bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 0", borderBottom: "1px solid #1c1c28" }}>
          {wordmark}
          <a href="https://scholr.dev" style={{ fontSize: 12.5, color: "#808098", textDecoration: "none" }}>Powered by Scholr</a>
        </div>

        {/* Title + owner */}
        <div style={{ padding: "40px 0 28px" }}>
          <h1 style={{ fontFamily: FONT_HEADING, fontSize: "clamp(30px, 7vw, 46px)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.015em", margin: "0 0 12px" }}>
            {data.title}
          </h1>
          {data.topic && (
            <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 19, color: "#C4B5FD", marginBottom: 10 }}>{data.topic}</div>
          )}
          <div style={{ fontSize: 13.5, color: "#808098" }}>Shared by {data.ownerName}</div>
        </div>

        {/* Notes */}
        {(!data.notes || data.notes.length === 0) ? (
          <div style={{ color: "#808098", fontSize: 14, padding: "20px 0" }}>This notebook has no notes yet.</div>
        ) : (
          data.notes.map((n, i) => (
            <div key={i} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: i < data.notes.length - 1 ? "1px solid #14141c" : "none" }}>
              {n.title && (
                <h2 style={{ fontFamily: FONT_HEADING, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 12px", color: "#F5F5FA" }}>{n.title}</h2>
              )}
              {n.content
                ? <div style={{ fontSize: 15.5, lineHeight: 1.75, color: "#C0C0D8", whiteSpace: "pre-wrap" }}>{n.content}</div>
                : <div style={{ fontSize: 14, color: "#5b5b6b", fontStyle: "italic" }}>(empty)</div>}
            </div>
          ))
        )}

        {/* Viral CTA */}
        <div style={{
          marginTop: 48, padding: "32px 28px", borderRadius: 18, textAlign: "center",
          background: "linear-gradient(135deg, rgba(167,139,250,0.14), rgba(124,58,237,0.06))",
          border: "1px solid rgba(167,139,250,0.25)",
        }}>
          <div style={{ fontFamily: FONT_HEADING, fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            Like these notes?
          </div>
          <div style={{ fontSize: 14.5, color: "#A0A0B8", lineHeight: 1.6, marginBottom: 20, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
            Create your own AI-powered study notebooks, ask Derek anything, and study with your group — free on Scholr.
          </div>
          <a href="https://scholr.dev" style={ctaBtn}>Create your own on Scholr →</a>
        </div>
      </div>
    </div>
  );
}

const ctaBtn = {
  display: "inline-block",
  background: "linear-gradient(135deg, #A78BFA, #8B5CF6)",
  color: "#fff", fontWeight: 700, fontSize: 15, fontFamily: FONT,
  padding: "13px 28px", borderRadius: 12, textDecoration: "none",
  boxShadow: "0 8px 24px rgba(167,139,250,0.35)",
};
