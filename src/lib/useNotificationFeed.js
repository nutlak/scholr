import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";

/* The dashboard's Recent Activity feed: the list, the 30s poll that keeps it
 * live, and the two things you can do to it from the feed itself (clear the
 * inbox, accept/decline a friend request inline).
 *
 * The notification bell polls its own copy independently — `notifVersion` is
 * how this side tells it to reload after a change here, so the two never
 * disagree about what's still outstanding.
 */
export function useNotificationFeed(user, { onFriendRequestHandled } = {}) {
  const [notifications, setNotifications] = useState([]);
  // notifId -> "busy" | terminal status (e.g. already-handled)
  const [feedActioned, setFeedActioned] = useState({});
  // notifId -> inline error shown ALONGSIDE the buttons (retryable)
  const [feedError, setFeedError] = useState({});
  // bump to make NotificationsBell reload
  const [notifVersion, setNotifVersion] = useState(0);

  const refreshNotifications = useCallback(async () => {
    try {
      const d = await api.getSocialNotifications();
      setNotifications(d?.notifications ?? []);
    } catch { /* keep last good state */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    const id = setInterval(refreshNotifications, 30_000);
    return () => clearInterval(id);
  }, [user, refreshNotifications]);

  // Clear inbox — delete ALL notifications (with a confirm), and clear the bell.
  async function clearInbox() {
    if (!window.confirm("Clear all notifications?")) return;
    setNotifications([]);            // optimistic: empty the feed
    setNotifVersion(v => v + 1);     // tell the bell to reload (→ empty)
    try { await api.clearSocialNotifications(); }
    catch { refreshNotifications(); } // restore on failure
  }

  // Accept/Decline a friend request straight from the Recent Activity feed.
  // notifId = the social_notifications row id (so we can clear it); requestId =
  // the friend_request id (for respondToFriend).
  async function respondToFriendFromFeed(notifId, requestId, action) {
    const dropRow = () => setNotifications(prev => prev.filter(n => n.id !== notifId));

    // Legacy/stale notification with no requestId in its payload — nothing to
    // action server-side; just clear the row and mark it read.
    if (!requestId) {
      dropRow();
      if (notifId) api.markSocialNotificationsRead([notifId]).catch(() => {});
      return;
    }

    // Immediate visible feedback so the button never feels dead. Clear any prior
    // inline error from a previous failed attempt.
    setFeedActioned(s => ({ ...s, [notifId]: "busy" }));
    setFeedError(s => { const next = { ...s }; delete next[notifId]; return next; });
    try {
      await api.respondToFriend(requestId, action);
      // Success: row removed, sidebar friends refreshed so the new friend shows,
      // and the feed re-fetched (the server deleted this notification, so it
      // won't come back).
      dropRow();
      onFriendRequestHandled?.();
      refreshNotifications();
    } catch (err) {
      if (err.status === 409 || err.code === "already_actioned") {
        // Already handled elsewhere — show a brief terminal note, then clear.
        setFeedActioned(s => ({ ...s, [notifId]: err.message || "Already handled" }));
        onFriendRequestHandled?.();
        setTimeout(() => { dropRow(); refreshNotifications(); }, 1400);
      } else {
        // Generic failure — restore the actionable buttons and show an inline
        // error next to them so "try again" is actually possible.
        setFeedActioned(s => { const next = { ...s }; delete next[notifId]; return next; });
        setFeedError(s => ({ ...s, [notifId]: "Couldn't respond — try again" }));
      }
    }
  }

  return {
    notifications, setNotifications,
    feedActioned, feedError, notifVersion,
    refreshNotifications, clearInbox, respondToFriendFromFeed,
  };
}
