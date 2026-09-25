import { LayoutDashboard, FileText, Users, Star, UserPlus } from "lucide-react";
import { FONT } from "../../lib/theme.js";

const TABS = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "my-notes",  label: "Notes",     Icon: FileText },
  { id: "shared",    label: "Shared",    Icon: Users },
  { id: "starred",   label: "Starred",   Icon: Star },
];

/* The phone's primary navigation. The sidebar is display:none at phone width,
   so this is the only way between views there — which is why Friends is a tab
   that opens a sheet rather than a sidebar section.

   Takes what it shows and two things to call, not the four setters behind
   them: choosing a tab also clears the open notebook and the search box, and
   that is one intention, not three. */
export function MobileTabBar({ activeView, dueCount = 0, onSelect, onOpenFriends }) {
  return (
    <nav className="mobile-tab-bar mobile-only" aria-label="Primary">
      {TABS.map(({ id, label, Icon }) => {
        const active = activeView === id;
        return (
          <button
            key={id}
            className={`mobile-tab ${active ? "active" : ""}`}
            onClick={() => onSelect(id)}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            style={{ position: "relative" }}
          >
            <Icon size={22} strokeWidth={active ? 2 : 1.75} />
            <span>{label}</span>
            {id === "dashboard" && dueCount > 0 && (
              <span style={{
                position: "absolute", top: 4, right: "50%", marginRight: -22,
                minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8,
                background: "var(--accent)", color: "var(--on-acc)", fontSize: 9.5, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: FONT, border: "2px solid var(--bg-surface-1)",
              }}>{dueCount > 9 ? "9+" : dueCount}</span>
            )}
          </button>
        );
      })}
      {/* Friends opens a bottom sheet (sidebar is hidden on mobile) */}
      <button className="mobile-tab" onClick={onOpenFriends} aria-label="Friends">
        <UserPlus size={22} strokeWidth={1.75} />
        <span>Friends</span>
      </button>
    </nav>
  );
}
