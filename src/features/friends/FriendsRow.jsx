import { useCallback, useEffect, useState } from "react";
import { api } from "../../api.js";
import { UserPlus } from "lucide-react";
import { Avatar } from "../../ui/Avatar.jsx";
import { FONT } from "../../lib/theme.js";
import AddFriendModal from "../../AddFriendModal.jsx";
import { FriendActionModal, FriendInviteModal } from "./FriendModals.jsx";

/* Friends, on the dashboard rather than folded into a sidebar nobody opens.
   Studying together is the point of the app, so it sits above the classes:
   who's online, who's waiting on an answer, and one obvious way to add
   someone. Requests are answered in place — they used to be reachable only
   from the activity feed further down the page. */
export function FriendsRow({ refreshSignal = 0, onChanged }) {
  const BEST = ["\u{1F947}", "\u{1F948}", "\u{1F949}"]; // top three, by shared-notebook activity
  const [friends, setFriends]   = useState([]);
  const [bestIds, setBestIds]   = useState({});
  const [requests, setRequests] = useState([]);
  const [showAdd, setShowAdd]   = useState(false);
  const [actionFor, setActionFor] = useState(null);
  const [inviteFor, setInviteFor] = useState(null);
  const [busyId, setBusyId]     = useState(null);

  const refresh = useCallback(async () => {
    const [f, rq, best] = await Promise.all([
      api.getFriends().catch(() => []),
      api.getFriendRequests().catch(() => []),
      api.getBestFriends().catch(() => []),
    ]);
    setFriends(f ?? []);
    setRequests(rq ?? []);
    setBestIds(Object.fromEntries((best ?? []).slice(0, 3).map((b, i) => [b.userId, i])));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (refreshSignal) refresh(); }, [refreshSignal, refresh]);

  async function respond(requestId, action) {
    setBusyId(requestId);
    setRequests(prev => prev.filter(r => r.requestId !== requestId)); // optimistic
    try { await api.respondToFriend(requestId, action); onChanged?.(); }
    catch { refresh(); }                                             // put it back
    finally { setBusyId(null); }
  }

  const online = friends.filter(f => f.isOnline).length;

  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h2 style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
          color: "var(--text-tertiary)", fontFamily: FONT, margin: 0,
        }}>Friends</h2>
        {online > 0 && (
          <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: FONT }}>
            {online} online
          </span>
        )}
        <button
          onClick={() => setShowAdd(true)}
          className="btn-press"
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            height: 36, padding: "0 14px", cursor: "pointer", flexShrink: 0,
            background: "var(--acc-bg)", border: "1px solid var(--accent)",
            color: "var(--acc-h)", fontFamily: FONT, fontSize: 13.5, fontWeight: 600,
          }}
        ><UserPlus size={15} strokeWidth={1.95} /> Add friend</button>
        <span style={{ flex: 1 }} />
      </div>

      {requests.map(r => (
        <div key={r.requestId} style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 8,
          padding: "10px 14px", minHeight: 56,
          background: "var(--acc-bg)", border: "1px solid var(--accent)", fontFamily: FONT,
        }}>
          <Avatar name={r.fromName} size={32} seed={r.fromUsername || r.fromUserId} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: "var(--text-primary)" }}>
            <b style={{ fontWeight: 600 }}>{r.fromName}</b> wants to be friends
          </span>
          <button
            onClick={() => respond(r.requestId, "accept")}
            disabled={busyId === r.requestId}
            className="btn-press"
            style={{
              height: 36, padding: "0 16px", cursor: "pointer", flexShrink: 0,
              background: "var(--accent)", border: "none", color: "#fff",
              fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
            }}
          >Accept</button>
          <button
            onClick={() => respond(r.requestId, "decline")}
            disabled={busyId === r.requestId}
            className="btn-press"
            style={{
              height: 36, padding: "0 14px", cursor: "pointer", flexShrink: 0,
              background: "transparent", border: "1px solid var(--border-strong)",
              color: "var(--text-secondary)", fontFamily: FONT, fontSize: 13.5, fontWeight: 500,
            }}
          >Ignore</button>
        </div>
      ))}

      {friends.length === 0 ? (
        <p style={{
          margin: 0, fontSize: 13.5, color: "var(--text-tertiary)",
          fontFamily: FONT, lineHeight: 1.5,
        }}>
          Scholr works best with your study group. Add a friend to share notes and
          quiz each other.
        </p>
      ) : (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {friends.map(f => (
            <button
              key={f.userId}
              onClick={() => setActionFor(f)}
              className="btn-press"
              title={f.isOnline ? `${f.name} — active now` : f.name}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
                width: 84, flexShrink: 0, padding: "12px 6px", cursor: "pointer",
                background: "var(--bg-surface-1)", border: "1px solid var(--border-subtle)",
                fontFamily: FONT,
              }}
            >
              <span style={{ position: "relative", display: "inline-flex" }}>
                <Avatar name={f.name} size={38} seed={f.username || f.userId} />
                <span style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 11, height: 11, borderRadius: "50%",
                  background: f.isOnline ? "#34D399" : "#6B7280",
                  border: "2px solid var(--bg-base)",
                }} />
                {bestIds[f.userId] !== undefined && (
                  <span
                    title="One of your best study partners"
                    style={{ position: "absolute", top: -4, left: -6, fontSize: 13, lineHeight: 1 }}
                  >{BEST[bestIds[f.userId]]}</span>
                )}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 500, color: "var(--text-secondary)",
                maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{f.name}</span>
            </button>
          ))}
        </div>
      )}

      {showAdd && <AddFriendModal onClose={() => setShowAdd(false)} onChanged={() => { refresh(); onChanged?.(); }} />}
      {actionFor && (
        <FriendActionModal
          friend={actionFor}
          onClose={() => setActionFor(null)}
          onInvite={() => { setInviteFor(actionFor); setActionFor(null); }}
          onChanged={() => { refresh(); onChanged?.(); }}
        />
      )}
      {inviteFor && <FriendInviteModal friend={inviteFor} onClose={() => setInviteFor(null)} />}
    </section>
  );
}
