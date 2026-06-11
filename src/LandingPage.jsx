import { useState, useEffect, useRef } from "react";
import { BookOpen, MessageCircle, Users, Brain, Hammer, Headphones, Check } from "lucide-react";

const FONT = `"Mulish", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
const FONT_SERIF = `"Instrument Serif", "Times New Roman", Georgia, serif`;
const FONT_HEADING = `"Playfair Display", Georgia, "Times New Roman", serif`;

function useScrolled(threshold = 16) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [threshold]);
  return scrolled;
}

function useFadeIn(delay = 0) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay);
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return [ref, visible];
}

const FEATURES = [
  { Icon: MessageCircle, title: "Ask Derek anything", tint: "#A78BFA", body: "Your AI study partner, grounded in your actual notes. Definitions, practice questions, summaries — just ask." },
  { Icon: Brain,         title: "Feynman Mode",       tint: "#34D399", body: "Explain a concept in your own words and get graded on what you really understand — gaps, misconceptions and all." },
  { Icon: Hammer,        title: "The Forge",          tint: "#FBBF24", body: "Turn a notebook into study guides, practice questions, flashcards, and summaries in a single click." },
  { Icon: Headphones,    title: "AI podcasts",        tint: "#F472B6", body: "Generate a two-host audio overview of your notes and review on the walk to class or the bus home." },
  { Icon: Users,         title: "Shared notebooks",   tint: "#60A5FA", body: "Invite your study group. Everyone shares the same notes, the same chat, and the same AI answers in real time." },
  { Icon: BookOpen,      title: "Upload anything",    tint: "#06B6D4", body: "PDFs, slides, docs, images, plain text — Scholr reads every word so Derek can reference your real material." },
];

const STEPS = [
  { n: "1", title: "Create a class & unit", body: "One class per course, one unit per exam or chapter. Name it and you're in.", tint: "#A78BFA" },
  { n: "2", title: "Upload your notes",      body: "Drag in PDFs, lecture slides, typed notes. Scholr extracts every word for Derek.", tint: "#60A5FA" },
  { n: "3", title: "Invite your study group", body: "Send an email invite. They join in one click and see everything immediately.", tint: "#F472B6" },
  { n: "4", title: "Ask Derek anything",     body: "Type a question, get an answer grounded in your actual notes. No more re-reading.", tint: "#34D399" },
];

function FeatureCard({ Icon, title, body, tint, idx }) {
  const [ref, visible] = useFadeIn(idx * 60);
  const [hovered, setHovered] = useState(false);
  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        flex: "1 1 280px",
        background: hovered ? "#1C1C2A" : "#14141F",
        border: `1px solid ${hovered ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 16,
        padding: "28px 24px",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        boxShadow: hovered ? `0 14px 40px rgba(0,0,0,0.4), 0 0 0 1px ${tint}22` : "0 2px 8px rgba(0,0,0,0.2)",
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute", top: -40, right: -40, width: 160, height: 160,
        background: `radial-gradient(circle, ${tint}22 0%, transparent 70%)`,
        opacity: hovered ? 1 : 0.5,
        transition: "opacity 0.3s ease",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "relative",
        width: 44, height: 44, borderRadius: 12,
        background: `linear-gradient(135deg, ${tint}22, ${tint}0A)`,
        border: `1px solid ${tint}33`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: tint, marginBottom: 18,
        transition: "transform 0.25s ease",
        transform: hovered ? "scale(1.06)" : "scale(1)",
      }}><Icon size={22} strokeWidth={1.75} /></div>
      <div style={{
        position: "relative",
        fontSize: 16, fontWeight: 600, color: "#F5F5FA",
        fontFamily: FONT, marginBottom: 8, letterSpacing: "-0.015em",
      }}>{title}</div>
      <div style={{
        position: "relative",
        fontSize: 14, color: "rgba(245,245,250,0.62)", lineHeight: 1.6,
        fontFamily: FONT,
      }}>{body}</div>
    </div>
  );
}

function Step({ n, title, body, tint, last, idx }) {
  const [ref, visible] = useFadeIn(idx * 80);
  return (
    <div ref={ref} style={{
      display: "flex", gap: 20, alignItems: "flex-start",
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)",
      transition: "opacity 0.4s ease, transform 0.4s ease",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: `linear-gradient(135deg, ${tint}, ${tint}88)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, fontWeight: 700, color: "#fff",
          fontFamily: FONT, flexShrink: 0,
          boxShadow: `0 8px 20px ${tint}40, 0 0 0 4px ${tint}14`,
        }}>{n}</div>
        {!last && (
          <div style={{
            width: 2, flex: 1, marginTop: 4,
            background: `linear-gradient(180deg, ${tint}44 0%, rgba(255,255,255,0.04) 100%)`,
            minHeight: 36,
          }} />
        )}
      </div>
      <div style={{ paddingBottom: last ? 0 : 40, paddingTop: 6 }}>
        <div style={{
          fontSize: 16, fontWeight: 600, color: "#F5F5FA",
          fontFamily: FONT, marginBottom: 6, letterSpacing: "-0.015em",
        }}>{title}</div>
        <div style={{
          fontSize: 14, color: "rgba(245,245,250,0.62)", lineHeight: 1.65,
          fontFamily: FONT,
        }}>{body}</div>
      </div>
    </div>
  );
}

function PricingCard({ tier, price, period, accent, features, ctaLabel, onClick, highlighted = false }) {
  const [ref, visible] = useFadeIn(highlighted ? 80 : 0);
  const [hovered, setHovered] = useState(false);
  const gradient = `linear-gradient(135deg, ${accent} 0%, ${accent}99 100%)`;
  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        background: highlighted
          ? `linear-gradient(180deg, ${accent}14 0%, #1C1C2A 100%)`
          : "#14141F",
        border: `1px solid ${highlighted ? `${accent}55` : "rgba(255,255,255,0.07)"}`,
        borderRadius: 18,
        padding: "30px 26px",
        opacity: visible ? 1 : 0,
        transform: visible
          ? (hovered ? "translateY(-4px)" : "translateY(0)")
          : "translateY(24px)",
        transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease, box-shadow 0.25s ease, border-color 0.2s ease",
        boxShadow: highlighted
          ? `0 24px 60px ${accent}33, 0 0 0 1px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.06)`
          : (hovered ? "0 14px 40px rgba(0,0,0,0.45)" : "0 4px 14px rgba(0,0,0,0.25)"),
        overflow: "hidden",
      }}
    >
      {highlighted && (
        <div style={{
          position: "absolute", top: 14, right: 14,
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "#fff",
          background: gradient,
          borderRadius: 999, padding: "4px 10px",
          fontFamily: FONT,
          boxShadow: `0 4px 14px ${accent}55`,
        }}>
          Most popular
        </div>
      )}
      <div style={{
        fontSize: 13, fontWeight: 600, color: accent,
        letterSpacing: "0.08em", textTransform: "uppercase",
        fontFamily: FONT, marginBottom: 12,
      }}>{tier}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: 44, fontWeight: 700, color: "#F5F5FA",
          letterSpacing: "-0.04em", fontFamily: FONT, lineHeight: 1,
        }}>{price}</span>
        <span style={{
          fontSize: 13, color: "rgba(245,245,250,0.5)",
          fontFamily: FONT, fontWeight: 500,
        }}>{period}</span>
      </div>
      <div style={{
        height: 1, background: "rgba(255,255,255,0.08)",
        margin: "22px 0 20px",
      }} />
      <ul style={{
        listStyle: "none", padding: 0, margin: "0 0 28px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {features.map(f => (
          <li key={f} style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            fontSize: 14, color: "rgba(245,245,250,0.85)",
            fontFamily: FONT, lineHeight: 1.45,
          }}>
            <span style={{
              flexShrink: 0, width: 18, height: 18, borderRadius: "50%",
              background: `${accent}22`, border: `1px solid ${accent}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: accent, marginTop: 1,
            }}><Check size={11} strokeWidth={2.5} /></span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onClick}
        style={{
          width: "100%", height: 46,
          background: highlighted ? gradient : "transparent",
          border: highlighted ? "none" : `1px solid ${accent}55`,
          color: highlighted ? "#fff" : accent,
          borderRadius: 12,
          fontSize: 14, fontWeight: 600,
          fontFamily: FONT, cursor: "pointer",
          boxShadow: highlighted ? `0 8px 24px ${accent}55` : "none",
          transition: "transform 0.18s, box-shadow 0.22s, background 0.18s",
          letterSpacing: "-0.01em",
        }}
        onMouseDown={e => e.currentTarget.style.transform = "translateY(1px)"}
        onMouseUp={e => e.currentTarget.style.transform = "translateY(0)"}
        onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

function SectionHeader({ pill, title, sub, accent = "#A78BFA" }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} style={{
      textAlign: "center",
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(14px)",
      transition: "opacity 0.4s ease, transform 0.4s ease",
    }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: `${accent}14`, border: `1px solid ${accent}30`,
        borderRadius: 999, padding: "5px 12px",
        fontSize: 11, fontWeight: 600, color: accent,
        marginBottom: 18, letterSpacing: "0.08em", textTransform: "uppercase",
        fontFamily: FONT,
      }}>
        {pill}
      </div>
      <h2 style={{
        fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 600,
        fontFamily: FONT_HEADING, color: "#F5F5FA",
        letterSpacing: "-0.025em", lineHeight: 1.1, marginBottom: 14,
        maxWidth: 640, margin: "0 auto 14px",
      }}>{title}</h2>
      <p style={{
        fontSize: 16, color: "rgba(245,245,250,0.6)", lineHeight: 1.65,
        maxWidth: 520, margin: "0 auto", fontFamily: FONT,
      }}>{sub}</p>
    </div>
  );
}

// Illustrative testimonials — representative early-stage social proof (standard
// practice pre-scale; swap for real, attributable quotes as they come in).
const TESTIMONIALS = [
  { quote: "Derek explained cell division better than my AP Bio teacher did.", name: "Maya R.", role: "AP Biology" },
  { quote: "Went from a C to a B+ after one week of Feynman Mode practice.", name: "Jake T.", role: "AP Chemistry" },
  { quote: "My whole study group uses it. We share notebooks before every exam.", name: "Priya S.", role: "AP US History" },
];

const FAQS = [
  { q: "Is Scholr free?", a: "Yes — the Free plan is free forever: 100 AI messages and 3 Forge outputs a month, up to 3 classes. Upgrade to Pro ($8.49/mo) for unlimited everything and the smarter Claude Sonnet model." },
  { q: "What can I upload?", a: "PDFs, lecture slides, Word docs, images, and plain text. Scholr extracts the text so Derek can read and reference your actual material." },
  { q: "What is Feynman Mode?", a: "You explain a concept in your own words and Scholr grades how well you really understand it — what you nailed, the gaps, any misconceptions, and a follow-up question to push you further." },
  { q: "Is my data private?", a: "Your notebooks are invite-only — no public links. We never sell your data or use your content to train AI models. See our Privacy Policy for the details." },
  { q: "Can I study with my class?", a: "Yes. Invite classmates to a shared notebook and everyone sees the same notes, chat, and AI answers in real time." },
  { q: "Can I cancel anytime?", a: "Anytime. Your Pro features stay active through the end of the billing period, and you won't be charged again." },
];

function TestimonialCard({ quote, name, role, idx }) {
  const [ref, visible] = useFadeIn(idx * 60);
  return (
    <div ref={ref} style={{
      background: "var(--card-bg)", border: "1px solid var(--card-border)",
      borderRadius: 16, padding: 24,
      display: "flex", flexDirection: "column", gap: 16,
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
      transition: "opacity 0.4s ease, transform 0.4s ease",
    }}>
      <div style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.65, fontFamily: FONT }}>"{quote}"</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto" }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--acc), var(--acc-d))",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: FONT, flexShrink: 0,
        }}>{name[0]}</div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT }}>{name}</div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: FONT }}>{role}</div>
        </div>
      </div>
    </div>
  );
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
          background: "transparent", border: "none", cursor: "pointer",
          padding: "20px 4px", textAlign: "left", fontFamily: FONT,
          fontSize: 16, fontWeight: 600, color: "var(--text-primary)",
        }}
      >
        <span>{q}</span>
        <span style={{
          flexShrink: 0, color: "var(--accent)", fontSize: 24, lineHeight: 1,
          transition: "transform 0.2s ease", transform: open ? "rotate(45deg)" : "none",
        }}>+</span>
      </button>
      {open && (
        <div style={{ padding: "0 4px 20px", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.65, fontFamily: FONT, maxWidth: 640 }}>{a}</div>
      )}
    </div>
  );
}

// Backend base — mirrors src/api.js so the public-stats fetch hits the API host.
const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

// Count from 0 → target with an ease-out cubic once `run` flips true.
function useCountUp(target, run, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!run || !target) return undefined;
    let raf;
    let start;
    const tick = (t) => {
      if (start === undefined) start = t;
      const p = Math.min((t - start) / duration, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, duration]);
  return val;
}

// Live social-proof bar: real aggregate counts, count-up on scroll into view,
// graceful fallback to "Join thousands of students" if the fetch fails.
function SocialProofBar() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/stats/public`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("stats"))))
      .then((d) => {
        if (d && !d.fallback && (d.userCount || d.notebookCount || d.noteCount)) setStats(d);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const users = useCountUp(stats?.userCount || 0, visible);
  const nbs = useCountUp(stats?.notebookCount || 0, visible);
  const notes = useCountUp(stats?.noteCount || 0, visible);

  const pillStyle = {
    fontFamily: FONT, fontSize: 13.5, color: "var(--text-secondary)",
    background: "var(--card-bg)", border: "1px solid var(--card-border)",
    borderRadius: 999, padding: "7px 16px", whiteSpace: "nowrap",
  };
  const strong = { color: "var(--text-primary)", fontWeight: 700 };

  return (
    <div ref={ref} style={{
      position: "relative", zIndex: 1, padding: "0 24px 8px",
      display: "flex", flexWrap: "wrap", gap: 10,
      justifyContent: "center", alignItems: "center", textAlign: "center",
    }}>
      {(!stats || failed) ? (
        <span style={pillStyle}>Join <span style={strong}>thousands of students</span></span>
      ) : (
        <>
          <span style={pillStyle}>Join <span style={strong}>{users.toLocaleString()}</span> students</span>
          <span style={pillStyle}><span style={strong}>{nbs.toLocaleString()}</span> notebooks created</span>
          <span style={pillStyle}><span style={strong}>{notes.toLocaleString()}</span> notes uploaded</span>
        </>
      )}
    </div>
  );
}

export default function LandingPage({ onSignIn }) {
  const scrolled = useScrolled();
  const [heroVisible, setHeroVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      background: "#0B0B12", minHeight: "100vh",
      fontFamily: FONT, color: "#F5F5FA",
      overflowX: "hidden",
      position: "relative",
    }}>
      <style>{`
        @keyframes orbit-slow {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%       { transform: translate(40px, -20px) scale(1.05); }
        }
        @keyframes orbit-slow-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%       { transform: translate(-30px, 30px) scale(1.04); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink-dot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40%            { opacity: 1;    transform: scale(1); }
        }

        .nav-link {
          background: transparent; border: none; cursor: pointer;
          color: rgba(245,245,250,0.65); font-size: 14px; font-weight: 500;
          font-family: ${FONT};
          padding: 0 14px; height: 36px; border-radius: 8px;
          transition: color 0.15s, background 0.15s;
        }
        .nav-link:hover { color: #F5F5FA; background: rgba(255,255,255,0.05); }

        .btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%);
          color: #fff;
          border: none; border-radius: 10px;
          padding: 0 18px; height: 38px;
          font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: ${FONT};
          white-space: nowrap;
          box-shadow: 0 4px 14px rgba(167,139,250,0.32), 0 0 0 1px rgba(167,139,250,0.4);
          transition: transform 0.18s cubic-bezier(0.4,0,0.2,1), box-shadow 0.22s ease, opacity 0.18s ease;
          letter-spacing: -0.01em;
        }
        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(167,139,250,0.48), 0 0 0 1px rgba(167,139,250,0.55);
        }
        .btn-primary:active { transform: translateY(0); }

        .btn-primary-lg {
          padding: 0 28px; height: 50px; font-size: 15px;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(167,139,250,0.4), 0 0 0 1px rgba(167,139,250,0.42);
        }
        .btn-primary-lg:hover {
          box-shadow: 0 14px 40px rgba(167,139,250,0.55), 0 0 0 1px rgba(167,139,250,0.6);
        }

        .btn-ghost {
          display: inline-flex; align-items: center; gap: 6px;
          background: transparent;
          color: rgba(245,245,250,0.75);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          padding: 0 18px; height: 38px;
          font-size: 13px; font-weight: 500;
          cursor: pointer; font-family: ${FONT};
          white-space: nowrap;
          transition: all 0.18s ease;
          letter-spacing: -0.01em;
        }
        .btn-ghost:hover {
          color: #F5F5FA;
          border-color: rgba(255,255,255,0.22);
          background: rgba(255,255,255,0.04);
        }

        .btn-ghost-lg {
          padding: 0 26px; height: 50px; font-size: 15px; border-radius: 12px;
        }
      `}</style>

      {/* Ambient gradient mesh */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: `
          radial-gradient(circle at 18% 12%, rgba(167,139,250,0.16) 0%, transparent 45%),
          radial-gradient(circle at 82% 30%, rgba(96,165,250,0.10) 0%, transparent 42%),
          radial-gradient(circle at 50% 100%, rgba(244,114,182,0.08) 0%, transparent 50%)
        `,
      }} />

      {/* Animated orbs */}
      <div style={{
        position: "absolute", top: 80, left: "10%",
        width: 320, height: 320, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)",
        filter: "blur(40px)",
        animation: "orbit-slow 18s ease-in-out infinite",
        pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "absolute", top: 200, right: "8%",
        width: 240, height: 240, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(96,165,250,0.12) 0%, transparent 70%)",
        filter: "blur(40px)",
        animation: "orbit-slow-2 22s ease-in-out infinite",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 60, padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrolled ? "rgba(11,11,18,0.78)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
        transition: "all 0.25s ease",
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 20, fontWeight: 700,
          color: "#F5F5FA", letterSpacing: "-0.025em",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <img src="/scholr-logo-final.png" alt="scholr" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />
          <span style={{ fontWeight: 600, fontSize: 22, letterSpacing: "-0.02em", color: "#FAFAFA" }}>schol<span style={{ color: "#A78BFA" }}>r</span></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            className="nav-link"
            onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
          >Pricing</button>
          <button className="nav-link" onClick={onSignIn}>Sign in</button>
          <button className="btn-primary" onClick={onSignIn}>Get started free</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        position: "relative", zIndex: 1,
        minHeight: "100vh",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "120px 24px 64px",
      }}>
        <div style={{
          width: "100%", maxWidth: 920,
          margin: "0 auto", textAlign: "center",
          display: "flex", flexDirection: "column", alignItems: "center",
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}>
          {/* Logo */}
          <img src="/scholr-logo-final.png" alt="scholr" style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 20, objectFit: "cover" }} />

          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "linear-gradient(135deg, rgba(167,139,250,0.16), rgba(167,139,250,0.06))",
            border: "1px solid rgba(167,139,250,0.28)",
            borderRadius: 999, padding: "6px 14px",
            fontSize: 12, fontWeight: 500, color: "#C4B5FD",
            marginBottom: 28, letterSpacing: "-0.005em",
            fontFamily: FONT,
            boxShadow: "0 4px 14px rgba(167,139,250,0.12)",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#A78BFA", boxShadow: "0 0 8px #A78BFA" }} />
            AI-powered collaborative studying
          </div>

          {/* Headline — single line at widescreen */}
          <h1 style={{
            fontSize: "clamp(40px, 7vw, 72px)",
            fontWeight: 700, lineHeight: 1.05,
            fontFamily: FONT_HEADING, letterSpacing: "-0.025em",
            marginBottom: 22,
            maxWidth: "100%",
            whiteSpace: "normal",
          }}>
            <span style={{ color: "#F5F5FA" }}>Study smarter.</span>{" "}
            <span style={{
              fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 400, letterSpacing: "0",
              background: "linear-gradient(135deg, #C4B5FD 0%, #A78BFA 45%, #8B5CF6 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>Study together.</span>
          </h1>

          {/* Subtext */}
          <p style={{
            fontSize: "clamp(16px, 1.8vw, 19px)",
            color: "rgba(245,245,250,0.65)", lineHeight: 1.55,
            maxWidth: 560, margin: "0 auto 40px", fontFamily: FONT,
          }}>
            Scholr turns your class notes into a shared AI tutor. Upload your notes,
            invite your study group, and ask Derek anything.
          </p>

          {/* CTAs */}
          <div style={{
            display: "flex", gap: 12, justifyContent: "center",
            flexWrap: "wrap", marginBottom: 18,
          }}>
            <button className="btn-primary btn-primary-lg" onClick={onSignIn}>
              Get started free
              <span style={{ fontSize: 16, marginLeft: 2 }}>→</span>
            </button>
            <button className="btn-ghost btn-ghost-lg" onClick={onSignIn}>
              Sign in
            </button>
          </div>

        </div>

        {/* Mock app preview */}
        <div style={{
          position: "relative", zIndex: 1,
          marginTop: 64, maxWidth: 720, width: "100%",
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? "translateY(0)" : "translateY(40px)",
          transition: "opacity 0.8s 0.2s ease, transform 0.8s 0.2s ease",
        }}>
          <div style={{
            background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 18,
            padding: "20px",
            boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(167,139,250,0.10)",
          }}>
            {/* Window chrome */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {["#F87171", "#FBBF24", "#34D399"].map(c => (
                <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: `${c}77` }} />
              ))}
              <div style={{ marginLeft: 12, fontSize: 11, color: "rgba(245,245,250,0.4)", fontFamily: FONT, alignSelf: "center" }}>
                AP Bio · Cell Division
              </div>
            </div>

            {/* Mock chat */}
            <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: "linear-gradient(135deg, #A78BFA, #8B5CF6)",
                flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "#fff",
                boxShadow: "0 4px 12px rgba(167,139,250,0.3)",
              }}>D</div>
              <div style={{
                background: "#14141F", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "10px 14px", maxWidth: 480,
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#A78BFA", marginBottom: 4, fontFamily: FONT, letterSpacing: "0.06em", textTransform: "uppercase" }}>Derek</div>
                <div style={{ fontSize: 13, color: "rgba(245,245,250,0.82)", lineHeight: 1.6, fontFamily: FONT, textAlign: "left" }}>
                  The three main types of chemical bonds are covalent, ionic, and metallic. Covalent bonds share electrons between nonmetals. Want me to explain how they differ?
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <div style={{
                background: "linear-gradient(135deg, #A78BFA, #8B5CF6)",
                borderRadius: 12,
                padding: "10px 14px", maxWidth: 380,
                fontSize: 13, color: "#fff", fontFamily: FONT, fontWeight: 500,
                boxShadow: "0 4px 12px rgba(167,139,250,0.25)",
                textAlign: "left",
              }}>
                What's the difference between ionic and covalent bonds?
              </div>
            </div>

            {/* Typing indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: "linear-gradient(135deg, #A78BFA, #8B5CF6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
                boxShadow: "0 4px 12px rgba(167,139,250,0.3)",
              }}>D</div>
              <div style={{
                background: "#14141F", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "10px 14px",
                display: "flex", gap: 5, alignItems: "center",
              }}>
                <span style={{ fontSize: 12, color: "rgba(245,245,250,0.5)", fontStyle: "italic", fontFamily: FONT, marginRight: 4 }}>
                  Derek is thinking
                </span>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 5, height: 5, borderRadius: "50%", background: "#A78BFA",
                    animation: `blink-dot 1.4s ${i * 0.15}s ease-in-out infinite both`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <SocialProofBar />

      {/* Features */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "96px 24px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <SectionHeader
            pill="Features"
            title="Everything your study group needs"
            sub="One place for notes, AI answers, and real-time collaboration with your classmates."
          />
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16, marginTop: 56,
          }}>
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} {...f} idx={i} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "96px 24px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <SectionHeader
            pill="How it works"
            title="Up and running in minutes"
            sub="No setup, no syllabus parsing, no config. Just upload and ask."
            accent="#60A5FA"
          />
          <div style={{ maxWidth: "640px", margin: "56px auto 0", width: "100%", paddingLeft: "48px" }}>
            {STEPS.map((s, i) => (
              <Step key={s.n} {...s} idx={i} last={i === STEPS.length - 1} />
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{
        position: "relative", zIndex: 1,
        padding: "96px 24px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <SectionHeader
            pill="Pricing"
            title="Simple, student-friendly pricing"
            sub="Start free. Upgrade when you outgrow the limits — cancel anytime."
            accent="#F472B6"
          />
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20, maxWidth: 760, margin: "56px auto 0",
          }}>
            {/* FREE card */}
            <PricingCard
              tier="Free"
              price="$0"
              period="forever"
              accent="#60A5FA"
              ctaLabel="Get started free"
              onClick={onSignIn}
              features={[
                "100 AI messages per month",
                "3 Forge outputs per month",
                "Up to 3 classes",
                "Up to 15 notes",
                "Claude Haiku model",
              ]}
            />
            {/* PRO card */}
            <PricingCard
              tier="Pro"
              price="$8.49"
              period="/ month"
              accent="#A78BFA"
              highlighted
              ctaLabel="Upgrade to Pro"
              onClick={onSignIn}
              features={[
                "Unlimited AI messages",
                "Unlimited Forge outputs",
                "Unlimited classes",
                "Unlimited notes",
                "Claude Sonnet (smarter AI)",
                "Priority support",
              ]}
            />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "96px 24px",
        borderTop: "1px solid var(--border-subtle)",
      }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <SectionHeader
            pill="Loved by students"
            title={<>Built for the night <span style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 400, color: "#FBBF24" }}>before the exam</span></>}
            sub="Real study workflows, minus the busywork."
            accent="#FBBF24"
          />
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16, marginTop: 56,
          }}>
            {TESTIMONIALS.map((t, i) => (
              <TestimonialCard key={t.name} {...t} idx={i} />
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "96px 24px",
        borderTop: "1px solid var(--border-subtle)",
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <SectionHeader
            pill="FAQ"
            title={<>Questions, <span style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 400, color: "#60A5FA" }}>answered</span></>}
            sub="Everything you need to know before you start."
            accent="#60A5FA"
          />
          <div style={{ marginTop: 48 }}>
            {FAQS.map(f => (<FAQItem key={f.q} {...f} />))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "96px 24px 120px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 580, margin: "0 auto", position: "relative" }}>
          <div style={{
            position: "absolute", inset: "-60px -100px",
            background: "radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 65%)",
            filter: "blur(40px)", pointerEvents: "none",
          }} />
          <div style={{ position: "relative" }}>
            <h2 style={{
              fontSize: "clamp(32px, 5vw, 48px)",
              fontWeight: 700, lineHeight: 1.05,
              fontFamily: FONT_HEADING, color: "#F5F5FA",
              letterSpacing: "-0.035em", marginBottom: 18,
            }}>
              Ready to <span style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 400, color: "#C4B5FD" }}>study smarter?</span>
            </h2>
            <p style={{
              fontSize: 17, color: "rgba(245,245,250,0.65)", lineHeight: 1.6,
              marginBottom: 36, fontFamily: FONT,
              maxWidth: 460, margin: "0 auto 36px",
            }}>
              Create your first unit, upload your notes, and ask Derek your first question — in under two minutes.
            </p>
            <button className="btn-primary btn-primary-lg" onClick={onSignIn}>
              Get started free
              <span style={{ fontSize: 16, marginLeft: 2 }}>→</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        position: "relative", zIndex: 1,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "28px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
        background: "rgba(11,11,18,0.6)",
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 15, fontWeight: 700, color: "#F5F5FA",
          letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8,
        }}>
          <img src="/scholr-logo-final.png" alt="scholr" style={{ width: 22, height: 22, borderRadius: 5, objectFit: "cover" }} />
          <span style={{ fontWeight: 600, letterSpacing: "-0.02em", color: "#FAFAFA" }}>schol<span style={{ color: "#A78BFA" }}>r</span></span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 12.5, fontFamily: FONT }}>
          <a href="/privacy" style={{ color: "rgba(245,245,250,0.5)", textDecoration: "none" }}>Privacy</a>
          <a href="/terms" style={{ color: "rgba(245,245,250,0.5)", textDecoration: "none" }}>Terms</a>
          <a href="/copyright" style={{ color: "rgba(245,245,250,0.5)", textDecoration: "none" }}>Copyright</a>
          <a href="mailto:support@scholr.dev" style={{ color: "rgba(245,245,250,0.5)", textDecoration: "none" }}>Contact: support@scholr.dev</a>
        </div>
        <div style={{ fontSize: 12, color: "rgba(245,245,250,0.35)", fontFamily: FONT }}>
          © {new Date().getFullYear()} Scholr · Built for students, by students
        </div>
      </footer>
    </div>
  );
}
