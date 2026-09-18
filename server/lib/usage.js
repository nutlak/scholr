import { supabase } from "./supabase.js";

// ── Subscription & usage helpers ─────────────────────────────────────────────

export async function getUserIdByStripeCustomer(customerId) {
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}

export async function getUserTier(userId) {
  const { data } = await supabase
    .from("subscriptions")
    .select("tier, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  // A known-past renewal date means the subscription lapsed. A *missing* one
  // means we never managed to sync it — previously that was treated the same
  // as expired, so a paying customer whose date failed to sync was billed and
  // still served the free tier. Absence is no longer treated as expiry;
  // customer.subscription.deleted is what revokes access.
  const personalActive = data?.tier === "pro"
    && !(data.current_period_end && new Date(data.current_period_end) <= new Date());
  if (personalActive) return "pro";

  // No active personal subscription — a Squad plan covers every member the
  // same way a personal subscription covers its owner (see migrations/035_squads.sql).
  if (await hasActiveSquadPro(userId)) return "pro";
  return "free";
}

export async function hasActiveSquadPro(userId) {
  // .limit(1) + array read rather than .maybeSingle(): the one-squad-per-user
  // invariant is enforced at every write site, but .maybeSingle() *errors*
  // (not just "picks one") on an unexpected 2nd row, and that error was being
  // swallowed here as silent "not pro" — a paying squad owner could lose
  // access with no visible cause if that invariant were ever violated again.
  const { data } = await supabase
    .from("squad_members")
    .select("squads!inner(current_period_end)")
    .eq("user_id", userId)
    .limit(1);
  const periodEnd = data?.[0]?.squads?.current_period_end;
  return !!periodEnd && new Date(periodEnd) > new Date();
}

// $ per token by model, for the Pro cost tripwire below. Cache writes cost
// 1.25x the input rate, cache reads 0.1x — same ratio Anthropic bills at.
export const MODEL_RATES_PER_TOKEN = {
  "claude-sonnet-5": { in: 2 / 1e6, out: 10 / 1e6 },
  "claude-sonnet-4-6": { in: 3 / 1e6, out: 15 / 1e6 },
  "claude-haiku-4-5-20251001": { in: 1 / 1e6, out: 5 / 1e6 },
};
export const DEFAULT_RATE = MODEL_RATES_PER_TOKEN["claude-sonnet-5"];
export const PRO_MONTHLY_COST_ALERT_CENTS = 1000; // $10 — well above the ~$2-3 typical, flags cram-session outliers

// Fire-and-forget: prices a Claude response and adds it to the caller's
// running monthly total. Free tier is already bounded by message/image
// caps, so this only tracks Pro — where nothing currently caps $ spend.
export async function recordProCost(userId, tier, model, usage) {
  if (tier !== "pro" || !usage) return;
  const rate = MODEL_RATES_PER_TOKEN[model] || DEFAULT_RATE;
  const cost =
    (usage.input_tokens ?? 0) * rate.in +
    (usage.output_tokens ?? 0) * rate.out +
    (usage.cache_creation_input_tokens ?? 0) * rate.in * 1.25 +
    (usage.cache_read_input_tokens ?? 0) * rate.in * 0.1;
  // Round up, not to nearest — most individual calls cost well under a cent,
  // and rounding to nearest would silently drop them to 0 and never
  // accumulate, undercounting exactly the "lots of small questions" pattern
  // this tripwire exists to catch.
  const cents = Math.ceil(cost * 100);
  if (cents <= 0) return;

  await resetUsageIfNeeded(userId);
  const { data: existing } = await supabase
    .from("usage").select("id, pro_cost_cents_this_month, cost_alert_sent_this_month").eq("user_id", userId).maybeSingle();
  const total = (existing?.pro_cost_cents_this_month ?? 0) + cents;

  if (existing) {
    await supabase.from("usage").update({
      pro_cost_cents_this_month: total,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
  } else {
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);
    await supabase.from("usage").insert({
      user_id: userId,
      pro_cost_cents_this_month: total,
      reset_at: nextReset.toISOString(),
    });
  }

  if (total >= PRO_MONTHLY_COST_ALERT_CENTS && !existing?.cost_alert_sent_this_month) {
    console.warn(`[cost-tripwire] pro user ${userId} crossed $${(PRO_MONTHLY_COST_ALERT_CENTS / 100).toFixed(2)} this month (now $${(total / 100).toFixed(2)})`);
    await supabase.from("usage").update({ cost_alert_sent_this_month: true }).eq("user_id", userId);
  }
}

export async function resetUsageIfNeeded(userId) {
  const { data } = await supabase
    .from("usage")
    .select("id, reset_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (data && new Date(data.reset_at) < new Date()) {
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);
    await supabase.from("usage").update({
      messages_this_month: 0,
      forge_outputs_this_month: 0,
      reset_at: nextReset.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    // Reset the image counter in a separate statement so a not-yet-migrated
    // images_this_month column can't block the message/forge reset above.
    await supabase.from("usage").update({ images_this_month: 0 }).eq("user_id", userId);
    // Same isolation for the cost-tripwire columns (migration 037).
    await supabase.from("usage").update({ pro_cost_cents_this_month: 0, cost_alert_sent_this_month: false }).eq("user_id", userId);
  }
}

// Free-tier monthly AI message budget. 100 lets a student form a habit before
// hitting the wall; a soft nudge fires at FREE_MSG_WARN.
export const FREE_MSG_LIMIT = 100;
export const FREE_MSG_WARN = 80;
// Free-tier monthly image-generation budget (OpenAI spend). Pro = unlimited.
export const FREE_IMAGE_LIMIT = 5;

// checkUsageLimit(userId, type[, amount]) — amount lets a single call reserve
// more than one unit (image gen of n images costs n). Defaults to 1 so existing
// "message"/"forge" callers are unaffected.
export async function checkUsageLimit(userId, type, amount = 1) {
  const tier = await getUserTier(userId);
  if (tier === "pro") return { allowed: true, tier, used: 0 };
  await resetUsageIfNeeded(userId);

  // Image budget is kept fully isolated (own query) so a not-yet-migrated
  // images_this_month column can never break message/forge metering below.
  if (type === "image") {
    const { data } = await supabase
      .from("usage").select("images_this_month").eq("user_id", userId).maybeSingle();
    const imgUsed = data?.images_this_month ?? 0;
    if (imgUsed + amount > FREE_IMAGE_LIMIT) {
      return { allowed: false, reason: "image_limit", tier, used: imgUsed };
    }
    return { allowed: true, tier, used: imgUsed };
  }

  const { data } = await supabase
    .from("usage")
    .select("messages_this_month, forge_outputs_this_month")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return { allowed: true, tier, used: 0 }; // no record yet = new user
  const msgUsed = data.messages_this_month ?? 0;
  if (type === "message" && msgUsed >= FREE_MSG_LIMIT) {
    return { allowed: false, reason: "message_limit", tier, used: msgUsed };
  }
  if (type === "forge" && (data.forge_outputs_this_month ?? 0) >= 3) {
    return { allowed: false, reason: "forge_limit", tier, used: data.forge_outputs_this_month ?? 0 };
  }
  return { allowed: true, tier, used: type === "message" ? msgUsed : (data.forge_outputs_this_month ?? 0) };
}

export async function checkClassLimit(userId) {
  const tier = await getUserTier(userId);
  if (tier === "pro") return { allowed: true };
  const { count, error } = await supabase
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) return { allowed: true }; // fail open
  if ((count ?? 0) >= 3) return { allowed: false, reason: "class_limit" };
  return { allowed: true };
}

// Count notebooks the user OWNS (created/role=owner). Pro = unlimited; Free = 3.
export async function countOwnedNotebooks(userId) {
  const { count, error } = await supabase
    .from("notebook_members")
    .select("notebook_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "owner");
  if (error) return 0;
  return count ?? 0;
}

export async function checkNotebookLimit(userId) {
  const tier = await getUserTier(userId);
  if (tier === "pro") return { allowed: true };
  const count = await countOwnedNotebooks(userId);
  if (count >= 3) return { allowed: false, reason: "notebook_limit" };
  return { allowed: true };
}

export async function incrementUsage(userId, type, amount = 1) {
  // Image usage is isolated (own upsert) so the images_this_month column never
  // appears in the message/forge insert path — keeps existing metering safe.
  if (type === "image") {
    const { data: existing } = await supabase
      .from("usage").select("id, images_this_month").eq("user_id", userId).maybeSingle();
    if (existing) {
      await supabase.from("usage").update({
        images_this_month: (existing.images_this_month ?? 0) + amount,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
    } else {
      const nextReset = new Date();
      nextReset.setMonth(nextReset.getMonth() + 1);
      nextReset.setDate(1);
      nextReset.setHours(0, 0, 0, 0);
      await supabase.from("usage").insert({
        user_id: userId,
        images_this_month: amount,
        reset_at: nextReset.toISOString(),
      });
    }
    return;
  }

  const field = type === "message" ? "messages_this_month" : "forge_outputs_this_month";
  const { data: existing } = await supabase
    .from("usage")
    .select(`id, ${field}`)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    await supabase.from("usage").update({
      [field]: (existing[field] ?? 0) + amount,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
  } else {
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);
    await supabase.from("usage").insert({
      user_id: userId,
      messages_this_month: type === "message" ? 1 : 0,
      forge_outputs_this_month: type === "forge" ? 1 : 0,
      reset_at: nextReset.toISOString(),
    });
  }
}
