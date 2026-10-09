import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { useInstall } from "./lib/install.js";
import { BookOpen, MessageCircle, Users, Brain, Hammer, Headphones, Check, Radio, Flame, Download, Orbit } from "lucide-react";
import { FONT, FONT_HEADING, FONT_SERIF, MONO } from "./lib/theme.js";

const ElectricLogo = lazy(() => import("./ui/fx/ElectricLogo.jsx"));
const REDUCED_MOTION = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const staticLogo = (
  <img src="/scholr-logo-final.png" alt="scholr"
    style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover", position: "relative", zIndex: 1 }} />
);

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

const PLANS = ["free", "pro", "squad"];

const FEATURES = [
  { Icon: Radio,         title: "Study together, live", tint: "#34D399", body: "See which friends are studying right now and jump into their notebook, with the same notes and the same chat. Start a live quiz battle when you want review to be a competition." },
  { Icon: Flame,         title: "Friends streak leaderboard", tint: "#FB923C", short: "Your streak vs. your friends", body: "Your study streak, ranked against your friends. A quiet nudge that keeps you both showing up." },
  { Icon: MessageCircle, title: "Ask Derek anything", tint: "#A78BFA", short: "An AI tutor that reads your notes", body: "Your AI study partner, grounded in your actual notes. Ask it for definitions, practice questions, or summaries." },
  { Icon: Orbit,         title: "The unit brain",     tint: "#A78BFA", short: "See what you know at a glance", body: "Every key idea in a unit, mapped around a crystal ball and colored by how well you know it. Explain one in Feynman Mode and watch it turn green, or see which friend already has it down." },
  { Icon: Brain,         title: "Feynman Mode",       tint: "#4ADE80", short: "Explain it, get graded", body: "Explain a concept in your own words and get graded on what you understand, including the gaps and misconceptions." },
  { Icon: Hammer,        title: "Study guides in a tap", tint: "#FBBF24", short: "Guides, quizzes, worksheets", body: "Turn a notebook into study guides, practice questions, worksheets with real plotted graphs, flashcards, and summaries in a single click." },
  { Icon: Headphones,    title: "AI podcasts",        tint: "#F472B6", short: "Your notes as a two-host show", body: "Generate a two-host audio overview of your notes and listen on the walk to class. Merge in a friend's notebook to get an episode that covers both." },
  { Icon: Users,         title: "Join your class with a PIN", tint: "#60A5FA", short: "One PIN, the whole class", body: "Paste one link in your class group chat, or read out a six-character PIN. Classmates get every unit in the class, with the same sources and the same AI answers, and you're friends straight away." },
  { Icon: BookOpen,      title: "Upload anything",    tint: "#06B6D4", short: "PDFs, slides, photos, docs", body: "Upload PDFs, slides, docs, images, or plain text. Scholr reads every word so Derek can reference your real material." },
];

const STEPS = [
  { n: "1", title: "Create a class & unit", body: "One class per course, one unit per exam or chapter. Or upload a syllabus to a new or existing class and Derek sets up the units for you.", tint: "#A78BFA" },
  { n: "2", title: "Add your sources",       body: "Drag in PDFs, lecture slides, or typed notes. Scholr reads every word for Derek.", tint: "#60A5FA" },
  { n: "3", title: "Share your class PIN", body: "Drop the link in your group chat. Classmates tap it, or type the PIN, and land in every unit.", tint: "#F472B6" },
  { n: "4", title: "Ask Derek anything",     body: "Type a question, get an answer grounded in your actual notes. No more re-reading.", tint: "#34D399" },
];

function FeatureCard({ Icon, title, body, short, tint, idx }) {
  const [ref, visible] = useFadeIn(idx * 60);
  const [hovered, setHovered] = useState(false);
  return (
    <div
      ref={ref}
      className={`lp-feature${short ? "" : " lp-feature-hero"}`}
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
      <div className="lp-feat-icon" style={{
        position: "relative",
        width: 44, height: 44, borderRadius: 12,
        background: `linear-gradient(135deg, ${tint}22, ${tint}0A)`,
        border: `1px solid ${tint}33`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: tint, marginBottom: 18,
        transition: "transform 0.25s ease",
        transform: hovered ? "scale(1.06)" : "scale(1)",
      }}><Icon size={22} strokeWidth={1.75} /></div>
      <div className="lp-feat-title" style={{
        position: "relative",
        fontSize: 16, fontWeight: 600, color: "#F5F5FA",
        fontFamily: FONT, marginBottom: 8, letterSpacing: "-0.015em",
      }}>{title}</div>
      <div className="lp-feat-body" style={{
        position: "relative",
        fontSize: 14, color: "rgba(245,245,250,0.62)", lineHeight: 1.6,
        fontFamily: FONT,
      }}>{body}</div>
      {short && <div className="lp-feat-short">{short}</div>}
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
        // Mono, tracked out, small. The label type of a technical page rather
        // than a marketing one — the thing that reads as precision in the
        // reference site's nav and section marks.
        fontSize: 11, fontWeight: 600, color: accent,
        marginBottom: 18, letterSpacing: "0.14em", textTransform: "uppercase",
        fontFamily: MONO,
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

// These were three invented students with names, courses and a specific
// grade-improvement claim ("went from a C to a B+"), labelled in a comment as
// "illustrative... standard practice pre-scale". They are not standard
// practice: the FTC's Rule on Consumer Reviews and Testimonials prohibits
// fabricated endorsements outright and carries civil penalties, and an
// unsubstantiated outcome claim is its own violation on top. On a paid product
// aimed at minors, with nine real accounts at the time of writing, it was the
// single largest piece of legal exposure on the site.
//
// Replaced with what the product actually does, in the moment it gets used. No
// invented people, no outcome claims, nothing that needs substantiating —
// every one of these describes a feature that exists and can be checked. When
// real, attributable quotes come in, they can go back in this shape.
const USE_CASES = [
  {
    when: "It's 11pm and the test is tomorrow",
    what: "Upload the lecture slides and ask Derek what you're still shaky on. Answers come from your own notes, not from the internet's version of the topic.",
  },
  {
    when: "The group chat is the study group",
    what: "Share one notebook. Everyone gets the same notes and the same answers, and can see who's actually studying right now.",
  },
  {
    when: "You think you understand it",
    what: "Explain it in your own words in Feynman Mode and find out where the gaps are before the exam does.",
  },
];

const FAQS = [
  { q: "Is Scholr free?", a: "Yes. The Free plan is free forever: 100 AI messages and 3 AI generations (guides, quizzes, worksheets, brains) a month, up to 3 classes. Upgrade to Pro ($8.49/mo) for unlimited everything and the smarter Claude Sonnet model." },
  { q: "What can I upload?", a: "PDFs, lecture slides, Word docs, images, and plain text. Scholr extracts the text so Derek can read and reference your actual material." },
  { q: "What is Feynman Mode?", a: "You explain a concept in your own words and Scholr grades how well you understand it: what you nailed, the gaps, any misconceptions, and a follow-up question to push you further." },
  { q: "Is my data private?", a: "Your notebooks are invite-only, with no public links. We never sell your data or use your content to train AI models. See our Privacy Policy for the details." },
  { q: "Can I study with my class?", a: "Yes. Open a class, tap Invite, and share the PIN or link. Everyone who joins sees the same units, sources, chat, and AI answers in real time, and becomes your friend on Scholr." },
  { q: "Can I cancel anytime?", a: "Anytime. Your Pro features stay active through the end of the billing period, and you won't be charged again." },
  { q: "Can I get Scholr on my phone?", a: "Yes. Install it to your home screen and it opens like any other app, full screen, with its own icon. On Android and desktop Chrome, tap Install Scholr. On iPhone, tap Share in Safari and then Add to Home Screen. Notifications work once it is installed." },
];

function UseCaseCard({ when, what, idx }) {
  const [ref, visible] = useFadeIn(idx * 60);
  return (
    <div ref={ref} style={{
      background: "var(--card-bg)", border: "1px solid var(--card-border)",
      borderRadius: 16, padding: 24,
      display: "flex", flexDirection: "column", gap: 10,
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
      transition: "opacity 0.4s ease, transform 0.4s ease",
    }}>
      <div style={{
        fontSize: 16, fontWeight: 600, color: "var(--text-primary)",
        fontFamily: FONT_SERIF, letterSpacing: "-0.01em", lineHeight: 1.3,
      }}>{when}</div>
      <div style={{ fontSize: 14.5, color: "var(--text-secondary)", lineHeight: 1.6, fontFamily: FONT }}>{what}</div>
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
// hidden until the counts are big enough to be worth bragging about (and on fetch failure).
const SOCIAL_PROOF_MIN_USERS = 100;
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
      {(!stats || failed || stats.userCount < SOCIAL_PROOF_MIN_USERS) ? null : (
        <>
          <span style={pillStyle}>Join <span style={strong}>{users.toLocaleString()}</span> students</span>
          <span style={pillStyle}><span style={strong}>{nbs.toLocaleString()}</span> notebooks created</span>
          <span style={pillStyle}><span style={strong}>{notes.toLocaleString()}</span> notes uploaded</span>
        </>
      )}
    </div>
  );
}

export default function LandingPage({ onSignIn, invited = false }) {
  const scrolled = useScrolled();
  const [heroVisible, setHeroVisible] = useState(false);
  const [plan, setPlan] = useState("pro");
  const { installed, canPrompt, needsIOSInstructions, install } = useInstall();
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    // The marketing page is designed dark and says so in hardcoded colours —
    // #0B0B12 behind #F5F5FA text. It also reads a dozen tokens, and those flip
    // in light theme while the hardcoded half does not, which put near-white
    // text on near-white cards: 19 elements below 3:1, some at 1.12. Reachable
    // by setting light in Settings and signing out.
    //
    // Pinning the tokens it uses to their dark values here keeps the page
    // self-consistent in either theme, without forcing the whole document to
    // dark and flipping the theme under someone who chose light.
    <div data-hud-void className="landing-root" style={{
      background: "#0B0B12", minHeight: "100vh",
      fontFamily: FONT, color: "#F5F5FA",
      overflowX: "hidden",
      position: "relative",
      "--text-primary": "#F0EDE7",
      "--text-secondary": "rgba(240,237,231,0.76)",
      "--text-tertiary": "rgba(240,237,231,0.56)",
      "--t1": "#F0EDE7",
      "--t2": "rgba(240,237,231,0.76)",
      "--border-subtle": "rgba(240,237,231,0.07)",
      "--border-default": "rgba(240,237,231,0.12)",
      "--card-bg": "#151517",
      "--card-border": "rgba(240,237,231,0.09)",
      "--bubble-in": "#1A181E",
      "--acc": "#A78BFA",
      "--acc-h": "#C4B5FD",
      "--on-acc": "#14121A",
    }}>
      <style>{`
        /* Phone layout: hierarchy instead of a column of equal cards. */
        .lp-feat-short { display: none; }
        .lp-plan-tabs { display: none; }
        @media (max-width: 699px) {
          .lp-section { padding: 60px 16px !important; }
          .lp-features { grid-template-columns: 1fr 1fr !important; gap: 10px !important; margin-top: 32px !important; }
          .lp-feature { padding: 16px 14px !important; border-radius: 14px !important; }
          .lp-feature-hero { grid-column: 1 / -1; padding: 22px 18px !important; }
          .lp-feature:not(.lp-feature-hero) .lp-feat-icon { width: 38px !important; height: 38px !important; margin-bottom: 12px !important; }
          .lp-feature:not(.lp-feature-hero) .lp-feat-title { font-size: 15px !important; margin-bottom: 4px !important; }
          .lp-feature:not(.lp-feature-hero) .lp-feat-body { display: none; }
          .lp-feat-short { display: block; position: relative; font-size: 13.5px; line-height: 1.45; color: rgba(245,245,250,0.62); }
          .lp-steps { padding-left: 0 !important; margin-top: 32px !important; }
          .lp-plan-tabs { display: grid; max-width: 360px; margin: 28px auto 0; --seg-r: 12px; --seg-pad: 3px; }
          .lp-plan-tabs .seg-option { min-height: 40px; font-size: 14px; }
          .lp-pricing { margin-top: 16px !important; }
          .lp-pricing[data-show="free"] > :not([data-plan="free"]),
          .lp-pricing[data-show="pro"] > :not([data-plan="pro"]),
          .lp-pricing[data-show="squad"] > :not([data-plan="squad"]) { display: none; }
          .lp-scroller {
            display: flex !important; overflow-x: auto; scroll-snap-type: x mandatory;
            margin: 32px -16px 0 !important; padding: 0 16px 4px; scrollbar-width: none;
          }
          .lp-scroller::-webkit-scrollbar { display: none; }
          .lp-scroller > * { flex: 0 0 84%; scroll-snap-align: center; }
        }
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
        /* The bar holds the wordmark, two links and the CTA. At 390px that is
           about 3px too wide and "Sign in" breaks across two lines, which is
           what it did in the iOS app. Pricing is the one that can go: the
           section it scrolls to is still right there on the page. */
        .nav-link, .btn-primary { white-space: nowrap; }

        .install-cta {
          display: inline-flex; align-items: center; gap: 8px;
          min-height: 44px; padding: 0 16px; border-radius: 10px;
          background: transparent; color: rgba(245,245,250,0.72);
          border: 1px solid rgba(255,255,255,0.14);
          font-family: ${FONT}; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: color 0.15s, border-color 0.15s, background 0.15s;
        }
        .install-cta:hover {
          color: #F5F5FA; border-color: rgba(167,139,250,0.5);
          background: rgba(167,139,250,0.08);
        }
        @media (max-width: 480px) {
          .nav-link-pricing { display: none; }
        }

        .btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--acc);
          color: var(--on-acc);
          border: none; border-radius: 10px;
          padding: 0 18px; height: 38px;
          font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: ${FONT};
          white-space: nowrap;
          transition: transform 0.18s cubic-bezier(0.4,0,0.2,1), background 0.18s ease, opacity 0.18s ease;
          letter-spacing: -0.01em;
        }
        .btn-primary:hover {
          transform: translateY(-1px);
          background: var(--acc-h);
        }
        .btn-primary:active { transform: translateY(0); }

        .btn-primary-lg {
          padding: 0 28px; height: 50px; font-size: 15px;
          border-radius: 12px;
          box-shadow: none;
        }
        .btn-primary-lg:hover {
          background: var(--acc-h);
        }

        .btn-ghost {
          display: inline-flex; align-items: center; gap: 6px;
          background: transparent;
          color: var(--t2);
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
          color: var(--t1);
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
        /* A measured field rather than a haze. One violet wash for depth, and a
           fine grid that fades out before it reaches the copy — the grid is
           what reads as technical; a coloured fog just reads as a gradient.
           40px cells, hairline, masked to the top third so nothing sits behind
           body text. */
        background: `
          radial-gradient(circle at 50% 0%, rgba(167,139,250,0.07) 0%, transparent 55%),
          linear-gradient(to right, rgba(240,237,231,0.035) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(240,237,231,0.035) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 40px 40px, 40px 40px",
        maskImage: "linear-gradient(to bottom, #000 0%, #000 38%, transparent 72%)",
        WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 38%, transparent 72%)",
      }} />

      {/* Two blurred violet orbs used to drift here on 18s and 22s loops.
          Drifting blobs are the single most recognisable "generated landing
          page" signature there is, and they were animating behind body copy. */}

      {/* Nav */}
      {/* The insets matter in the iOS app, where viewport-fit=cover puts this
          bar under the status bar and the Dynamic Island — without them the
          logo and "Sign in" sit behind the clock and the battery. They resolve
          to 0 in a browser, so the web nav is unchanged. */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: "calc(60px + env(safe-area-inset-top))",
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "max(24px, env(safe-area-inset-left))",
        paddingRight: "max(24px, env(safe-area-inset-right))",
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
            className="nav-link nav-link-pricing"
            onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
          >Pricing</button>
          <button className="nav-link" onClick={() => onSignIn("login")}>Sign in</button>
          <button className="btn-primary" onClick={onSignIn}>Get started free</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        position: "relative", zIndex: 1,
        minHeight: "100vh",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        textAlign: "center",
        padding: "calc(120px + env(safe-area-inset-top)) 24px 64px",
      }}>
        <div style={{
          width: "100%", maxWidth: 920,
          margin: "0 auto", textAlign: "center",
          display: "flex", flexDirection: "column", alignItems: "center",
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}>
          {/* The scholr mark traced in live electricity (React Bits'
              ElectricLogo). It's WebGL, so it loads after first paint as its
              own chunk, with the plain logo standing in until it arrives —
              and staying put for anyone who has asked for reduced motion. */}
          <div style={{
            position: "relative", display: "flex",
            alignItems: "center", justifyContent: "center",
            width: 300, height: 300, marginBottom: -24, marginTop: -60,
          }}>
            {REDUCED_MOTION ? staticLogo : (
              <Suspense fallback={staticLogo}>
                <ElectricLogo src="/scholr-logo-final.png" color="#E9DDFF" glowColor="#A78BFA"
                  scale={0.62} intensity={0.9} strands={3} speed={1.6} cursorRadius={80}
                  style={{ position: "absolute", inset: 0 }} />
              </Suspense>
            )}
          </div>

          {invited && (
            <button onClick={() => onSignIn()} className="btn-primary" style={{ marginBottom: 18 }}>
              You've been invited to a class. Sign up free to join →
            </button>
          )}

          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "var(--acc-bg)",
            border: "1px solid color-mix(in srgb, var(--acc) 26%, transparent)",
            borderRadius: 999, padding: "6px 14px",
            fontSize: 11, fontWeight: 600, color: "#C4B5FD",
            fontFamily: MONO, textTransform: "uppercase",
            marginBottom: 28, letterSpacing: "0.14em",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#A78BFA", boxShadow: "0 0 8px #A78BFA" }} />
            AI-powered collaborative studying
          </div>

          {/* Headline — single line at widescreen */}
          <h1 style={{
            fontSize: "clamp(40px, 7vw, 72px)",
            fontWeight: 700, lineHeight: "var(--lh-display)",
            fontFamily: FONT_HEADING, letterSpacing: "var(--tr-display)",
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
            <button className="btn-ghost btn-ghost-lg" onClick={() => onSignIn("login")}>
              Sign in
            </button>
          </div>

          {/* Install to the home screen. Chrome can do it in one tap; iOS has
              no API for it and never has, so there it is an instruction rather
              than a button that would do nothing. Hidden entirely once scholr
              is already running installed. */}
          {!installed && (canPrompt || needsIOSInstructions) && (
            <div style={{ marginBottom: 18 }}>
              <button
                className="install-cta"
                onClick={() => (canPrompt ? install() : setShowIOSHelp(v => !v))}
              >
                <Download size={15} strokeWidth={1.9} />
                {canPrompt ? "Install scholr" : "Add scholr to your home screen"}
              </button>
              {showIOSHelp && (
                <div style={{
                  marginTop: 10, fontSize: 13, lineHeight: 1.6,
                  color: "rgba(245,245,250,0.6)", fontFamily: FONT,
                }}>
                  Tap the Share button in Safari, then <strong style={{ color: "rgba(245,245,250,0.85)" }}>Add to Home Screen</strong>.
                </div>
              )}
            </div>
          )}

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
                boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
              }}>D</div>
              <div className="chat-bubble chat-in" style={{
                background: "var(--bubble-in)", border: "1px solid var(--border-default)",
                borderRadius: 18, padding: "11px 15px", maxWidth: 480,
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#A78BFA", marginBottom: 4, fontFamily: FONT, letterSpacing: "0.06em", textTransform: "uppercase" }}>Derek</div>
                <div style={{ fontSize: 13, color: "rgba(245,245,250,0.82)", lineHeight: 1.6, fontFamily: FONT, textAlign: "left" }}>
                  The three main types of chemical bonds are covalent, ionic, and metallic. Covalent bonds share electrons between nonmetals. Want me to explain how they differ?
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <div className="chat-bubble chat-own" style={{
                background: "var(--acc)",
                borderRadius: 18,
                padding: "11px 15px", maxWidth: 380,
                fontSize: 13, color: "var(--on-acc)", fontFamily: FONT, fontWeight: 500,
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
                boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
              }}>D</div>
              <div className="chat-bubble chat-in" style={{
                background: "var(--bubble-in)", border: "1px solid var(--border-default)",
                borderRadius: 18, padding: "11px 15px",
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
      <section className="lp-section" style={{
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
          <div className="lp-features" style={{
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
      <section className="lp-section" style={{
        position: "relative", zIndex: 1,
        padding: "96px 24px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <SectionHeader
            pill="How it works"
            title="Up and running in minutes"
            sub="Upload your notes and start asking. Derek can build your units from a syllabus."
            accent="#60A5FA"
          />
          <div className="lp-steps" style={{ maxWidth: "640px", margin: "56px auto 0", width: "100%", paddingLeft: "48px" }}>
            {STEPS.map((s, i) => (
              <Step key={s.n} {...s} idx={i} last={i === STEPS.length - 1} />
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="lp-section" style={{
        position: "relative", zIndex: 1,
        padding: "96px 24px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <SectionHeader
            pill="Pricing"
            title="Simple, student-friendly pricing"
            sub="Start free. Upgrade when you outgrow the limits, and cancel anytime."
            accent="#F472B6"
          />
          {/* Phone: one plan at a time (Pro first) instead of three cards
              stacked 1,650px deep. Desktop shows all three side by side. */}
          <div className="seg-control lp-plan-tabs" role="radiogroup" aria-label="Plan" style={{ "--seg-n": 3 }}>
            <span className="seg-pill" aria-hidden="true" style={{ transform: `translateX(${PLANS.indexOf(plan) * 100}%)` }} />
            {PLANS.map(p => (
              <button key={p} className="seg-option" role="radio" aria-checked={plan === p} onClick={() => setPlan(p)}>
                {p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <div className="lp-pricing" data-show={plan} style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20, maxWidth: 980, margin: "56px auto 0",
          }}>
            {/* FREE card */}
            <div data-plan="free">
            <PricingCard
              tier="Free"
              price="$0"
              period="forever"
              accent="#60A5FA"
              ctaLabel="Get started free"
              onClick={onSignIn}
              features={[
                "100 AI messages per month",
                "3 AI generations per month",
                "Up to 3 classes",
                "Up to 3 notebooks",
                "Claude Haiku model",
              ]}
            />
            </div>
            {/* PRO card */}
            <div data-plan="pro">
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
                "Unlimited AI generations",
                "Unlimited classes",
                "Unlimited notes",
                "Claude Sonnet (smarter AI)",
                "Priority support",
              ]}
            />
            </div>
            {/* SQUAD card */}
            <div data-plan="squad">
            <PricingCard
              tier="Squad"
              price="$24.99"
              period="/ month"
              accent="#34D399"
              ctaLabel="Start a squad"
              onClick={onSignIn}
              features={[
                "Everything in Pro",
                "Pro for up to 5 people",
                "One bill for the whole group",
                "Invite your study group instantly",
              ]}
            />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="lp-section" style={{
        position: "relative", zIndex: 1,
        padding: "96px 24px",
        borderTop: "1px solid var(--border-subtle)",
      }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <SectionHeader
            pill="How it gets used"
            title={<>Built for the night <span style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 400, color: "#FBBF24" }}>before the exam</span></>}
            sub="Real study workflows, minus the busywork."
            accent="#FBBF24"
          />
          <div className="lp-scroller" style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16, marginTop: 56,
          }}>
            {USE_CASES.map((c, i) => (
              <UseCaseCard key={c.when} {...c} idx={i} />
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section" style={{
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
              Create your first unit, upload your notes, and ask Derek your first question in under two minutes.
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
