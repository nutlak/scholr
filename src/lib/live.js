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
// clearTimer, connected }.
export function useStudyRoom(roomId, me, enabled) {
  const [members, setMembers] = useState([]);
  const [timer, setTimer] = useState(null); // { phase, endsAt, minutes } | null
  const [connected, setConnected] = useState(false);
  const chRef = useRef(null);
  const timerRef = useRef(null);
  useEffect(() => { timerRef.current = timer; }, [timer]);

  useEffect(() => {
    if (!enabled || !roomId || !me?.userId) return undefined;
    const ch = supabase.channel(roomTopic(roomId), {
      config: { presence: { key: me.userId } },
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

  return { members, timer, startTimer, clearTimer, connected };
}
