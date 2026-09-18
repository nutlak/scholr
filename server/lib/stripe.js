import "./env.js";
import Stripe from "stripe";

// ── Stripe ────────────────────────────────────────────────────────────────────
export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
