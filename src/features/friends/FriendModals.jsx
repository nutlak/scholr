import { useEffect, useState } from "react";
import { api } from "../../api.js";
import { FONT } from "../../lib/theme.js";
import { Avatar } from "../../ui/Avatar.jsx";

// ── FriendActionModal ─────────────────────────────────────────────────────────
// Per-friend action menu: invite to a notebook, remove, or block — the last two
// behind an inline confirm step so they aren't one-tap accidents.
export function FriendActionModal({ friend, onClose, onInvite, onChanged, onOpenNotebook }) {
  const [view, setView] = useState("menu"); // menu | confirmRemove | confirmBlock
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shared, setShared] = useState(null); // null = loading

  // What you two actually work on together — the reason to open this at all.
  useEffect(() => {
    let cancelled = false;
    api.getSharedNotebooks(friend.userId)
      .then(rows => { if (!cancelled) setShared(rows ?? []); })
      .catch(() => { if (!cancelled) setShared([]); });
    return () => { cancelled = true; };
  }, [friend.userId]);

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
            <div style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              color: "rgba(245,245,250,0.45)", fontFamily: FONT, marginBottom: 2,
            }}>
              {shared === null ? "Shared notebooks" : `${shared.length} shared notebook${shared.length === 1 ? "" : "s"}`}
            </div>

            {shared === null && (
              <div className="shimmer" style={{ fontSize: 13, fontFamily: FONT, padding: "4px 0" }}>Loading…</div>
            )}
            {shared?.length === 0 && (
              <div style={{ fontSize: 13, color: "rgba(245,245,250,0.5)", fontFamily: FONT, lineHeight: 1.5, marginBottom: 4 }}>
                Nothing yet. Invite {friend.name.split(" ")[0]} to a notebook and you can study it together.
              </div>
            )}
            {shared?.slice(0, 4).map(nb => (
              <button
                key={nb.id}
                onClick={() => { onOpenNotebook?.(nb.id); onClose(); }}
                style={{
                  ...btn("rgba(255,255,255,0.03)", "1px solid rgba(255,255,255,0.09)", "#F5F5FA"),
                  justifyContent: "space-between", padding: "0 14px", fontWeight: 500,
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nb.title}</span>
                <span style={{ color: "rgba(245,245,250,0.4)", flexShrink: 0 }}>&rarr;</span>
              </button>
            ))}

            <button onClick={onInvite} style={{ ...btn("rgba(167,139,250,0.14)", "1px solid rgba(167,139,250,0.32)", "#C4B5FD"), marginTop: 4 }}>
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
            <div className="shimmer" style={{ fontSize: 13, fontFamily: FONT, padding: "8px 2px" }}>Loading…</div>
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
