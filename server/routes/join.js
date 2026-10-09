// Class PINs: Kahoot's game-PIN idea for study groups. Paste one link (or say
// six characters) in the class group chat; whoever opens it joins every unit
// in the class and becomes friends with the person who shared it.
//
// The PIN is derived, not stored: an HMAC of the class id, so no migration and
// nothing to keep in sync. Looking one up scans the classes table.
// ponytail: O(classes) scan per join; add classes.join_code + a unique index
// once there are tens of thousands of classes.
import { Router } from "express";
import { createHmac } from "crypto";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { requireAuth } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { appOrigin } from "../lib/urls.js";
import { isBlockedBetween, orderedPair, pushNotification, resolveUserBrief } from "../lib/users.js";
import { trackEvent } from "../lib/analytics.js";

export const router = Router();

// No 0/O or 1/I/L, so a PIN read aloud can't be misheard.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const SECRET = process.env.PIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-only";

export function classPin(classId) {
  const digest = createHmac("sha256", SECRET).update(`class-pin:${classId}`).digest();
  let pin = "";
  for (let i = 0; i < 6; i++) pin += ALPHABET[digest[i] % ALPHABET.length];
  return pin;
}

export const normalizePin = (raw) => String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

async function findClassByPin(pin) {
  if (!/^[A-Z0-9]{6}$/.test(pin)) return null;
  const { data } = await supabase.from("classes").select("id, user_id, title");
  return (data ?? []).find(c => classPin(c.id) === pin) ?? null;
}

// Guessing a PIN would mean walking a ~900M space; this keeps it that way.
const joinLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyGenerator: req => req.user?.id ?? ipKeyGenerator(req.ip),
  standardHeaders: true, legacyHeaders: false,
  message: { error: "rate_limited", message: "Too many PIN attempts. Try again in a few minutes." },
});

// GET /api/classes/:id/pin — the owner's PIN and link for a class.
router.get("/api/classes/:id/pin", requireAuth, async (req, res) => {
  const { data: cls } = await supabase.from("classes").select("id, user_id").eq("id", req.params.id).maybeSingle();
  if (!cls || cls.user_id !== req.user.id) return res.status(404).json({ error: "Class not found" });
  const pin = classPin(cls.id);
  res.json({ pin, link: `${appOrigin()}/join/${pin}` });
});

// GET /api/join/:pin — what you'd be joining, so the app can ask first.
router.get("/api/join/:pin", requireAuth, joinLimiter, async (req, res) => {
  const cls = await findClassByPin(normalizePin(req.params.pin));
  if (!cls) return res.status(404).json({ error: "not_found", message: "No class has that PIN. Check it and try again." });
  const [{ count }, owner] = await Promise.all([
    supabase.from("notebooks").select("id", { count: "exact", head: true }).eq("class_id", cls.id),
    resolveUserBrief(cls.user_id),
  ]);
  res.json({ classTitle: cls.title, ownerName: owner.name || owner.username || "A classmate", units: count ?? 0, isOwner: cls.user_id === req.user.id });
});

// POST /api/join/:pin — join every unit in the class and befriend its owner.
router.post("/api/join/:pin", requireAuth, joinLimiter, async (req, res) => {
  const me = req.user.id;
  const cls = await findClassByPin(normalizePin(req.params.pin));
  if (!cls) return res.status(404).json({ error: "not_found", message: "No class has that PIN. Check it and try again." });
  if (cls.user_id === me) return res.status(400).json({ error: "own_class", message: "That's your own class." });
  if (await isBlockedBetween(me, cls.user_id)) return res.status(404).json({ error: "not_found", message: "No class has that PIN. Check it and try again." });

  const { data: units } = await supabase.from("notebooks").select("id").eq("class_id", cls.id).order("created_at");
  const ids = (units ?? []).map(u => u.id);
  if (ids.length) {
    const { data: existing } = await supabase.from("notebook_members").select("notebook_id").eq("user_id", me).in("notebook_id", ids);
    const have = new Set((existing ?? []).map(r => r.notebook_id));
    const rows = ids.filter(id => !have.has(id)).map(id => ({ notebook_id: id, user_id: me, role: "member" }));
    if (rows.length) {
      const { error } = await supabase.from("notebook_members").insert(rows);
      if (error) return res.status(500).json({ error: error.message });
    }
  }

  const [a, b] = orderedPair(me, cls.user_id);
  const { data: already } = await supabase.from("friendships").select("user_a").eq("user_a", a).eq("user_b", b).maybeSingle();
  let newFriend = false;
  if (!already) {
    const { error } = await supabase.from("friendships").insert({ user_a: a, user_b: b });
    newFriend = !error;
  }
  const meBrief = await resolveUserBrief(me);
  // Sent as friend_accepted (a type the table's CHECK already allows — no
  // migration); classTitle in the payload is what the bell words differently.
  pushNotification(cls.user_id, "friend_accepted", { fromUserId: me, fromUsername: meBrief.username || meBrief.name, classTitle: cls.title });
  trackEvent(me, "class_joined_by_pin", { classId: cls.id, units: ids.length, newFriend });
  res.json({ classTitle: cls.title, notebookIds: ids, firstNotebookId: ids[0] ?? null, newFriend });
});
