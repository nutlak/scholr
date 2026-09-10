// Create a 100%-off promotion code for Scholr Pro.
//
//   cd server
//   node scripts/create-promo.mjs                     # uses .env (test key)
//   STRIPE_SECRET_KEY=sk_live_... node scripts/create-promo.mjs   # live
//
// Safe to re-run: it looks for an existing code of the same name first and
// reports it instead of creating a duplicate.
import "dotenv/config";
import Stripe from "stripe";

const CODE            = process.env.PROMO_CODE  || "SCHOLRFREE";
const MAX_REDEMPTIONS = Number(process.env.PROMO_MAX || 5);
const DURATION        = process.env.PROMO_DURATION || "forever"; // forever | once

const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error("STRIPE_SECRET_KEY is not set"); process.exit(1); }
const stripe = new Stripe(key);
const mode = key.startsWith("sk_live") ? "LIVE" : "TEST";

const existing = await stripe.promotionCodes.list({ code: CODE, limit: 1 });
if (existing.data.length) {
  const p = existing.data[0];
  console.log(`[${mode}] ${CODE} already exists — ${p.id}`);
  console.log(`  active=${p.active} redeemed=${p.times_redeemed}/${p.max_redemptions ?? "∞"}`);
  process.exit(0);
}

const coupon = await stripe.coupons.create({
  percent_off: 100,
  duration: DURATION,
  name: `Scholr Pro — free (${DURATION})`,
});

const promo = await stripe.promotionCodes.create({
  coupon: coupon.id,
  code: CODE,
  max_redemptions: MAX_REDEMPTIONS,
});

console.log(`[${mode}] created`);
console.log(`  coupon    ${coupon.id}  ${coupon.percent_off}% off, duration=${coupon.duration}`);
console.log(`  promo     ${promo.code}  (${promo.id})  max_redemptions=${promo.max_redemptions}`);
