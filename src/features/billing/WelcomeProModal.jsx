import { Check } from "lucide-react";
import { FONT, FONT_HEADING } from "../../lib/theme.js";
import { useEscape } from "../../ui/useEscape.js";

// Same six lines as the Pro card on the landing page (src/LandingPage.jsx) —
// kept as a second literal rather than a shared import, matching how this repo
// already keeps landing copy and in-app copy in sync by hand (CLAUDE.md's
// landing-page-parity rule already assumes the two are edited together).
const FEATURES = {
  pro: ["Unlimited AI messages", "Unlimited Forge outputs", "Unlimited classes",
    "Unlimited notes", "Claude Sonnet (smarter AI)", "Priority support"],
  squad: ["Everything in Pro", "Pro for up to 5 people", "One bill for the whole group",
    "Invite your study group instantly"],
};

/* The moment right after someone pays used to be a toast that read "Welcome to
 * scholr Pro!" for four seconds and then vanished, leaving them to go discover
 * what they'd actually bought. That's the exact gap where buyer's remorse
 * creeps in on a subscription — a receipt with no visible change to point at.
 * This replaces it: a dismissible, persistent look at what unlocked, not a
 * sentence that disappears before some people finish reading it.
 */
export function WelcomeProModal({ plan = "pro", onClose }) {
  useEscape(onClose);
  const squad = plan === "squad";
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
      justifyContent: "center", padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 16,
        padding: 32, maxWidth: 380, width: "100%", textAlign: "center", animation: "onbSlide 0.3s ease",
      }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>{squad ? "🎉" : "✨"}</div>
        <div style={{
          fontFamily: FONT_HEADING, fontSize: 24, fontWeight: 700,
          color: "var(--text-primary)", marginBottom: 6,
        }}>{squad ? "Squad is live" : "You're on Pro"}</div>
        <div style={{
          fontFamily: FONT, fontSize: 14, color: "var(--text-secondary)", marginBottom: 22,
        }}>{squad ? "Invite up to 5 people — everyone gets Pro on your bill." : "Here's what just unlocked."}</div>

        <div style={{ textAlign: "left", marginBottom: 26 }}>
          {FEATURES[squad ? "squad" : "pro"].map(f => (
            <div key={f} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 0", borderBottom: "1px solid var(--border-subtle)",
              fontFamily: FONT, fontSize: 14, color: "var(--text-primary)",
            }}>
              <Check size={16} strokeWidth={2.5} color="var(--acc)" style={{ flexShrink: 0 }} />
              {f}
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{
          width: "100%", height: 44, borderRadius: 10, border: "none",
          background: "var(--acc)", color: "var(--on-acc)", fontFamily: FONT,
          fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>Let's go →</button>
      </div>
    </div>
  );
}
