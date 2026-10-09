import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "./api.js";
import { useEscape } from "./ui/useEscape.js";
import { FONT } from "./lib/theme.js";
import { Avatar } from "./ui/Avatar.jsx";

// Shared row chrome for a person entry.
function PersonRow({ name, sub, seed, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 10px", borderRadius: 10,
      background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)",
    }}>
      <Avatar name={name} seed={seed} size={32} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>{children}</div>
    </div>
  );
}

const pillBtn = (variant = "accent", disabled = false) => {
  const base = {
    borderRadius: 8, padding: "7px 12px", minHeight: 34,
    fontWeight: 600, fontSize: 12, fontFamily: FONT,
    cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.7 : 1,
  };
  if (variant === "green")  return { ...base, background: "rgba(52,211,153,0.14)", border: "1px solid rgba(52,211,153,0.32)", color: "var(--success)" };
  if (variant === "ghost")  return { ...base, background: "transparent", border: "1px solid var(--border-default)", color: "var(--text-secondary)" };
  if (variant === "danger") return { ...base, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "var(--danger)" };
  return { ...base, background: "var(--acc-bg)", border: "1px solid var(--acc)", color: "var(--acc)" };
};

export default function AddFriendModal({ onClose, onChanged }) {
  useEscape(onClose);
  const [tab, setTab] = useState("add"); // 'add' | 'requests' | 'blocked'

  // Add tab
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [requested, setRequested] = useState({}); // userId → 'busy'|'requested'|'pending'|'error'
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  // Requests tab
  const [requests, setRequests] = useState([]);     // incoming
  const [outgoing, setOutgoing] = useState([]);      // sent
  const [respondState, setRespondState] = useState({}); // requestId → 'busy'|'error'
  const [cancelState, setCancelState] = useState({});   // requestId → 'busy'|'error'

  // Blocked tab
  const [blocked, setBlocked] = useState([]);
  const [unblockState, setUnblockState] = useState({}); // userId → 'busy'|'error'

  const loadRequests = useCallback(async () => {
    const [inc, out] = await Promise.all([
      api.getFriendRequests().catch(() => []),
      api.getOutgoingRequests().catch(() => []),
    ]);
    setRequests(inc ?? []);
    setOutgoing(out ?? []);
  }, []);

  const loadBlocked = useCallback(async () => {
    try { setBlocked((await api.getBlockedUsers()) ?? []); } catch { /* keep */ }
  }, []);

  useEffect(() => { loadRequests(); loadBlocked(); }, [loadRequests, loadBlocked]);
  useEffect(() => { if (tab === "add") searchRef.current?.focus(); }, [tab]);

  // Debounced search (300ms).
  useEffect(() => {
    const q = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try { setResults((await api.searchUsers(q)) ?? []); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  async function handleAdd(userId) {
    setRequested(s => ({ ...s, [userId]: "busy" }));
    try {
      const { status } = await api.requestFriend(userId);
      setRequested(s => ({ ...s, [userId]: status === "accepted" ? "pending" : "requested" }));
      if (status === "accepted" || status === "already_friends") onChanged?.();
      loadRequests(); // a fresh pending shows up under Outgoing
    } catch {
      setRequested(s => ({ ...s, [userId]: "error" }));
    }
  }

  async function handleRespond(requestId, action) {
    setRespondState(s => ({ ...s, [requestId]: "busy" }));
    try {
      await api.respondToFriend(requestId, action);
      await loadRequests();
      onChanged?.();
    } catch {
      setRespondState(s => ({ ...s, [requestId]: "error" }));
    }
  }

  async function handleCancel(requestId) {
    setCancelState(s => ({ ...s, [requestId]: "busy" }));
    try {
      await api.cancelFriendRequest(requestId);
      await loadRequests();
    } catch {
      setCancelState(s => ({ ...s, [requestId]: "error" }));
    }
  }

  async function handleUnblock(userId) {
    setUnblockState(s => ({ ...s, [userId]: "busy" }));
    try {
      await api.unblockUser(userId);
      await loadBlocked();
      onChanged?.();
    } catch {
      setUnblockState(s => ({ ...s, [userId]: "error" }));
    }
  }

  const reqCount = requests.length + outgoing.length;

  function tabBtn(id, label, badge) {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          flex: 1, minHeight: 38, borderRadius: 9, border: "none", cursor: "pointer",
          background: active ? "var(--acc-bg)" : "transparent",
          color: active ? "var(--acc)" : "var(--text-secondary)",
          fontWeight: 600, fontSize: 13, fontFamily: FONT,
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          transition: "all 0.15s",
        }}
      >
        {label}
        {badge > 0 && (
          <span style={{
            minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8,
            background: active ? "var(--acc-bg)" : "var(--danger)", color: "#fff",
            fontSize: 10, fontWeight: 700, display: "inline-flex",
            alignItems: "center", justifyContent: "center",
          }}>{badge}</span>
        )}
      </button>
    );
  }

  const emptyText = { fontSize: 12.5, color: "var(--text-tertiary)", fontFamily: FONT, padding: "10px 2px" };
  const groupLabel = {
    fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: FONT,
    letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 9,
  };

  return (
    <div
      className="mobile-sheet-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "var(--overlay)",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 16,
      }}
    >
      <div className="mobile-sheet" style={{
        position: "relative",
        background: "var(--bg-surface-1)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 18, width: "100%", maxWidth: 460,
        maxHeight: "88vh", display: "flex", flexDirection: "column",
        padding: "24px 22px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        animation: "fadeIn 0.2s ease", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -100, right: -60,
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, var(--acc-bg) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT, letterSpacing: "-0.02em" }}>
              Friends
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: "transparent", border: "1px solid var(--border-default)",
                borderRadius: 8, width: 32, height: 32, cursor: "pointer",
                color: "var(--text-secondary)", fontSize: 16, lineHeight: 1,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >✕</button>
          </div>

          {/* Tabs */}
          <div style={{
            display: "flex", gap: 4, marginBottom: 16, padding: 4,
            background: "var(--bg-surface-2)", borderRadius: 11,
          }}>
            {tabBtn("add", "Add")}
            {tabBtn("requests", "Requests", reqCount)}
            {tabBtn("blocked", "Blocked")}
          </div>

          {/* ── ADD ── */}
          {tab === "add" && (
            <>
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by @username…"
                style={{
                  width: "100%", background: "var(--bg-surface-1)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 10, padding: "0 14px", height: 42,
                  color: "var(--text-primary)", fontSize: 14, fontFamily: FONT,
                  outline: "none", boxSizing: "border-box", marginBottom: 14,
                }}
                onFocus={e => { e.target.style.borderColor = "var(--acc)"; e.target.style.boxShadow = "0 0 0 3px rgba(167,139,250,0.14)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.09)"; e.target.style.boxShadow = "none"; }}
              />
              <div style={{ overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {query.trim().length < 2 && <div style={emptyText}>Type a username to find people.</div>}
                {query.trim().length >= 2 && searching && results.length === 0 && <div style={emptyText}>Searching…</div>}
                {query.trim().length >= 2 && !searching && results.length === 0 && <div style={emptyText}>No people found.</div>}
                {results.map(u => {
                  const state = requested[u.userId];
                  const done = state === "requested" || state === "pending";
                  return (
                    <PersonRow key={u.userId} name={u.name} seed={u.username || u.userId} sub={u.username ? `@${u.username}` : ""}>
                      <button onClick={() => handleAdd(u.userId)} disabled={state === "busy" || done} style={pillBtn(done ? "green" : "accent", state === "busy" || done)}>
                        {state === "busy" ? "…" : done ? "Requested" : state === "error" ? "Retry" : "Add"}
                      </button>
                    </PersonRow>
                  );
                })}
              </div>
            </>
          )}

          {/* ── REQUESTS ── */}
          {tab === "requests" && (
            <div style={{ overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={groupLabel}>Incoming ({requests.length})</div>
                {requests.length === 0 ? (
                  <div style={emptyText}>No incoming requests.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {requests.map(r => {
                      const busy = respondState[r.requestId] === "busy";
                      return (
                        <PersonRow key={r.requestId} name={r.fromName} seed={r.fromUsername || r.fromUserId} sub={r.fromUsername ? `@${r.fromUsername}` : ""}>
                          <button onClick={() => handleRespond(r.requestId, "accept")} disabled={busy} style={pillBtn("green", busy)}>Accept</button>
                          <button onClick={() => handleRespond(r.requestId, "decline")} disabled={busy} style={pillBtn("ghost", busy)}>Decline</button>
                        </PersonRow>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <div style={groupLabel}>Outgoing ({outgoing.length})</div>
                {outgoing.length === 0 ? (
                  <div style={emptyText}>No pending sent requests.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {outgoing.map(r => {
                      const busy = cancelState[r.requestId] === "busy";
                      return (
                        <PersonRow key={r.requestId} name={r.toName} seed={r.toUsername || r.toUserId} sub={r.toUsername ? `@${r.toUsername}` : ""}>
                          <button onClick={() => handleCancel(r.requestId)} disabled={busy} style={pillBtn("ghost", busy)}>{busy ? "…" : "Cancel"}</button>
                        </PersonRow>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── BLOCKED ── */}
          {tab === "blocked" && (
            <div style={{ overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {blocked.length === 0 ? (
                <div style={emptyText}>You haven't blocked anyone.</div>
              ) : (
                blocked.map(u => {
                  const busy = unblockState[u.userId] === "busy";
                  return (
                    <PersonRow key={u.userId} name={u.name} seed={u.username || u.userId} sub={u.username ? `@${u.username}` : ""}>
                      <button onClick={() => handleUnblock(u.userId)} disabled={busy} style={pillBtn("ghost", busy)}>{busy ? "…" : "Unblock"}</button>
                    </PersonRow>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
