import { useEffect, useRef, useState, useCallback } from "react";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "../supabase.js";

// Supabase Realtime, built into supabase-js — no new dependency, and the CSP
// already allows wss://…supabase.co. Two live primitives sit here:
//
//   1. Friend presence pings (feature A) — additive over the 60s heartbeat/poll.
//      A payload-free "changed" ping makes positive changes (a friend comes
//      online, or opens a shared notebook) show up in ~1s; polling stays as the
//      offline / safety net, so if Realtime is unavailable behaviour is exactly
//      as before. The ping carries NO data: receivers refetch the AUTHORIZED
//      /api/friends + members endpoints, so every presence filter stays
//      server-side and "a notebook you can't open never surfaces" is untouched.
//
//   2. Study rooms (feature C) — Realtime Presence tracks a live roster for a
//      shared notebook, and broadcast syncs a shared timer.
//
// ponytail: pings are a refetch trigger, not a data channel; rooms carry only a
// display name + timer among people who opted into the same shared notebook.

// ── Friend presence (A) ──────────────────────────────────────────────────────
const presenceTopic = (userId) => `presence:${userId}`;

// Subscribe to my own topic; onPing() fires whenever a friend nudges it.
export function useIncomingPresence(myUserId, onPing) {
  const cb = useRef(onPing);
  useEffect(() => { cb.current = onPing; });
  useEffect(() => {
    if (!myUserId) return undefined;
    const ch = supabase
      .channel(presenceTopic(myUserId))
      .on("broadcast", { event: "changed" }, () => cb.current?.())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [myUserId]);
}

// Tell my friends my presence changed. One fire-and-forget REST broadcast for
// the whole fan-out (no per-friend channel juggling). Best-effort by design —
// a dropped ping just means a friend updates on their next poll instead.
export async function pingFriends(friendIds) {
  const ids = (friendIds || []).filter(Boolean);
  if (!ids.length) return;
  try {
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({
        messages: ids.map((id) => ({ topic: presenceTopic(id), event: "changed", payload: {} })),
      }),
    });
  } catch { /* best effort — polling is the fallback */ }
}

// ── Study rooms (C) ──────────────────────────────────────────────────────────
export const roomTopic = (roomId) => `room:${roomId}`;

// Join a study room: track my presence so everyone sees a live roster (join/leave
// is automatic on connect/disconnect), and expose a shared timer synced over the
// same channel. `me` = { userId, name }. Returns { members, timer, startTimer,
// clearTimer, connected, battle, answers, startBattle, submitAnswer, endBattle }.
//
// Quiz battles ride the same channel as the timer, same trick: whoever starts
// one broadcasts a schedule (startsAt + roundMs + cards), and every client
// derives "what round is it now" from the wall clock — no host bookkeeping,
// no DB, still works if the starter leaves mid-battle. `broadcast: { self:
// true }` so the sender also sees its own answers land in the tally.
export function useStudyRoom(roomId, me, enabled) {
  const [members, setMembers] = useState([]);
  const [timer, setTimer] = useState(null); // { phase, endsAt, minutes } | null
  const [connected, setConnected] = useState(false);
  const [battle, setBattle] = useState(null); // { battleId, cards, startsAt, roundMs } | null
  const [answers, setAnswers] = useState({}); // { [round]: { [userId]: { name, at } } }
  const [feynmanShares, setFeynmanShares] = useState([]); // last few { id, name, concept, score, verdict, at }
  const [feynmanReactions, setFeynmanReactions] = useState({}); // { [shareId]: { [userId]: { name, emoji } } }
  const chRef = useRef(null);
  const timerRef = useRef(null);
  useEffect(() => { timerRef.current = timer; }, [timer]);

  useEffect(() => {
    if (!enabled || !roomId || !me?.userId) return undefined;
    const ch = supabase.channel(roomTopic(roomId), {
      config: { presence: { key: me.userId }, broadcast: { self: true } },
    });
    chRef.current = ch;

    const roster = () => {
      const state = ch.presenceState();
      // One entry per user even if they have two tabs open.
      const seen = new Map();
      for (const key of Object.keys(state)) {
        for (const m of state[key]) if (m.userId) seen.set(m.userId, { userId: m.userId, name: m.name });
      }
      setMembers([...seen.values()]);
    };

    ch.on("presence", { event: "sync" }, roster);
    // Timer changes broadcast to everyone; late joiners get the current state
    // when the host answers a "whats-the-timer" request on join.
    ch.on("broadcast", { event: "timer" }, ({ payload }) => setTimer(payload?.timer ?? null));
    ch.on("broadcast", { event: "timer-req" }, () => {
      if (timerRef.current) ch.send({ type: "broadcast", event: "timer", payload: { timer: timerRef.current } });
    });
    ch.on("broadcast", { event: "battle-start" }, ({ payload }) => { setBattle(payload); setAnswers({}); });
    ch.on("broadcast", { event: "battle-answer" }, ({ payload }) => {
      setAnswers(prev => {
        const round = prev[payload.round] || {};
        if (round[payload.userId]) return prev; // first answer per round only
        return { ...prev, [payload.round]: { ...round, [payload.userId]: { name: payload.name, at: payload.at } } };
      });
    });
    ch.on("broadcast", { event: "battle-end" }, () => setBattle(null));
    // A Feynman explanation shared into the room (see shareFeynmanToRoom —
    // the sender doesn't need to have joined this room's presence to send
    // one, so a solo grading moment can become a shared one on demand).
    ch.on("broadcast", { event: "feynman-share" }, ({ payload }) => {
      setFeynmanShares(prev => [payload, ...prev].slice(0, 5));
    });
    ch.on("broadcast", { event: "feynman-react" }, ({ payload }) => {
      setFeynmanReactions(prev => ({
        ...prev,
        [payload.shareId]: { ...prev[payload.shareId], [payload.userId]: { name: payload.name, emoji: payload.emoji } },
      }));
    });

    ch.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      setConnected(true);
      await ch.track({ userId: me.userId, name: me.name || "Someone" });
      ch.send({ type: "broadcast", event: "timer-req", payload: {} });
    });

    return () => { setConnected(false); chRef.current = null; supabase.removeChannel(ch); };
  }, [enabled, roomId, me?.userId, me?.name]);

  const startTimer = useCallback((minutes) => {
    const t = { phase: "focus", minutes, endsAt: Date.now() + minutes * 60_000 };
    setTimer(t);
    chRef.current?.send({ type: "broadcast", event: "timer", payload: { timer: t } });
  }, []);

  const clearTimer = useCallback(() => {
    setTimer(null);
    chRef.current?.send({ type: "broadcast", event: "timer", payload: { timer: null } });
  }, []);

  const startBattle = useCallback((cards, roundMs = 12000) => {
    const b = { battleId: crypto.randomUUID(), cards, startsAt: Date.now(), roundMs };
    chRef.current?.send({ type: "broadcast", event: "battle-start", payload: b });
  }, []);

  const submitAnswer = useCallback((round) => {
    if (!me?.userId) return;
    chRef.current?.send({
      type: "broadcast", event: "battle-answer",
      payload: { round, userId: me.userId, name: me.name || "Someone", at: Date.now() },
    });
  }, [me]);

  const endBattle = useCallback(() => {
    chRef.current?.send({ type: "broadcast", event: "battle-end", payload: {} });
  }, []);

  const reactToFeynman = useCallback((shareId, emoji) => {
    if (!me?.userId) return;
    chRef.current?.send({
      type: "broadcast", event: "feynman-react",
      payload: { shareId, userId: me.userId, name: me.name || "Someone", emoji },
    });
  }, [me]);

  return {
    members, timer, startTimer, clearTimer, connected, battle, answers, startBattle, submitAnswer, endBattle,
    feynmanShares, feynmanReactions, reactToFeynman,
  };
}

// One-shot broadcast into a study room's channel, for a moment (like a graded
// Feynman explanation) that didn't originate from someone who has joined
// that room's presence via useStudyRoom. Opens a channel just long enough to
// flush the send, then tears it down — no lingering subscription.
export async function shareFeynmanToRoom(notebookId, share) {
  const ch = supabase.channel(roomTopic(notebookId), { config: { broadcast: { self: true } } });
  await new Promise(resolve => ch.subscribe(status => { if (status === "SUBSCRIBED") resolve(); }));
  await ch.send({ type: "broadcast", event: "feynman-share", payload: share });
  supabase.removeChannel(ch);
}
