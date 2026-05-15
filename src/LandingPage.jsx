import { useState, useEffect, useRef } from "react";

/* ─── Scroll-aware nav transparency ─────────────────────────────────────── */
function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [threshold]);
  return scrolled;
}

/* ─── Intersection observer for fade-in on scroll ────────────────────────── */
function useFadeIn() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

/* ─── Feature card ───────────────────────────────────────────────────────── */
function FeatureCard({ icon, title, body }) {
  const [ref, visible] = useFadeIn();
  const [hovered, setHovered] = useState(false);
  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: "1 1 280px",
        background: hovered ? "#13131F" : "#0E0E1A",
        border: `1px solid ${hovered ? "#A78BFA44" : "#1E1E2E"}`,
        borderRadius: 20,
        padding: "32px 28px",
        transition: "all 0.25s ease",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: "linear-gradient(135deg, #A78BFA22, #7C3AED22)",
        border: "1px solid #A78BFA33",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, marginBottom: 20,
      }}>{icon}</div>
      <div style={{
        fontSize: 17, fontWeight: 700, color: "#E8E8F0",
        fontFamily: "'Nunito', sans-serif", marginBottom: 10,
      }}>{title}</div>
      <div style={{
        fontSize: 14, color: "#8080A0", lineHeight: 1.7,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>{body}</div>
    </div>
  );
}

/* ─── Step row ───────────────────────────────────────────────────────────── */
function Step({ n, title, body, last }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} style={{
      display: "flex", gap: 24, alignItems: "flex-start",
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
      transition: "opacity 0.5s ease, transform 0.5s ease",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "linear-gradient(135deg, #A78BFA, #7C3AED)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 800, color: "#fff",
          fontFamily: "'Nunito', sans-serif", flexShrink: 0,
        }}>{n}</div>
        {!last && <div style={{ width: 2, flex: 1, background: "#1E1E2E", marginTop: 8 }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : 40 }}>
        <div style={{
          fontSize: 17, fontWeight: 700, color: "#E8E8F0",
          fontFamily: "'Nunito', sans-serif", marginBottom: 6,
        }}>{title}</div>
        <div style={{
          fontSize: 14, color: "#8080A0", lineHeight: 1.7,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>{body}</div>
      </div>
    </div>
  );
}

/* ─── Main landing page ──────────────────────────────────────────────────── */
export default function LandingPage({ onSignIn }) {
  const scrolled = useScrolled();
  const [heroRef, heroVisible] = useFadeIn();
  // Hero visible immediately on load
  useEffect(() => {}, []);

  return (
    <div style={{
      background: "#0A0A0F", minHeight: "100vh",
      fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#E8E8F0",
      overflowX: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A0A0F; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2A2A38; border-radius: 4px; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes orb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%       { transform: translate(28px, -22px) scale(1.06); }
        }
        @keyframes orb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%       { transform: translate(-24px, 30px) scale(1.05); }
        }
        @keyframes orb3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(20px, 18px) scale(1.04); }
          66%       { transform: translate(-18px, -14px) scale(0.97); }
        }
        @keyframes glowPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1);   opacity: 1; }
          50%       { transform: translate(-50%, -50%) scale(1.005); opacity: 0.85; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }

        .landing-btn-primary {
          display: inline-flex; align-items: center; gap: 6px;
          background: linear-gradient(135deg, #A78BFA, #7C3AED);
          color: #fff; border: none; border-radius: 12px;
          padding: 13px 28px; font-size: 14px; font-weight: 700;
          cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s; white-space: nowrap;
        }
        .landing-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }

        .hero-btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: linear-gradient(135deg, #A78BFA, #7C3AED);
          color: #fff; border: none; border-radius: 14px;
          padding: 16px 40px; font-size: 16px; font-weight: 600;
          cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif;
          white-space: nowrap; min-height: 56px;
          box-shadow: 0 12px 32px rgba(167, 139, 250, 0.25);
          transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
        }
        .hero-btn-primary:hover {
          transform: scale(1.02) translateY(-1px);
          box-shadow: 0 18px 48px rgba(167, 139, 250, 0.38);
          opacity: 0.93;
        }

        .landing-btn-ghost {
          display: inline-flex; align-items: center;
          background: transparent; color: #9090B8;
          border: 1px solid #2A2A38; border-radius: 12px;
          padding: 12px 24px; font-size: 14px; font-weight: 600;
          cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif;
          transition: border-color 0.2s, color 0.2s, transform 0.18s;
        }
        .landing-btn-ghost:hover {
          border-color: #A78BFA66; color: #E8E8F0;
          transform: scale(1.01) translateY(-1px);
        }

        .hero-btn-ghost {
          display: inline-flex; align-items: center;
          background: transparent; color: #9090B8;
          border: 1px solid #2A2A38; border-radius: 14px;
          padding: 16px 32px; font-size: 15px; font-weight: 600;
          cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif;
          min-height: 56px; white-space: nowrap;
          transition: border-color 0.2s, color 0.2s, transform 0.18s;
        }
        .hero-btn-ghost:hover {
          border-color: #A78BFA66; color: #E8E8F0;
          transform: scale(1.01) translateY(-1px);
        }

        .nav-sign-in {
          background: none; border: none; cursor: pointer;
          color: #9090B8; font-size: 14px; font-weight: 600;
          font-family: 'Plus Jakarta Sans', sans-serif;
          padding: 8px 16px; border-radius: 8px; transition: color 0.15s;
        }
        .nav-sign-in:hover { color: #E8E8F0; }
      `}</style>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 64, padding: "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrolled ? "rgba(10,10,15,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid #1E1E2E" : "1px solid transparent",
        transition: "background 0.3s, border-color 0.3s, backdrop-filter 0.3s",
      }}>
        {/* Logo */}
        <div style={{
          fontFamily: "'Nunito', sans-serif", fontSize: 24, fontWeight: 900,
          color: "#E8E8F0", letterSpacing: "-0.02em",
        }}>
          schol<span style={{ color: "#A78BFA" }}>r</span>
        </div>

        {/* Nav actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="nav-sign-in" onClick={onSignIn}>Sign in</button>
          <button className="landing-btn-primary" onClick={onSignIn}>
            Get started free
          </button>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: "100vh",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "80px 24px 64px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Ambient orbs — slow, blurred, depth layer */}
        <div style={{
          position: "absolute", width: 700, height: 700, borderRadius: "50%",
          background: "radial-gradient(circle, #A78BFA26 0%, transparent 68%)",
          top: "5%", left: "50%", transform: "translateX(-50%)",
          filter: "blur(60px)",
          animation: "orb1 24s ease-in-out infinite", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", width: 480, height: 480, borderRadius: "50%",
          background: "radial-gradient(circle, #7C3AED22 0%, transparent 68%)",
          bottom: "10%", right: "8%",
          filter: "blur(60px)",
          animation: "orb2 30s ease-in-out infinite", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", width: 360, height: 360, borderRadius: "50%",
          background: "radial-gradient(circle, #A78BFA1A 0%, transparent 68%)",
          top: "30%", left: "5%",
          filter: "blur(60px)",
          animation: "orb3 38s ease-in-out infinite", pointerEvents: "none",
        }} />

        <div style={{
          position: "relative", zIndex: 1, maxWidth: 860,
          animation: "fadeUp 0.8s ease both",
        }}>
          {/* Pill badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "#A78BFA18", border: "1px solid #A78BFA33",
            borderRadius: 100, padding: "6px 16px",
            fontSize: 13, fontWeight: 600, color: "#A78BFA",
            marginBottom: 28, letterSpacing: "0.01em",
          }}>
            ✨ AI-powered collaborative studying
          </div>

          {/* Accent glow — sits behind the headline text */}
          <div style={{
            position: "absolute",
            width: 400, height: 400, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(167,139,250,0.30) 0%, transparent 70%)",
            top: "38%", left: "62%",
            transform: "translate(-50%, -50%)",
            filter: "blur(80px)",
            animation: "glowPulse 4s ease-in-out infinite",
            pointerEvents: "none", zIndex: 0,
          }} />

          {/* Headline */}
          <h1 style={{
            fontSize: 72,
            fontWeight: 800, lineHeight: 1.05,
            fontFamily: "'Nunito', sans-serif",
            letterSpacing: "-0.02em",
            marginBottom: 28,
            whiteSpace: "nowrap",
            position: "relative", zIndex: 1,
          }}>
            <span style={{ color: "#ffffff" }}>Study smarter. </span>
            <span style={{
              background: "linear-gradient(135deg, #A78BFA, #7C3AED)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>Study together.</span>
          </h1>

          {/* Subheadline */}
          <p style={{
            fontSize: 18,
            color: "#8080A0", opacity: 0.7, lineHeight: 1.6,
            maxWidth: 620, margin: "0 auto 44px",
            position: "relative", zIndex: 1,
          }}>
            Scholr turns your class notes into a shared AI tutor. Upload your notes,
            invite your study group, and ask Derek anything.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", position: "relative", zIndex: 1 }}>
            <button className="hero-btn-primary" onClick={onSignIn}>
              Get started free →
            </button>
            <button className="hero-btn-ghost" onClick={onSignIn}>
              See how it works
            </button>
          </div>

          <p style={{ fontSize: 12, color: "#404060", marginTop: 18 }}>
            Free to use · No credit card required
          </p>
        </div>

        {/* Mock app card */}
        <div style={{
          position: "relative", zIndex: 1,
          marginTop: 72, maxWidth: 720, width: "100%",
          animation: "fadeUp 0.9s 0.2s ease both",
        }}>
          <div style={{
            background: "#0E0E1A",
            border: "1px solid #1E1E2E",
            borderRadius: 20,
            padding: "24px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px #A78BFA18",
          }}>
            {/* Mock chat */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "flex-start" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg, #A78BFA, #7C3AED)",
                flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14,
              }}>🤖</div>
              <div style={{
                background: "#1A1A28", border: "1px solid #2A2A38",
                borderRadius: "12px 12px 12px 4px",
                padding: "12px 16px", maxWidth: 480,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#A78BFA", marginBottom: 6, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>🤖 Derek</div>
                <div style={{ fontSize: 13, color: "#C0C0D8", lineHeight: 1.6, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Based on your lecture notes, the three main types of chemical bonds are covalent, ionic, and metallic. Covalent bonds involve sharing electrons between nonmetals. Want me to explain how they differ?
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{
                background: "#A78BFA", borderRadius: "12px 12px 4px 12px",
                padding: "10px 14px", maxWidth: 340,
                fontSize: 13, color: "#0A0A0F", fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>
                What's the difference between ionic and covalent bonds?
              </div>
            </div>
            {/* Typing indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "linear-gradient(135deg, #A78BFA, #7C3AED)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, flexShrink: 0,
              }}>🤖</div>
              <div style={{
                background: "#1A1A28", border: "1px solid #2A2A38",
                borderRadius: "10px 10px 10px 3px",
                padding: "10px 14px", display: "flex", gap: 4, alignItems: "center",
              }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: "50%", background: "#6060A0",
                    animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#404060", fontFamily: "'DM Mono', monospace" }}>Derek is typing…</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section style={{
        padding: "96px 24px",
        background: "linear-gradient(180deg, #0A0A0F 0%, #0D0D18 100%)",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <SectionHeader
            pill="Features"
            title="Everything your study group needs"
            sub="One place for notes, AI answers, and real-time collaboration with your classmates."
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginTop: 56 }}>
            <FeatureCard
              icon="📎"
              title="Upload anything"
              body="Drop in PDFs, slides, Word docs, or plain text. Scholr extracts the content so Derek can read every word."
            />
            <FeatureCard
              icon="🤖"
              title="Ask Derek"
              body="Derek is your AI tutor, trained on your own notes. Ask anything — definitions, practice questions, summaries, comparisons."
            />
            <FeatureCard
              icon="👥"
              title="Study together"
              body="Share a unit with your whole study group. Everyone sees the same chat history, notes, and Derek's answers."
            />
            <FeatureCard
              icon="⭐"
              title="Star what matters"
              body="Bookmark important units and find them instantly in your Starred tab. Never dig through folders again."
            />
            <FeatureCard
              icon="🔔"
              title="Stay in sync"
              body="Get notified when a classmate uploads new notes, so you always study with the latest material."
            />
            <FeatureCard
              icon="🔒"
              title="Private by default"
              body="Your notebooks are yours. Only people you invite can join — no public links, no surprises."
            />
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section style={{ padding: "96px 24px" }}>
        <div style={{
          maxWidth: 800, margin: "0 auto",
          display: "flex", flexDirection: "column", gap: 0,
        }}>
          <SectionHeader
            pill="How it works"
            title="Up and running in minutes"
            sub="No setup, no syllabus parsing, no config. Just upload and ask."
          />
          <div style={{ marginTop: 60 }}>
            <Step n={1} title="Create a unit" body="One unit per subject or exam. Name it, optionally add a topic tag, and you're in." />
            <Step n={2} title="Upload your notes" body="PDFs, lecture slides, typed notes — anything goes. Scholr reads the text so Derek can reference it instantly." />
            <Step n={3} title="Invite your study group" body="Share the invite link. Teammates join in one click and see all your uploaded notes immediately." />
            <Step n={4} title="Ask Derek" body="Type any question in the chat. Derek answers from your actual notes — not generic internet knowledge." last />
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{
        padding: "96px 24px 120px",
        background: "linear-gradient(180deg, #0A0A0F 0%, #0D0D1E 100%)",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto", position: "relative" }}>
          <div style={{
            position: "absolute", width: 500, height: 500, borderRadius: "50%",
            background: "radial-gradient(circle, #A78BFA14 0%, transparent 70%)",
            top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              display: "inline-flex", alignItems: "center",
              background: "#A78BFA18", border: "1px solid #A78BFA33",
              borderRadius: 100, padding: "5px 14px",
              fontSize: 12, fontWeight: 600, color: "#A78BFA",
              marginBottom: 24, letterSpacing: "0.01em",
            }}>
              Free forever for study groups
            </div>
            <h2 style={{
              fontSize: "clamp(32px, 5vw, 48px)",
              fontWeight: 800, lineHeight: 1.1,
              fontFamily: "'Nunito', sans-serif",
              color: "#F0F0FA", letterSpacing: "-0.02em", marginBottom: 20,
            }}>
              Ready to study smarter?
            </h2>
            <p style={{ fontSize: 17, color: "#8080A0", lineHeight: 1.65, marginBottom: 40 }}>
              Create your first unit, upload your notes, and ask Derek your first question — in under two minutes.
            </p>
            <button className="landing-btn-primary" onClick={onSignIn} style={{ fontSize: 16, padding: "16px 40px", borderRadius: 14 }}>
              Get started free →
            </button>
          </div>
        </div>
      </section>


      {/* Pulse keyframe referenced in mock chat */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50%       { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
}

/* ─── Section header helper ─────────────────────────────────────────────── */
function SectionHeader({ pill, title, sub }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} style={{
      textAlign: "center",
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
      transition: "opacity 0.5s ease, transform 0.5s ease",
    }}>
      <div style={{
        display: "inline-flex", alignItems: "center",
        background: "#A78BFA14", border: "1px solid #A78BFA2A",
        borderRadius: 100, padding: "5px 14px",
        fontSize: 12, fontWeight: 700, color: "#A78BFA",
        marginBottom: 20, letterSpacing: "0.06em", textTransform: "uppercase",
      }}>
        {pill}
      </div>
      <h2 style={{
        fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800,
        fontFamily: "'Nunito', sans-serif", color: "#F0F0FA",
        letterSpacing: "-0.02em", lineHeight: 1.15, marginBottom: 16,
      }}>{title}</h2>
      <p style={{
        fontSize: 17, color: "#8080A0", lineHeight: 1.65,
        maxWidth: 540, margin: "0 auto",
      }}>{sub}</p>
    </div>
  );
}
