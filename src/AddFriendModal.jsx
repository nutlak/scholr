import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "./api.js";

const FONT = `"Outfit", "Poppins", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;

// Deterministic avatar tint by seed — mirrors the Avatar palette in App.jsx so
// initials look consistent across the app.
const TINTS = [
  { hue: "#A78BFA", deep: "#8B5CF6" }, { hue: "#60A5FA", deep: "#3B82F6" },
  { hue: "#34D399", deep: "#10B981" }, { hue: "#FBBF24", deep: "#F59E0B" },
  { hue: "#F472B6", deep: "#EC4899" }, { hue: "#FB7185", deep: "#F43F5E" },
  { hue: "#22D3EE", deep: "#06B6D4" },
];
function tintFor(seed) {
  if (!seed) return TINTS[0];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

function Initial({ name, seed, size = 32 }) {
  const t = tintFor(seed ?? name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${t.hue} 0%, ${t.deep} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 700, color: "#fff",
      fontFamily: FONT, flexShrink: 0, letterSpacing: "-0.02em",
    }}>
      {(name?.[0] ?? "?").toUpperCase()}
    </div>
  );
}

export default function AddFriendModal({ onClose, onChanged }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [requested, setRequested] = useState({});  // userId → 'requested' | 'pending' | 'error'
  const [requests, setRequests] = useState([]);     // incoming pending requests
  const [respondState, setRespondState] = useState({}); // requestId → 'accept'|'decline'|'busy'
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const loadRequests = useCallback(async () => {
    try {
      const rows = await api.getFriendRequests();
      setRequests(rows ?? []);
    } catch { /* leave list as-is on error */ }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  // Debounced search (300ms).
  useEffect(() => {
    const q = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const rows = await api.searchUsers(q);
        setResults(rows ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  async function handleAdd(userId) {
    setRequested(s => ({ ...s, [userId]: "busy" }));
    try {
      const { status } = await api.requestFriend(userId);
      setRequested(s => ({ ...s, [userId]: status === "accepted" ? "pending" : "requested" }));
      // Auto-accept (reciprocal request) → friends list changed.
      if (status === "accepted" || status === "already_friends") onChanged?.();
    } catch {
      setRequested(s => ({ ...s, [userId]: "error" }));
    }
  }

  async function handleRespond(requestId, action) {
    setRespondState(s => ({ ...s, [requestId]: "busy" }));
    try {
      await api.respondToFriend(requestId, action);
      // Refresh the incoming list and the sidebar (friends + best friends).
      await loadRequests();
      onChanged?.();
    } catch {
      setRespondState(s => ({ ...s, [requestId]: "error" }));
    }
  }

  return (
    <div
      className="mobile-sheet-overlay"
      onClick={handleOverlayClick}
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
        borderRadius: 18, width: "100%", maxWidth: 460,
        maxHeight: "88vh", display: "flex", flexDirection: "column",
        padding: "26px 24px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(167,139,250,0.08)",
        animation: "fadeIn 0.2s ease", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -100, right: -60,
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#F5F5FA", fontFamily: FONT, marginBottom: 4, letterSpacing: "-0.02em" }}>
                Add Friends
              </div>
              <div style={{ fontSize: 13, color: "rgba(245,245,250,0.55)", fontFamily: FONT, lineHeight: 1.5 }}>
                Search by name or email to send a friend request
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, width: 30, height: 30, cursor: "pointer",
                color: "rgba(245,245,250,0.6)", fontSize: 16, lineHeight: 1,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >✕</button>
          </div>

          {/* Search input */}
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search people…"
            style={{
              width: "100%", background: "#14141F",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 10, padding: "0 14px", height: 42,
              color: "#F5F5FA", fontSize: 14, fontFamily: FONT,
              outline: "none", boxSizing: "border-box", marginBottom: 14,
            }}
            onFocus={e => { e.target.style.borderColor = "#A78BFA"; e.target.style.boxShadow = "0 0 0 3px rgba(167,139,250,0.14)"; }}
            onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.09)"; e.target.style.boxShadow = "none"; }}
          />

          {/* Scrollable body */}
          <div style={{ overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Search results */}
            {query.trim().length >= 2 && (
              <div>
                {searching && results.length === 0 && (
                  <div style={{ fontSize: 12.5, color: "rgba(245,245,250,0.4)", fontFamily: FONT, padding: "6px 2px" }}>
                    Searching…
                  </div>
                )}
                {!searching && results.length === 0 && (
                  <div style={{ fontSize: 12.5, color: "rgba(245,245,250,0.4)", fontFamily: FONT, padding: "6px 2px" }}>
                    No people found.
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {results.map(u => {
                    const state = requested[u.userId];
                    const done = state === "requested" || state === "pending";
                    return (
                      <div key={u.userId} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 10px", borderRadius: 10,
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}>
                        <Initial name={u.name} seed={u.username || u.userId} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: "#F5F5FA", fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                          <div style={{ fontSize: 11.5, color: "rgba(245,245,250,0.45)", fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.username ? `@${u.username}` : ""}</div>
                        </div>
                        <button
                          onClick={() => handleAdd(u.userId)}
                          disabled={state === "busy" || done}
                          style={{
                            flexShrink: 0,
                            background: done ? "rgba(52,211,153,0.14)" : "rgba(167,139,250,0.14)",
                            border: `1px solid ${done ? "rgba(52,211,153,0.32)" : "rgba(167,139,250,0.32)"}`,
                            borderRadius: 8, padding: "6px 12px",
                            color: done ? "#6EE7B7" : "#C4B5FD",
                            fontWeight: 600, fontSize: 12, fontFamily: FONT,
                            cursor: state === "busy" || done ? "default" : "pointer",
                            opacity: state === "busy" ? 0.7 : 1,
                          }}
                        >
                          {state === "busy" ? "…" : done ? "Requested" : state === "error" ? "Retry" : "Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Incoming requests */}
            {requests.length > 0 && (
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: "rgba(245,245,250,0.5)",
                  fontFamily: FONT, letterSpacing: "0.06em", textTransform: "uppercase",
                  marginBottom: 9,
                }}>
                  Friend Requests ({requests.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {requests.map(r => {
                    const busy = respondState[r.requestId] === "busy";
                    return (
                      <div key={r.requestId} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 10px", borderRadius: 10,
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}>
                        <Initial name={r.fromName} seed={r.fromUsername || r.fromUserId} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: "#F5F5FA", fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.fromName}</div>
                          <div style={{ fontSize: 11.5, color: "rgba(245,245,250,0.45)", fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.fromUsername ? `@${r.fromUsername}` : ""}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button
                            onClick={() => handleRespond(r.requestId, "accept")}
                            disabled={busy}
                            style={{
                              background: "rgba(52,211,153,0.14)",
                              border: "1px solid rgba(52,211,153,0.32)",
                              borderRadius: 8, padding: "6px 11px",
                              color: "#6EE7B7", fontWeight: 600, fontSize: 12, fontFamily: FONT,
                              cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1,
                            }}
                          >Accept</button>
                          <button
                            onClick={() => handleRespond(r.requestId, "decline")}
                            disabled={busy}
                            style={{
                              background: "transparent",
                              border: "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 8, padding: "6px 11px",
                              color: "rgba(245,245,250,0.6)", fontWeight: 600, fontSize: 12, fontFamily: FONT,
                              cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1,
                            }}
                          >Decline</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
