// Stripe checkout, the billing portal and Squad plans.
import { Router } from "express";
import { trackEvent } from "../lib/analytics.js";
import { requireAuth } from "../lib/auth.js";
import { checkoutLimiter } from "../lib/limiters.js";
import { stripe } from "../lib/stripe.js";
import { supabase } from "../lib/supabase.js";
import { resolveUserBrief } from "../lib/users.js";

export const router = Router();

// ── Where Stripe sends the customer back to ──────────────────────────────────
// On the web that is just the app. In the iOS app, checkout deliberately runs
// in the system browser and not in the webview (Apple's rules, and it is also
// the only way to take the money without Apple's cut), so Stripe lands the
// customer in Safari with the native app still sitting in the background. The
// way home is a custom scheme — `scholr://` is registered by the app's
// Info.plist. Stripe will not accept a non-http(s) success_url, so this bounces
// through a page we serve instead of handing Stripe the scheme directly.
//
// Universal Links would be nicer (no visible bounce, no "Open in scholr?"
// prompt) but they need an apple-app-site-association file signed against a
// Team ID, which needs the Apple Developer account. Swap this out once that
// exists; nothing else has to change.
const webOrigin = () => process.env.CLIENT_ORIGIN || "https://scholr.dev";
const isNativeReq = (req) => req.body?.platform === "ios";
const nativeReturn = (req, status) =>
  `${req.protocol}://${req.get("host")}/api/billing/return?status=${status}`;

const returnUrls = (req, { okPath, cancelPath }) => isNativeReq(req)
  ? { success_url: nativeReturn(req, "success"), cancel_url: nativeReturn(req, "cancelled") }
  : { success_url: `${webOrigin()}${okPath}`, cancel_url: `${webOrigin()}${cancelPath}` };

// GET /api/billing/return — the bounce. Public on purpose: Stripe redirects the
// browser here with no session of ours attached. It carries no user data and
// grants nothing; the subscription is applied by the webhook, not by this page.
router.get("/api/billing/return", (req, res) => {
  const status = req.query.status === "success" ? "success" : "cancelled";
  const deepLink = `scholr://checkout-return?status=${status}`;
  const heading = status === "success" ? "You're all set." : "No charge was made.";
  res.set("Content-Type", "text/html; charset=utf-8");
  // Some in-app browsers block an immediate scheme redirect, so there is a
  // visible link behind it rather than a dead end.
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=${deepLink}">
<title>Returning to scholr…</title></head>
<body style="font-family:-apple-system,sans-serif;background:#08080C;color:#E8E8F0;text-align:center;padding:60px 20px;">
<div style="font-size:24px;font-weight:800;margin-bottom:12px;">schol<span style="color:#A78BFA;">r</span></div>
<p style="color:#A0A0B0;">${heading}</p>
<p><a href="${deepLink}" style="color:#A78BFA;font-weight:600;">Back to scholr</a></p>
<script>location.replace(${JSON.stringify(deepLink)});</script>
</body></html>`);
});

// POST /api/create-checkout-session — create a Stripe checkout session
router.post("/api/create-checkout-session", requireAuth, checkoutLimiter, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
  if (!process.env.STRIPE_PRICE_ID) return res.status(500).json({ error: "STRIPE_PRICE_ID not configured" });

  const userId = req.user.id;
  const userEmail = req.user.email;

  // Get or create Stripe customer
  let { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  let customerId = sub?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { supabase_user_id: userId },
    });
    customerId = customer.id;
    await supabase.from("subscriptions").upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      tier: "free",
    }, { onConflict: "user_id" });
  }

  trackEvent(userId, "checkout_started");
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    client_reference_id: userId, // ties checkout back to our user_id in webhook
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    // Without this Checkout shows no promo-code field, so promotion codes
    // created in the dashboard or via the API are unredeemable.
    allow_promotion_codes: true,
    // A 100%-off promotion code brings the first invoice to zero; without this
    // Checkout still demands a card, which defeats the point of comping an
    // account. Collection is only skipped when the total really is zero, so
    // ordinary paid upgrades are unaffected. A *time-limited* free code
    // (duration: "once") would reach its first real renewal with no card on
    // file — Stripe asks for one then.
    payment_method_collection: "if_required",
    ...returnUrls(req, { okPath: "/app?upgraded=true", cancelPath: "/pricing" }),
  });

  res.json({ url: session.url });
});

// POST /api/squad/create-checkout-session — one subscription, Pro for up to
// `seats` people. A separate Stripe price from personal Pro (STRIPE_PRICE_ID_SQUAD)
// — needs to exist in the Stripe dashboard before this works; there is no way
// to create a real price from here. Mirrors /api/create-checkout-session but
// tags the session so the webhook creates a squad instead of a personal sub.
router.post("/api/squad/create-checkout-session", requireAuth, checkoutLimiter, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
  if (!process.env.STRIPE_PRICE_ID_SQUAD) {
    // Naming the env var in the response put "STRIPE_PRICE_ID_SQUAD not
    // configured" on screen in Settings. That's infrastructure detail the user
    // can do nothing with — log it for us, tell them something true instead.
    console.error("[squad/checkout] STRIPE_PRICE_ID_SQUAD is not set — squad checkout is unavailable");
    return res.status(503).json({
      error: "squad_unavailable",
      message: "Squad plans aren't available right now. Please try again later.",
    });
  }

  const userId = req.user.id;
  const userEmail = req.user.email;

  const { data: existing } = await supabase.from("squads").select("id").eq("owner_id", userId).maybeSingle();
  if (existing) return res.status(400).json({ error: "squad_exists", message: "You already own a squad." });

  // Reuse the same Stripe customer as personal billing would — one person,
  // one customer, regardless of which plan they're buying.
  let { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  let customerId = sub?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: userEmail, metadata: { supabase_user_id: userId } });
    customerId = customer.id;
    await supabase.from("subscriptions").upsert({ user_id: userId, stripe_customer_id: customerId, tier: "free" }, { onConflict: "user_id" });
  }

  trackEvent(userId, "squad_checkout_started");
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    client_reference_id: userId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: process.env.STRIPE_PRICE_ID_SQUAD, quantity: 1 }],
    metadata: { type: "squad" },
    allow_promotion_codes: true,
    payment_method_collection: "if_required",
    ...returnUrls(req, { okPath: "/app?squad=true", cancelPath: "/pricing" }),
  });

  res.json({ url: session.url });
});

// GET /api/squad/mine — the squad the caller owns or belongs to, with member
// names and (owner only) the invite link. null if not in one.
router.get("/api/squad/mine", requireAuth, async (req, res) => {
  const { data: memberships } = await supabase
    .from("squad_members")
    .select("squad_id")
    .eq("user_id", req.user.id)
    .limit(1);
  const membership = memberships?.[0];
  if (!membership) return res.json(null);

  const { data: squad } = await supabase
    .from("squads")
    .select("id, name, owner_id, seats, current_period_end, invite_token")
    .eq("id", membership.squad_id)
    .single();

  const { data: memberRows } = await supabase
    .from("squad_members")
    .select("user_id")
    .eq("squad_id", squad.id);
  const members = await Promise.all((memberRows ?? []).map(m => resolveUserBrief(m.user_id)));

  const isOwner = squad.owner_id === req.user.id;
  res.json({
    id: squad.id,
    name: squad.name,
    seats: squad.seats,
    active: !!squad.current_period_end && new Date(squad.current_period_end) > new Date(),
    isOwner,
    members: members.map(m => ({ userId: m.userId, name: m.name })),
    inviteUrl: isOwner ? `${process.env.CLIENT_ORIGIN || "https://scholr.dev"}/squad-invite/${squad.invite_token}` : null,
  });
});

// POST /api/squad/join/:token — join a squad via its invite link. Capped at
// squad.seats; already-a-member is a harmless success, not an error.
router.post("/api/squad/join/:token", requireAuth, async (req, res) => {
  const { data: squad } = await supabase
    .from("squads")
    .select("id, seats")
    .eq("invite_token", req.params.token)
    .maybeSingle();
  if (!squad) return res.status(404).json({ error: "Invite not found or expired." });

  const { data: already } = await supabase
    .from("squad_members")
    .select("user_id")
    .eq("squad_id", squad.id)
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (already) return res.json({ ok: true, alreadyMember: true });

  const { count } = await supabase
    .from("squad_members")
    .select("user_id", { count: "exact", head: true })
    .eq("squad_id", squad.id);
  if ((count ?? 0) >= squad.seats) {
    return res.status(403).json({ error: "squad_full", message: "This squad is already full." });
  }

  // A user can only belong to one squad at a time (mirrors getUserTier's
  // one-row maybeSingle lookup) — leave any existing one first.
  await supabase.from("squad_members").delete().eq("user_id", req.user.id);
  const { error } = await supabase.from("squad_members").insert({ squad_id: squad.id, user_id: req.user.id });
  if (error) return res.status(500).json({ error: error.message });

  // The count check above and this insert aren't atomic, so concurrent joins
  // against the last open seat can all pass the check together. Re-verify
  // after inserting and evict yourself if the squad ended up over capacity —
  // bounds the overshoot to "however many joins raced," rather than leaving
  // the cap unenforced. A true fix needs a DB-level constraint or advisory
  // lock; this is a best-effort backstop given seats is only ever 5.
  const { count: after } = await supabase
    .from("squad_members")
    .select("user_id", { count: "exact", head: true })
    .eq("squad_id", squad.id);
  if ((after ?? 0) > squad.seats) {
    await supabase.from("squad_members").delete().eq("squad_id", squad.id).eq("user_id", req.user.id);
    return res.status(403).json({ error: "squad_full", message: "This squad just filled up — try again or ask the owner for a spot." });
  }

  trackEvent(req.user.id, "squad_joined", { squadId: squad.id });
  res.json({ ok: true });
});

// POST /api/squad/leave — members leave freely; the owner must cancel the
// subscription (billing portal) instead of just leaving, since leaving alone
// wouldn't stop the charge.
router.post("/api/squad/leave", requireAuth, async (req, res) => {
  const { data: squad } = await supabase.from("squads").select("id").eq("owner_id", req.user.id).maybeSingle();
  if (squad) {
    return res.status(400).json({ error: "owner_cannot_leave", message: "Cancel your subscription from billing settings instead of leaving." });
  }
  await supabase.from("squad_members").delete().eq("user_id", req.user.id);
  res.json({ ok: true });
});

// POST /api/create-portal-session — create a Stripe billing portal session
router.post("/api/create-portal-session", requireAuth, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe not configured" });

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", req.user.id)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return res.status(400).json({ error: "No Stripe customer found for this user" });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: isNativeReq(req) ? nativeReturn(req, "success") : `${webOrigin()}/app`,
  });

  res.json({ url: session.url });
});
