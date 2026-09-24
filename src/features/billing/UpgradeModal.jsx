import { api } from "../../api.js";
import { FONT, FONT_HEADING } from "../../lib/theme.js";
import { useServerFeature } from "../../lib/useServerFeature.js";
import { useEscape } from "../../ui/useEscape.js";
import { BookOpen, Check, MessageCircle, Notebook, Rocket, Zap } from "lucide-react";
import { useEffect, useState } from "react";

// ── UpgradeModal ─────────────────────────────────────────────────────────────
// Same 3 testimonials as the landing page (illustrative early-stage social proof).
const UPGRADE_TESTIMONIALS = [
  { quote: "Derek explained cell division better than my AP Bio teacher did.", name: "Maya R.", role: "AP Biology" },
  { quote: "Went from a C to a B+ after one week of Feynman Mode practice.", name: "Jake T.", role: "AP Chemistry" },
  { quote: "My whole study group uses it. We share notebooks before every exam.", name: "Priya S.", role: "AP US History" },
];

export function UpgradeSocialProof() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % UPGRADE_TESTIMONIALS.length), 4000);
    return () => clearInterval(t);
  }, []);
  const t = UPGRADE_TESTIMONIALS[idx];
  return (
    <div style={{ marginTop: 18, textAlign: "center" }}>
      <div style={{ fontSize: 15, letterSpacing: 2, marginBottom: 8 }}>⭐⭐⭐⭐⭐</div>
      <div key={idx} style={{ minHeight: 54, animation: "fadeIn 0.6s ease" }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.5, fontFamily: FONT }}>"{t.quote}"</div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: FONT, marginTop: 5 }}>— {t.name}, {t.role}</div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: FONT, marginTop: 10 }}>
        Join students improving their grades with Scholr
      </div>
    </div>
  );
}

export function UpgradeModal({ limitType, onClose }) {
  useEscape(onClose);
  const [loading, setLoading] = useState(false);
  // Every Pro CTA in the app funnels into this modal, so gating the button
  // here covers all of them: with Stripe unconfigured server-side, checkout
  // 500s and the only feedback was an error after the click.
  const proAvailable = useServerFeature("pro");

  // Track which limit triggered this prompt (conversion analytics).
  useEffect(() => { api.recordUpgradeTrigger(limitType || "upgrade"); }, [limitType]);

  const context = {
    message_limit_reached: {
      Icon: MessageCircle,
      headline: "Message limit reached",
      detail: "You've used all 100 messages this month on the free plan.",
    },
    forge_limit_reached: {
      Icon: Zap,
      headline: "Forge limit reached",
      detail: "You've used all 3 Forge outputs this month on the free plan.",
    },
    class_limit_reached: {
      Icon: BookOpen,
      headline: "You're on a roll.",
      detail: "Free plan is limited to 3 classes. Upgrade to Pro for unlimited classes, notebooks, podcast mode, and more.",
    },
    notebook_limit_reached: {
      Icon: Notebook,
      headline: "You're on a roll.",
      detail: "Free plan is limited to 3 notebooks. Upgrade to Pro for unlimited notebooks, notes, podcast mode, and more.",
    },
  }[limitType] ?? {
    Icon: Rocket,
    headline: "Upgrade to Pro",
    detail: "Unlock the full scholr experience.",
  };

  const [checkoutError, setCheckoutError] = useState("");

  async function handleUpgrade() {
    setLoading(true);
    setCheckoutError("");
    try {
      await api.createCheckoutSession();
      // On success the browser is already navigating away, so `loading` is
      // intentionally left set — the button should not flick back to idle.
    } catch (err) {
      setLoading(false);
      // Previously this only hit the console, so a failed checkout looked
      // identical to a slow one and the user was told nothing.
      setCheckoutError(err?.message || "Couldn't start checkout. Please try again.");
      console.error("Checkout error:", err);
    }
  }

  return (
    <div className="mobile-sheet-overlay" style={{
      position: "fixed", inset: 0, zIndex: 3000,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, animation: "fadeIn 0.18s ease",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mobile-sheet" style={{
        background: "var(--bg-surface-1)",
        border: "1px solid rgba(167,139,250,0.28)",
        borderRadius: 20, padding: "32px 28px",
        maxWidth: 400, width: "100%",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px var(--acc-bg)",
        animation: "slideInUp 0.22s cubic-bezier(0.34,1.56,0.64,1)",
        fontFamily: FONT,
      }}>
        {/* Icon + headline */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ marginBottom: 10, color: "var(--acc)", display: "inline-flex" }}>
            <context.Icon size={36} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT_HEADING, letterSpacing: "-0.01em", marginBottom: 6 }}>
            {context.headline}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {context.detail}
          </div>
        </div>

        {/* Price */}
        <div style={{
          background: "linear-gradient(135deg, var(--acc-bg), rgba(167,139,250,0.04))",
          border: "1px solid rgba(167,139,250,0.22)",
          borderRadius: 12, padding: "14px 18px", marginBottom: 20,
          display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4,
        }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: "var(--acc)", letterSpacing: "-0.03em" }}>$8.49</span>
          <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>/month</span>
        </div>

        {/* Features */}
        <div style={{ marginBottom: 24 }}>
          {[
            "Unlimited AI messages with Claude Sonnet (smarter AI)",
            "Unlimited Forge outputs (study guides, flashcards, summaries)",
            "Unlimited classes",
            "Unlimited notes & storage",
            "Priority support",
          ].map(f => (
            <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <span style={{ color: "var(--success)", flexShrink: 0, marginTop: 1, display: "inline-flex" }}><Check size={14} strokeWidth={2} /></span>
              <span style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.4 }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        {proAvailable ? (
          <button
            onClick={handleUpgrade}
            disabled={loading}
            style={{
              width: "100%", height: 46, marginBottom: 10,
              background: loading ? "var(--acc-bg-h)" : "var(--acc)",
              border: "none", borderRadius: 12,
              color: "var(--on-acc)", fontWeight: 700, fontSize: 15,
              fontFamily: FONT, cursor: loading ? "wait" : "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
              transition: "all 0.18s",
            }}
          >
            {loading ? "Redirecting…" : "Upgrade to Pro — $8.49/mo"}
          </button>
        ) : (
          <div style={{
            width: "100%", marginBottom: 10, borderRadius: 12,
            border: "1px solid var(--border-default)", padding: "13px 14px",
            fontSize: 13, color: "var(--text-secondary)", fontFamily: FONT,
            textAlign: "center", lineHeight: 1.45,
          }}>Upgrades are temporarily unavailable — check back soon.</div>
        )}
        {checkoutError && (
          <div role="alert" style={{
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.22)",
            borderRadius: 10, padding: "9px 11px", marginBottom: 10,
            fontSize: 12.5, color: "#F87171", fontFamily: FONT, lineHeight: 1.45,
          }}>{checkoutError}</div>
        )}
        <button
          onClick={onClose}
          style={{
            width: "100%", height: 40, background: "transparent",
            border: "1px solid var(--border-default)",
            borderRadius: 12, color: "var(--text-tertiary)",
            fontSize: 13, fontFamily: FONT, cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          Maybe later
        </button>

        <UpgradeSocialProof />
      </div>
    </div>
  );
}
