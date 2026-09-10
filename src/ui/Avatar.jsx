import { useState } from "react";
import { FONT, tintFor } from "../lib/theme.js";
import { memberLabel } from "../lib/format.js";

export function Avatar({ name, size = 28, seed }) {
  const t = tintFor(seed ?? name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${t.hue} 0%, ${t.deep} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 700, color: "#fff",
      fontFamily: FONT, flexShrink: 0,
      border: "2px solid #0B0B12",
      boxShadow: `0 2px 6px ${t.hue}40`,
      letterSpacing: "-0.02em",
    }}>
      {(name?.[0] ?? "?").toUpperCase()}
    </div>
  );
}
export function AvatarStack({ names }) {
  return (
    <div style={{ display: "flex" }}>
      {names.slice(0, 3).map((n, i) => (
        <div key={`${n}-${i}`} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: names.length - i }}>
          <Avatar name={n} size={24} seed={n} />
        </div>
      ))}
      {names.length > 3 && (
        <div style={{
          marginLeft: -8, width: 24, height: 24, borderRadius: "50%",
          background: "var(--s2)", border: "2px solid #0B0B12",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 600, color: "var(--t2)", fontFamily: FONT,
        }}>+{names.length - 3}</div>
      )}
    </div>
  );
}
export function MemberAvatarStack({ members }) {
  const [open, setOpen] = useState(false);
  const visible = members.slice(0, 3);
  const overflow = members.length - 3;

  // Owners first, then alphabetical by display label
  const sorted = [...members].sort((a, b) => {
    if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
    return memberLabel(a).localeCompare(memberLabel(b));
  });

  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ display: "flex", alignItems: "center", position: "relative", cursor: "default" }}
    >
      {visible.map((m, i) => (
        <div key={m.user_id} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: visible.length - i }}>
          <Avatar name={m.email} size={28} seed={m.email} />
        </div>
      ))}
      {overflow > 0 && (
        <div style={{
          marginLeft: -10, width: 28, height: 28, borderRadius: "50%",
          background: "var(--s2)", border: "2px solid #0B0B12",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10.5, fontWeight: 600, color: "var(--t2)", fontFamily: FONT, zIndex: 0,
        }}>+{overflow}</div>
      )}

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 10px)", right: 0,
          minWidth: 240, maxWidth: 320, maxHeight: 300, overflowY: "auto",
          background: "rgba(20,20,31,0.92)",
          backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          border: "1px solid var(--border-h)",
          borderRadius: 10, padding: 12,
          fontFamily: FONT, zIndex: 100,
          boxShadow: "0 16px 40px rgba(0,0,0,0.55), 0 0 0 1px var(--acc-bg), 0 0 32px var(--acc-bg)",
          animation: "fadeIn 0.15s ease",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: "var(--t3)",
            letterSpacing: "0.08em", textTransform: "uppercase",
            padding: "2px 4px 8px",
          }}>
            {members.length} {members.length === 1 ? "Member" : "Members"}
          </div>
          {sorted.map(m => {
            const label = memberLabel(m);
            const isOwner = m.role === "owner";
            return (
              <div key={m.user_id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 4px", borderRadius: 8,
              }}>
                <Avatar name={m.email} size={26} seed={m.email} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500, color: "var(--t1)",
                    letterSpacing: "-0.01em",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
                    <span style={{ color: "var(--t4)", flexShrink: 0 }}>•</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: isOwner ? "var(--acc)" : "var(--t3)",
                      letterSpacing: "-0.005em", flexShrink: 0,
                    }}>
                      {isOwner ? "Owner" : "Member"}
                    </span>
                  </div>
                  {m.email && m.email !== label && (
                    <div style={{
                      fontSize: 11, color: "var(--t3)", marginTop: 1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{m.email}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
