import { Settings, LogOut } from "lucide-react";
import { FONT } from "../../lib/theme.js";

/* The phone's account menu.
 *
 * The desktop profile dropdown lives inside .sidebar, and .sidebar is
 * display:none at phone width — so tapping the avatar used to toggle a menu
 * that rendered into a hidden subtree. Settings and Sign out were unreachable
 * on a phone entirely: no theme, no notification toggle, no Squad, no delete
 * account, and no way to log out at all.
 *
 * Same profileOpen state as the desktop dropdown, a second presentation.
 * mobile-only keeps the two from ever showing at once. The legal links come
 * along because they live in that same hidden sidebar.
 */
export function MobileProfileSheet({ displayName, email, onClose, onSettings, onSignOut }) {
  const row = {
    width: "100%", minHeight: 52, borderRadius: 12,
    display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
    border: "1px solid var(--border-default)",
    fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
  };
  const truncate = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

  return (
    <div
      className="mobile-sheet-overlay mobile-only"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        justifyContent: "center", zIndex: 1000,
      }}
    >
      <div className="mobile-sheet" style={{
        background: "var(--bg-base)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 18, width: "100%", maxWidth: 440,
        padding: "8px 12px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 4px 10px" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 15, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT,
              letterSpacing: "-0.02em", ...truncate,
            }}>{displayName}</div>
            <div style={{
              fontSize: 12, color: "var(--text-tertiary)", fontFamily: FONT, marginTop: 1, ...truncate,
            }}>{email}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              marginLeft: "auto", background: "transparent",
              border: "1px solid var(--border-default)", borderRadius: 8,
              width: 44, height: 44, cursor: "pointer",
              color: "var(--text-secondary)", fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >✕</button>
        </div>

        <button
          onClick={onSettings}
          style={{ ...row, marginBottom: 8, background: "var(--bg-surface-1)", color: "var(--text-primary)" }}
        >
          <Settings size={17} strokeWidth={1.85} style={{ color: "var(--accent)", flexShrink: 0 }} />
          Settings
        </button>

        <button
          onClick={onSignOut}
          style={{ ...row, background: "transparent", color: "var(--danger)" }}
        >
          <LogOut size={17} strokeWidth={1.85} style={{ flexShrink: 0 }} />
          Sign out
        </button>

        <div style={{
          display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center",
          marginTop: 16, fontSize: 12, fontFamily: FONT,
        }}>
          <a href="/privacy" style={{ color: "var(--text-tertiary)" }}>Privacy</a>
          <a href="/terms" style={{ color: "var(--text-tertiary)" }}>Terms</a>
          <a href="/copyright" style={{ color: "var(--text-tertiary)" }}>Copyright</a>
          <a href="mailto:support@scholr.dev" style={{ color: "var(--text-tertiary)" }}>Contact</a>
        </div>
      </div>
    </div>
  );
}
