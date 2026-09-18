import { rateLimit, ipKeyGenerator } from "express-rate-limit";

// ── Rate limiters (applied per-route below) ───────────────────────────────────
// Auth'd routes key by user ID; IP is the fallback (ipKeyGenerator handles IPv6 safely)
//
// NOTE: all limiters use express-rate-limit's default in-memory store. This is
// correct for a single instance. A multi-instance deploy would double-count
// budgets across processes — switch to a shared store (e.g. Redis via
// rate-limit-redis) before scaling horizontally.

// Global baseline applied to every /api route (except the Stripe webhook, which
// is registered before this middleware). Keyed by IP at this layer because it
// runs before per-route auth populates req.user; verified per-user throttling is
// handled by the per-feature limiters below.
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  keyGenerator: req => req.user?.id ?? ipKeyGenerator(req),
  standardHeaders: true, legacyHeaders: false,
  message: { error: "rate_limited", message: "Too many requests, please slow down." },
});

// Defense-in-depth burst cap on the expensive AI endpoints, layered on top of
// the global limiter and each feature's monthly usage/tier cap. Placed after
// requireAuth in the chain, so it keys by the verified user id.
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  keyGenerator: req => req.user?.id ?? ipKeyGenerator(req),
  standardHeaders: true, legacyHeaders: false,
  message: { error: "rate_limited", message: "Too many requests, please slow down." },
});

export const queryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  keyGenerator: req => req.user?.id ?? ipKeyGenerator(req),
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
export const forgeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: req => req.user?.id ?? ipKeyGenerator(req),
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many Forge requests. Please try again later." },
});
export const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  keyGenerator: req => req.user?.id ?? ipKeyGenerator(req),
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many checkout attempts. Please wait a moment." },
});
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  keyGenerator: req => ipKeyGenerator(req),
  standardHeaders: true, legacyHeaders: false,
});

// ── Auth / OTP limiters ───────────────────────────────────────────────────────
// Public auth routes have no req.user. OTP issuance/verification is keyed by the
// target email (express.json runs before these routes, so req.body is parsed),
// falling back to IP — this throttles email-bombing, enumeration, and code
// brute-forcing. send-otp also gets a separate per-IP limiter chained in front.
export const otpEmailKey = (req) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return email ? `email:${email}` : ipKeyGenerator(req);
};
export const otpIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15,
  keyGenerator: req => ipKeyGenerator(req),
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many requests from this network. Please wait and try again." },
});
export const otpSendEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: otpEmailKey,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many codes requested for this email. Please wait before trying again." },
});
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  keyGenerator: otpEmailKey,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many attempts. Request a new code and try again." },
});
export const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyGenerator: req => ipKeyGenerator(req), // reset-password body has no email; key by IP
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many reset attempts. Please wait before trying again." },
});

// ── AI-endpoint limiters (per user) — backstop model-cost abuse ────────────────
export const feynmanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: req => req.user?.id ?? ipKeyGenerator(req),
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many grading requests. Please slow down." },
});
export const explainLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: req => req.user?.id ?? ipKeyGenerator(req),
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});
export const podcastLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: req => req.user?.id ?? ipKeyGenerator(req),
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many podcast generations this hour. Please try again later." },
});
