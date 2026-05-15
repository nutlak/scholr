import { useState, useEffect, useRef } from "react";

const FONT = `system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif`;

function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [threshold]);
  return scrolled;
}

function useFadeIn() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

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
        background: hovered ? "#1A1A1A" : "#111111",
        border: `1px solid ${hovered ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 6,
        padding: "24px",
        transition: "all 0.1s",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 6,
        background: "rgba(167,139,250,0.08)",
        border: "1px solid rgba(167,139,250,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, marginBottom: 16,
      }}>{icon}</div>
      <div style={{
        fontSize: 14, fontWeight: 600, color: "#FAFAFA",
        fontFamily: FONT, marginBottom: 8, letterSpacing: "-0.01em",
      }}>{title}</div>
      <div style={{
        fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6,
        fontFamily: FONT,
      }}>{body}</div>
    </div>
  );
}

function Step({ n, title, body, last }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} style={{
      display: "flex", gap: 20, alignItems: "flex-start",
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)",
      transition: "opacity 0.15s ease, transform 0.15s ease",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "#A78BFA",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: "#0A0A0A",
          fontFamily: FONT, flexShrink: 0,
        }}>{n}</div>
        {!last && <div style={{ width: 1, flex: 1, background: "rgba(255,255,255,0.06)", marginTop: 8 }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : 32 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: "#FAFAFA",
          fontFamily: FONT, marginBottom: 4, letterSpacing: "-0.01em",
        }}>{title}</div>
        <div style={{
          fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6,
          fontFamily: FONT,
        }}>{body}</div>
      </div>
    </div>
  );
}

export default function LandingPage({ onSignIn }) {
  const scrolled = useScrolled();

  return (
    <div style={{
      background: "#0A0A0A", minHeight: "100vh",
      fontFamily: FONT, color: "#FAFAFA",
      overflowX: "hidden",
    }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A0A0A; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50%       { opacity: 1; transform: translateY(-3px); }
        }

        .landing-btn-primary {
          display: inline-flex; align-items: center; gap: 6px;
          background: #A78BFA; color: #0A0A0A;
          border: none; border-radius: 6px;
          padding: 0 16px; height: 36px;
          font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: ${FONT};
          transition: background 0.1s; white-space: nowrap;
        }
        .landing-btn-primary:hover { background: #7C3AED; }

        .hero-btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: #A78BFA; color: #0A0A0A;
          border: none; border-radius: 6px;
          padding: 0 24px; height: 44px;
          font-size: 14px; font-weight: 600;
          cursor: pointer; font-family: ${FONT};
          white-space: nowrap;
          transition: background 0.1s;
        }
        .hero-btn-primary:hover { background: #7C3AED; }

        .hero-btn-ghost {
          display: inline-flex; align-items: center;
          background: transparent; color: rgba(255,255,255,0.6);
          border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
          padding: 0 24px; height: 44px;
          font-size: 14px; font-weight: 500;
          cursor: pointer; font-family: ${FONT};
          white-space: nowrap;
          transition: border-color 0.1s, color 0.1s;
        }
        .hero-btn-ghost:hover { border-color: rgba(255,255,255,0.2); color: #FAFAFA; }

        .nav-sign-in {
          background: none; border: none; cursor: pointer;
          color: rgba(255,255,255,0.5); font-size: 13px; font-weight: 500;
          font-family: ${FONT};
          padding: 0 12px; height: 32px; border-radius: 6px;
          transition: color 0.1s;
        }
        .nav-sign-in:hover { color: #FAFAFA; }
      `}</style>

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 52, padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrolled ? "rgba(10,10,10,0.9)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
        transition: "background 0.2s, border-color 0.2s",
      }}>
        <div style={{
          fontFamily: FONT, fontSize: 18, fontWeight: 700,
          color: "#FAFAFA", letterSpacing: "-0.02em",
        }}>
          schol<span style={{ color: "#A78BFA" }}>r</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="nav-sign-in" onClick={onSignIn}>Sign in</button>
          <button className="landing-btn-primary" onClick={onSignIn}>Get started</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        minHeight: "100vh",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "80px 24px 64px",
        position: "relative",
      }}>
        <div style={{
          position: "relative", zIndex: 1, maxWidth: 720,
          width: "100%", margin: "0 auto", textAlign: "center",
          display: "flex", flexDirection: "column", alignItems: "center",
          animation: "fadeUp 0.3s ease both",
        }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)",
            borderRadius: 100, padding: "4px 12px",
            fontSize: 12, fontWeight: 500, color: "#A78BFA",
            marginBottom: 24, letterSpacing: "0.01em",
          }}>
            AI-powered collaborative studying
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: "clamp(36px, 6vw, 56px)",
            fontWeight: 600, lineHeight: 1.1,
            fontFamily: FONT, letterSpacing: "-0.02em",
            marginBottom: 20, color: "#FAFAFA",
          }}>
            Study smarter.{" "}
            <span style={{ color: "#A78BFA" }}>Study together.</span>
          </h1>

          {/* Subtext */}
          <p style={{
            fontSize: 16, color: "rgba(255,255,255,0.5)", lineHeight: 1.6,
            maxWidth: 520, margin: "0 auto 36px", fontFamily: FONT,
          }}>
            Scholr turns your class notes into a shared AI tutor. Upload your notes,
            invite your study group, and ask Derek anything.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="hero-btn-primary" onClick={onSignIn}>
              Get started free →
            </button>
            <button className="hero-btn-ghost" onClick={onSignIn}>
              See how it works
            </button>
          </div>

          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 16, fontFamily: FONT }}>
            Free to use · No credit card required
          </p>
        </div>

        {/* Mock app card */}
        <div style={{
          position: "relative", zIndex: 1,
          marginTop: 56, maxWidth: 640, width: "100%",
          margin: "56px auto 0",
          animation: "fadeUp 0.3s 0.1s ease both",
        }}>
          <div style={{
            background: "#111111",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            padding: "20px",
          }}>
            {/* Mock chat */}
            <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "#A78BFA",
                flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: "#0A0A0A",
              }}>D</div>
              <div style={{
                background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6,
                padding: "10px 12px", maxWidth: 480,
              }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: "#A78BFA", marginBottom: 4, fontFamily: FONT, letterSpacing: "0.05em", textTransform: "uppercase" }}>Derek</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, fontFamily: FONT }}>
                  Based on your lecture notes, the three main types of chemical bonds are covalent, ionic, and metallic. Covalent bonds involve sharing electrons between nonmetals. Want me to explain how they differ?
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <div style={{
                background: "#A78BFA", borderRadius: 6,
                padding: "10px 12px", maxWidth: 340,
                fontSize: 13, color: "#0A0A0A", fontFamily: FONT, fontWeight: 500,
              }}>
                What's the difference between ionic and covalent bonds?
              </div>
            </div>
            {/* Typing indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "#A78BFA",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: "#0A0A0A", flexShrink: 0,
              }}>D</div>
              <div style={{
                background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6,
                padding: "10px 12px", display: "flex", gap: 4, alignItems: "center",
              }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.3)",
                    animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: FONT }}>Derek is thinking…</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{
        padding: "80px 24px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <SectionHeader
            pill="Features"
            title="Everything your study group needs"
            sub="One place for notes, AI answers, and real-time collaboration with your classmates."
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 48 }}>
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

      {/* How it works */}
      <section style={{
        padding: "80px 24px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <SectionHeader
            pill="How it works"
            title="Up and running in minutes"
            sub="No setup, no syllabus parsing, no config. Just upload and ask."
          />
          <div style={{ marginTop: 48 }}>
            <Step n={1} title="Create a unit" body="One unit per subject or exam. Name it, optionally add a topic tag, and you're in." />
            <Step n={2} title="Upload your notes" body="PDFs, lecture slides, typed notes — anything goes. Scholr reads the text so Derek can reference it instantly." />
            <Step n={3} title="Invite your study group" body="Share the invite link. Teammates join in one click and see all your uploaded notes immediately." />
            <Step n={4} title="Ask Derek" body="Type any question in the chat. Derek answers from your actual notes — not generic internet knowledge." last />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: "80px 24px 96px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{
            display: "inline-flex", alignItems: "center",
            background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)",
            borderRadius: 100, padding: "4px 12px",
            fontSize: 11, fontWeight: 500, color: "#A78BFA",
            marginBottom: 20, letterSpacing: "0.05em", textTransform: "uppercase",
          }}>
            Free forever for study groups
          </div>
          <h2 style={{
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 600, lineHeight: 1.1,
            fontFamily: FONT, color: "#FAFAFA",
            letterSpacing: "-0.02em", marginBottom: 16,
          }}>
            Ready to study smarter?
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 32, fontFamily: FONT }}>
            Create your first unit, upload your notes, and ask Derek your first question — in under two minutes.
          </p>
          <button className="landing-btn-primary" onClick={onSignIn} style={{ fontSize: 14, padding: "0 28px", height: 44 }}>
            Get started free →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: "#FAFAFA", letterSpacing: "-0.01em" }}>
          schol<span style={{ color: "#A78BFA" }}>r</span>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: FONT }}>
          © {new Date().getFullYear()} Scholr. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({ pill, title, sub }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} style={{
      textAlign: "center",
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)",
      transition: "opacity 0.15s ease, transform 0.15s ease",
    }}>
      <div style={{
        display: "inline-flex", alignItems: "center",
        background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)",
        borderRadius: 100, padding: "4px 12px",
        fontSize: 11, fontWeight: 500, color: "#A78BFA",
        marginBottom: 16, letterSpacing: "0.05em", textTransform: "uppercase",
      }}>
        {pill}
      </div>
      <h2 style={{
        fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 600,
        fontFamily: FONT, color: "#FAFAFA",
        letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 12,
      }}>{title}</h2>
      <p style={{
        fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.6,
        maxWidth: 480, margin: "0 auto", fontFamily: FONT,
      }}>{sub}</p>
    </div>
  );
}
