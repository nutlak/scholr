import { useState, useEffect, useRef, useCallback } from "react";
import { Bell } from "lucide-react";
import { api } from "./api.js";

const FONT = `"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;

function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// Build the human-readable line for a notification from its type + payload.
function describe(n) {
  const who = n.payload?.fromUsername ? `@${n.payload.fromUsername}` : "Someone";
  switch (n.type) {
    case "friend_request":  return `${who} sent you a friend request`;
    case "friend_accepted": return `${who} accepted your friend request`;
    case "notebook_invite": return `${who} added you to ${n.payload?.notebookTitle ?? "a notebook"}`;
    case "payment_failed":  return "Your payment didn't go through — tap to update your card";
    case "renewal_reminder": {
      const d = n.payload?.days;
      const when = d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d ?? "a few"} days`;
      return `Your scholr Pro renews ${when}`;
    }
    default:                return "New notification";
  }
}

export default function NotificationsBell({ onOpenNotebook, onOpenBilling }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { notifications, unreadCount } = await api.getSocialNotifications();
      setItems(notifications ?? []);
      setUnread(unreadCount ?? 0);
    } catch { /* keep last good state */ }
  }, []);

  // Initial load + 30s polling.
  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDoc(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    // Mark all read when opening.
    if (next && unread > 0) {
      setUnread(0);
      setItems(prev => prev.map(n => ({ ...n, read: true })));
      try { await api.markSocialNotificationsRead([]); } catch { /* will retry on next poll */ }
    }
  }

  function handleClick(n) {
    if (n.type === "notebook_invite" && n.payload?.notebookId) {
      onOpenNotebook?.(n.payload.notebookId);
      setOpen(false);
    } else if (n.type === "payment_failed" || n.type === "renewal_reminder") {
      onOpenBilling?.();
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        onClick={toggle}
        title="Notifications"
        aria-label="Notifications"
        style={{
          position: "relative", background: "transparent",
          border: "1px solid var(--border-default)", borderRadius: 8,
          width: 36, height: 36, cursor: "pointer",
          color: "var(--text-secondary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Bell size={16} strokeWidth={1.85} />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -5, right: -5,
            minWidth: 17, height: 17, padding: "0 4px", borderRadius: 9,
            background: "#F87171", color: "#fff", fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: FONT, border: "2px solid var(--bg-base)",
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: 44, right: 0, width: 300, maxWidth: "calc(100vw - 32px)",
          maxHeight: 380, overflowY: "auto",
          background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
          boxShadow: "0 24px 60px rgba(0,0,0,0.55)", zIndex: 500,
          padding: 6, animation: "fadeIn 0.15s ease",
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: "rgba(245,245,250,0.5)",
            fontFamily: FONT, letterSpacing: "0.06em", textTransform: "uppercase",
            padding: "8px 10px 6px",
          }}>Notifications</div>
          {items.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "rgba(245,245,250,0.4)", fontFamily: FONT, padding: "10px" }}>
              You're all caught up.
            </div>
          ) : (
            items.map(n => {
              const tappable = (n.type === "notebook_invite" && n.payload?.notebookId) || n.type === "payment_failed" || n.type === "renewal_reminder";
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 9,
                    padding: "9px 10px", borderRadius: 8,
                    cursor: tappable ? "pointer" : "default",
                  }}
                  onMouseEnter={e => { if (tappable) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%", marginTop: 6, flexShrink: 0,
                    background: n.read ? "transparent" : "#A78BFA",
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: "#F5F5FA", fontFamily: FONT, lineHeight: 1.45 }}>
                      {describe(n)}
                    </div>
                    <div style={{ fontSize: 10.5, color: "rgba(245,245,250,0.4)", fontFamily: FONT, marginTop: 2 }}>
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
