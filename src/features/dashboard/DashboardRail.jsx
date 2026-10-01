import { AlertTriangle, AtSign, Bell, Check, FileText, FolderPlus, RefreshCw, UserPlus } from "lucide-react";
import { api } from "../../api.js";
import { ActivityHeatmap } from "./ActivityHeatmap.jsx";
import { FONT } from "../../lib/theme.js";
import { NOTIF_OPENS_BILLING, NOTIF_OPENS_NOTEBOOK, notifLine, timeAgo } from "../../lib/format.js";

// Unified notification rendering, by social_notifications type.
const NOTIF_ICON = {
  friend_request:  UserPlus,
  friend_accepted: Check,
  notebook_invite: FolderPlus,
  mention:         AtSign,
  note_uploaded:   FileText,
  payment_failed:  AlertTriangle,
  renewal_reminder: RefreshCw,
};

/* The dashboard's right-hand rail: streak calendar on top, the unified
 * activity feed under it. Lifted out of Scholr() whole — same markup, same
 * handlers, now behind the layout boundary the CSS already draws (.dash-rail
 * is its own grid column until the breakpoint collapses it).
 */
export function DashboardRail({
  heatmap, longestStreak, leaderboard,
  notifications, setNotifications,
  clearInbox, feedActioned, feedError, respondToFriendFromFeed,
  onOpenNotebook, onOpenBilling,
}) {
  const unread = notifications.filter(n => !n.read).length;

  return (
    <aside className="dash-rail">
      <ActivityHeatmap data={heatmap} longestStreak={longestStreak} leaderboard={leaderboard} />

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14, paddingTop: 20,
        borderTop: "1px solid var(--border-subtle)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)",
            fontFamily: FONT, letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            Recent Activity
          </div>
          {unread > 0 && (
            <span style={{
              fontSize: 10.5, fontWeight: 700, color: "var(--accent)",
              background: "var(--acc-bg)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
              padding: "1px 7px", borderRadius: 999,
            }}>{unread}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {unread > 0 && (
            <button
              onClick={async () => {
                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                try { await api.markAllSocialNotificationsRead(); } catch { /* silent */ }
              }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12, color: "var(--text-tertiary)", fontFamily: FONT,
                padding: "4px 8px", borderRadius: 6, transition: "all 0.15s",
                fontWeight: 500, minHeight: 44,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "var(--acc-bg)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.background = "transparent"; }}
            >
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearInbox}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12, color: "var(--text-tertiary)", fontFamily: FONT,
                padding: "4px 8px", borderRadius: 6, transition: "all 0.15s",
                fontWeight: 500, minHeight: 44,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = "rgba(248,113,113,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.background = "transparent"; }}
            >
              Clear inbox
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div style={{ padding: "8px 0 12px", color: "var(--text-tertiary)", fontSize: 12.5, fontFamily: FONT }}>
          You're all caught up. Friend requests, invites, and study-group activity appear here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {notifications.map(n => {
            const Icon = NOTIF_ICON[n.type] ?? Bell;
            const opensNotebook = NOTIF_OPENS_NOTEBOOK.has(n.type) && n.payload?.notebookId;
            const opensBilling = NOTIF_OPENS_BILLING.has(n.type);
            const isRequest = n.type === "friend_request";
            const onRowClick = opensNotebook
              ? () => onOpenNotebook(n.payload.notebookId)
              : opensBilling ? () => onOpenBilling() : undefined;
            return (
              <div
                key={n.id}
                onClick={onRowClick}
                className="notif-row"
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 8px", minHeight: 44,
                  borderBottom: "1px solid var(--border-subtle)",
                  borderRadius: 8,
                  cursor: onRowClick ? "pointer" : "default",
                  background: n.read ? "transparent" : "var(--acc-bg)",
                }}
              >
                <span style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "var(--bg-surface-2)", color: "var(--accent)",
                }}>
                  <Icon size={15} strokeWidth={1.85} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: FONT, lineHeight: 1.45, letterSpacing: "-0.005em" }}>
                    {notifLine(n)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT, marginTop: 2 }}>
                    {timeAgo(n.created_at)}
                  </div>
                </div>
                {isRequest && (() => {
                  const st = feedActioned[n.id];
                  // Terminal status (e.g. "Already handled") replaces the buttons; the row clears shortly after.
                  if (st && st !== "busy") {
                    return (
                      <span style={{ flexShrink: 0, fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: FONT }}>{st}</span>
                    );
                  }
                  const busy = st === "busy";
                  const err = feedError[n.id];
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      {err && <span style={{ fontSize: 11, color: "var(--danger)", fontFamily: FONT }}>{err}</span>}
                      <button
                        onClick={() => respondToFriendFromFeed(n.id, n.payload?.requestId, "accept")}
                        disabled={busy}
                        style={{
                          background: "rgba(52,211,153,0.14)", border: "1px solid rgba(52,211,153,0.32)",
                          borderRadius: 8, padding: "7px 12px", minHeight: 34,
                          color: "#6EE7B7", fontWeight: 600, fontSize: 12, fontFamily: FONT,
                          cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
                        }}
                      >{busy ? "…" : "Accept"}</button>
                      <button
                        onClick={() => respondToFriendFromFeed(n.id, n.payload?.requestId, "decline")}
                        disabled={busy}
                        style={{
                          background: "transparent", border: "1px solid var(--border-default)",
                          borderRadius: 8, padding: "7px 12px", minHeight: 34,
                          color: "var(--text-secondary)", fontWeight: 600, fontSize: 12, fontFamily: FONT,
                          cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
                        }}
                      >Decline</button>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
