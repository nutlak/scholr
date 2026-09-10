import { useCallback, useEffect, useState } from "react";
import { api } from "../../api.js";
import { ChevronDown, Flame, UserPlus } from "lucide-react";
import { Avatar } from "../../ui/Avatar.jsx";
import { FONT } from "../../lib/theme.js";
import AddFriendModal from "../../AddFriendModal.jsx";

const BEST_FRIEND_RANKS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

// ── FriendsSidebarSection ─────────────────────────────────────────────────────
// Two collapsible sidebar blocks: Friends (current friends + add button + pending
// request badge) and Best Friends (top 5 by shared-notebook activity). Self-
// contained: loads its own data and refreshes after request actions.
export function FriendsSidebarSection({ refreshSignal = 0 }) {
  const [friends, setFriends]         = useState([]);
  const [bestFriends, setBestFriends] = useState([]);
  const [requests, setRequests]       = useState([]);
  const [open, setOpen]               = useState(true);
  const [showAdd, setShowAdd]         = useState(false);
  const [inviteFor, setInviteFor]     = useState(null); // friend whose notebook-picker is open
  const [actionFor, setActionFor]     = useState(null); // friend whose action menu is open
  const [myUsername, setMyUsername]   = useState(null); // own handle, shown in the header

  const refresh = useCallback(async () => {
    const [f, bf, rq] = await Promise.all([
      api.getFriends().catch(() => []),
      api.getBestFriends().catch(() => []),
      api.getFriendRequests().catch(() => []),
    ]);
    setFriends(f ?? []);
    setBestFriends(bf ?? []);
    setRequests(rq ?? []);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  // Re-fetch when the parent bumps the signal (e.g. a request accepted from the
  // Recent Activity feed) — only on a real bump, not the initial 0.
  useEffect(() => { if (refreshSignal) refresh(); }, [refreshSignal, refresh]);
  useEffect(() => { api.getMyUsername().then(d => setMyUsername(d?.username ?? null)).catch(() => {}); }, []);

  const sectionLabel = {
    fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
    color: "var(--text-tertiary)", fontFamily: FONT,
  };
  const rowStyle = {
    display: "flex", alignItems: "center", gap: 9,
    padding: "0 12px", height: 32, borderRadius: 8,
    color: "var(--text-secondary)", fontSize: 13, fontWeight: 500,
    cursor: "pointer", userSelect: "none", letterSpacing: "-0.01em",
    transition: "background 150ms ease, color 150ms ease",
  };
  const hoverOn = e => { e.currentTarget.style.background = "var(--bg-surface-2)"; e.currentTarget.style.color = "var(--text-primary)"; };
  const hoverOff = e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; };

  return (
    <>
      {/* ── Friends header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 12px 6px" }}>
        <div
          onClick={() => setOpen(o => !o)}
          style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flex: 1, minWidth: 0 }}
        >
          <ChevronDown
            size={13} strokeWidth={2}
            style={{ color: "var(--text-tertiary)", transform: open ? "none" : "rotate(-90deg)", transition: "transform 150ms ease" }}
          />
          <span style={sectionLabel}>Friends</span>
          {myUsername && (
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT, opacity: 0.75 }}>@{myUsername}</span>
          )}
          {requests.length > 0 && (
            <span style={{
              minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8,
              background: "#F87171", color: "#fff", fontSize: 10, fontWeight: 700,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontFamily: FONT,
            }}>{requests.length}</span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          title="Add friend"
          aria-label="Add friend"
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--text-tertiary)", display: "flex", alignItems: "center",
            padding: 2, borderRadius: 6,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
        >
          <UserPlus size={15} strokeWidth={1.85} />
        </button>
      </div>

      {open && (
        <>
          {/* Friend list */}
          {friends.length === 0 ? (
            <div style={{ padding: "2px 12px 8px", fontSize: 12, color: "var(--text-tertiary)", fontFamily: FONT, opacity: 0.7 }}>
              No friends yet
            </div>
          ) : (
            friends.map(f => (
              <div
                key={f.userId} className="friend-sidebar-row" style={rowStyle}
                onClick={() => setActionFor(f)}
                title={f.isOnline ? `${f.name} — active now` : f.name}
                onMouseEnter={hoverOn} onMouseLeave={hoverOff}
              >
                <span style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>
                  <Avatar name={f.name} size={22} seed={f.username || f.userId} />
                  <span style={{
                    position: "absolute", bottom: -1, right: -1,
                    width: 9, height: 9, borderRadius: "50%",
                    background: f.isOnline ? "#34D399" : "#6B7280",
                    border: "2px solid var(--bg-base)",
                  }} />
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              </div>
            ))
          )}

          {/* ── Best Friends ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "14px 12px 6px" }}>
            <Flame size={13} strokeWidth={2} style={{ color: "var(--text-tertiary)" }} />
            <span style={sectionLabel}>Best Friends</span>
          </div>
          {bestFriends.length === 0 ? (
            <div style={{ padding: "2px 12px 8px", fontSize: 12, color: "var(--text-tertiary)", fontFamily: FONT, opacity: 0.7, lineHeight: 1.45 }}>
              Add friends to see your best friends
            </div>
          ) : (
            bestFriends.slice(0, 5).map((f, i) => (
              <div key={f.userId} className="friend-sidebar-row" style={rowStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                <span style={{ width: 18, textAlign: "center", fontSize: 13, flexShrink: 0 }}>{BEST_FRIEND_RANKS[i]}</span>
                <Avatar name={f.name} size={22} seed={f.username || f.userId} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              </div>
            ))
          )}
        </>
      )}

      {showAdd && (
        <AddFriendModal onClose={() => setShowAdd(false)} onChanged={refresh} />
      )}
      {actionFor && (
        <FriendActionModal
          friend={actionFor}
          onClose={() => setActionFor(null)}
          onInvite={() => { setInviteFor(actionFor); setActionFor(null); }}
          onChanged={refresh}
        />
      )}
      {inviteFor && (
        <FriendInviteModal friend={inviteFor} onClose={() => setInviteFor(null)} />
      )}
    </>
  );
}
// ── FriendActionModal ─────────────────────────────────────────────────────────
// Per-friend action menu: invite to a notebook, remove, or block — the last two
// behind an inline confirm step so they aren't one-tap accidents.
export function FriendActionModal({ friend, onClose, onInvite, onChanged }) {
  const [view, setView] = useState("menu"); // menu | confirmRemove | confirmBlock
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function doRemove() {
    setBusy(true); setError("");
    try { await api.removeFriend(friend.userId); onChanged?.(); onClose(); }
    catch (e) { setError(e.message || "Failed to remove friend"); setBusy(false); }
  }
  async function doBlock() {
    setBusy(true); setError("");
    try { await api.blockUser(friend.userId); onChanged?.(); onClose(); }
    catch (e) { setError(e.message || "Failed to block user"); setBusy(false); }
  }

  const btn = (bg, border, color) => ({
    width: "100%", minHeight: 44, borderRadius: 10, border, background: bg, color,
    fontWeight: 600, fontSize: 13.5, fontFamily: FONT, cursor: busy ? "default" : "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    opacity: busy ? 0.7 : 1, transition: "all 0.15s",
  });

  return (
    <div
      className="mobile-sheet-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1050, padding: 16,
      }}
    >
      <div className="mobile-sheet" style={{
        background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
        border: "1px solid rgba(255,255,255,0.09)", borderRadius: 18,
        width: "100%", maxWidth: 380, padding: "22px 20px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(167,139,250,0.08)",
        animation: "fadeIn 0.2s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
          <span style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>
            <Avatar name={friend.name} size={38} seed={friend.username || friend.userId} />
            <span style={{
              position: "absolute", bottom: -1, right: -1, width: 11, height: 11, borderRadius: "50%",
              background: friend.isOnline ? "#34D399" : "#6B7280", border: "2.5px solid #14141F",
            }} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 600, color: "#F5F5FA", fontFamily: FONT, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{friend.name}</div>
            <div style={{ fontSize: 12, color: friend.isOnline ? "#6EE7B7" : "rgba(245,245,250,0.45)", fontFamily: FONT }}>
              {friend.isOnline ? "Active now" : (friend.username ? `@${friend.username}` : "Offline")}
            </div>
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 12.5, color: "#F87171", fontFamily: FONT, marginBottom: 12 }}>{error}</div>
        )}

        {view === "menu" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={onInvite} style={btn("rgba(167,139,250,0.14)", "1px solid rgba(167,139,250,0.32)", "#C4B5FD")}>
              Invite to notebook
            </button>
            <button onClick={() => setView("confirmRemove")} style={btn("transparent", "1px solid rgba(255,255,255,0.12)", "rgba(245,245,250,0.8)")}>
              Remove friend
            </button>
            <button onClick={() => setView("confirmBlock")} style={btn("rgba(248,113,113,0.08)", "1px solid rgba(248,113,113,0.28)", "#F87171")}>
              Block
            </button>
          </div>
        )}

        {view === "confirmRemove" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13.5, color: "rgba(245,245,250,0.8)", fontFamily: FONT, lineHeight: 1.5 }}>
              Remove <strong style={{ color: "#F5F5FA" }}>{friend.name}</strong> from your friends?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setView("menu")} disabled={busy} style={{ ...btn("transparent", "1px solid rgba(255,255,255,0.12)", "rgba(245,245,250,0.65)"), flex: 1 }}>Cancel</button>
              <button onClick={doRemove} disabled={busy} style={{ ...btn("rgba(248,113,113,0.14)", "1px solid rgba(248,113,113,0.4)", "#F87171"), flex: 1 }}>{busy ? "Removing…" : "Remove"}</button>
            </div>
          </div>
        )}

        {view === "confirmBlock" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13.5, color: "rgba(245,245,250,0.8)", fontFamily: FONT, lineHeight: 1.5 }}>
              Block <strong style={{ color: "#F5F5FA" }}>{friend.name}</strong>? This also removes them from your friends and they won't be able to send you requests.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setView("menu")} disabled={busy} style={{ ...btn("transparent", "1px solid rgba(255,255,255,0.12)", "rgba(245,245,250,0.65)"), flex: 1 }}>Cancel</button>
              <button onClick={doBlock} disabled={busy} style={{ ...btn("rgba(248,113,113,0.14)", "1px solid rgba(248,113,113,0.4)", "#F87171"), flex: 1 }}>{busy ? "Blocking…" : "Block"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// ── FriendInviteModal ─────────────────────────────────────────────────────────
// Pick one of the current user's notebooks to add a friend to directly.
export function FriendInviteModal({ friend, onClose }) {
  const [notebooks, setNotebooks] = useState(null); // null = loading
  const [state, setState] = useState({}); // notebookId → 'busy' | 'done' | 'error'

  useEffect(() => {
    let cancelled = false;
    api.listNotebooks()
      .then(nbs => { if (!cancelled) setNotebooks(nbs ?? []); })
      .catch(() => { if (!cancelled) setNotebooks([]); });
    return () => { cancelled = true; };
  }, []);

  async function invite(nbId) {
    setState(s => ({ ...s, [nbId]: "busy" }));
    try {
      await api.inviteFriendToNotebook(nbId, friend.userId);
      setState(s => ({ ...s, [nbId]: "done" }));
    } catch {
      setState(s => ({ ...s, [nbId]: "error" }));
    }
  }

  return (
    <div
      className="mobile-sheet-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 16,
      }}
    >
      <div className="mobile-sheet" style={{
        position: "relative",
        background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 18, width: "100%", maxWidth: 420,
        maxHeight: "80vh", display: "flex", flexDirection: "column",
        padding: "24px 22px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(167,139,250,0.08)",
        animation: "fadeIn 0.2s ease", overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Avatar name={friend.name} size={34} seed={friend.username || friend.userId} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#F5F5FA", fontFamily: FONT, letterSpacing: "-0.02em" }}>
              Invite {friend.name}
            </div>
            <div style={{ fontSize: 12.5, color: "rgba(245,245,250,0.5)", fontFamily: FONT }}>
              Choose a notebook to share
            </div>
          </div>
          <button
            onClick={onClose} aria-label="Close"
            style={{
              marginLeft: "auto", background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, width: 30, height: 30, cursor: "pointer",
              color: "rgba(245,245,250,0.6)", fontSize: 15, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>

        <div style={{ overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {notebooks === null ? (
            <div style={{ fontSize: 13, color: "rgba(245,245,250,0.4)", fontFamily: FONT, padding: "8px 2px" }}>Loading…</div>
          ) : notebooks.length === 0 ? (
            <div style={{ fontSize: 13, color: "rgba(245,245,250,0.4)", fontFamily: FONT, padding: "8px 2px" }}>
              You don't have any notebooks yet.
            </div>
          ) : (
            notebooks.map(nb => {
              const st = state[nb.id];
              const done = st === "done";
              return (
                <div key={nb.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 11px", borderRadius: 10,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#F5F5FA", fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nb.title}</div>
                    {nb.topic && <div style={{ fontSize: 11.5, color: "rgba(245,245,250,0.45)", fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nb.topic}</div>}
                  </div>
                  <button
                    onClick={() => invite(nb.id)}
                    disabled={st === "busy" || done}
                    style={{
                      flexShrink: 0,
                      background: done ? "rgba(52,211,153,0.14)" : "rgba(167,139,250,0.14)",
                      border: `1px solid ${done ? "rgba(52,211,153,0.32)" : "rgba(167,139,250,0.32)"}`,
                      borderRadius: 8, padding: "6px 12px",
                      color: done ? "#6EE7B7" : "#C4B5FD",
                      fontWeight: 600, fontSize: 12, fontFamily: FONT,
                      cursor: st === "busy" || done ? "default" : "pointer",
                      opacity: st === "busy" ? 0.7 : 1,
                    }}
                  >
                    {st === "busy" ? "…" : done ? "Invited!" : st === "error" ? "Retry" : "Invite"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
