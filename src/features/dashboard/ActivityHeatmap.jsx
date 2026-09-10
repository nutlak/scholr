import { useState } from "react";
import { FONT } from "../../lib/theme.js";

export function ActivityHeatmap({ data, longestStreak = 0 }) {
  const [viewMode, setViewMode] = useState("week"); // 'week' | 'month' | 'year'
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());

  // Build lookup map from API data: 'YYYY-MM-DD' → count
  const activityMap = new Map(data.map(d => [d.date, d.count]));
  const fmtKey = dt => dt.toISOString().slice(0, 10);
  const isActive = key => (activityMap.get(key) ?? 0) > 0;

  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const todayKey = fmtKey(todayDate);

  // Streak: consecutive days ending today with activity
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(todayDate); d.setDate(d.getDate() - i);
    if ((activityMap.get(fmtKey(d)) ?? 0) > 0) streak++; else break;
  }
  const activeDays = data.filter(d => (d.count ?? 0) > 0).length;

  // Week days (Sun–Sat of current week). getDay() returns 0 for Sunday.
  const weekStart = new Date(todayDate);
  weekStart.setDate(todayDate.getDate() - todayDate.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  });
  const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

  // Build calendar grid for a month (Sunday-start). first.getDay() gives
  // 0…6 where 0 is Sunday — exactly the offset we need for empty leading cells.
  function buildMonthGrid(monthDt) {
    const y = monthDt.getFullYear(), m = monthDt.getMonth();
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const offset = first.getDay(); // Sun=0 … Sat=6
    const cells = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
    while (cells.length % 7) cells.push(null);
    return cells;
  }

  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  // Shared day-circle renderer (plain function, not a component, to avoid remount on every render)
  function renderCircle(dt, size, label) {
    if (!dt) return <div style={{ width: size, height: size }} />;
    const key = fmtKey(dt);
    const active = isActive(key);
    const isT = key === todayKey;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        {label !== undefined && (
          <div style={{
            fontSize: 9, fontWeight: 700, fontFamily: FONT,
            color: "var(--t3)", textTransform: "uppercase",
            letterSpacing: "0.05em", height: 11, lineHeight: "11px",
          }}>
            {label}
          </div>
        )}
        <div style={{
          width: size, height: size, borderRadius: "50%", boxSizing: "border-box",
          background: active ? "var(--acc-d)" : "var(--s2)",
          border: isT ? "2px solid var(--acc)" : "2px solid transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: Math.max(9, Math.floor(size * 0.36)),
          fontWeight: active ? 700 : 400,
          color: active ? "#fff" : "var(--t3)",
          fontFamily: FONT,
          transition: "background 0.15s",
        }}>
          {dt.getDate()}
        </div>
      </div>
    );
  }

  const navBtnStyle = {
    background: "none", border: "none", color: "var(--t3)",
    cursor: "pointer", fontSize: 18, padding: "2px 8px", lineHeight: 1,
    borderRadius: 6, fontFamily: FONT,
  };

  return (
    <div style={{ marginBottom: 32 }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: FONT,
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          Study Streak
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {["week", "month", "year"].map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              padding: "3px 10px", borderRadius: 8, cursor: "pointer",
              border: "1px solid",
              borderColor: viewMode === mode ? "color-mix(in srgb, var(--acc) 45%, transparent)" : "var(--border)",
              background: viewMode === mode ? "var(--acc-bg)" : "transparent",
              color: viewMode === mode ? "var(--acc)" : "var(--t3)",
              fontSize: 11, fontWeight: 600, fontFamily: FONT, transition: "all 0.15s",
            }}>
              {mode[0].toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Week view ── */}
      {viewMode === "week" && (
        <div className="heatmap-fade-in">
          <div style={{ display: "flex", justifyContent: "space-around", gap: 2 }}>
            {weekDays.map((d, i) => (
              <div key={i} style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                {renderCircle(d, 36, DAY_LETTERS[i])}
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <button onClick={() => setViewMode("month")} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--acc)", fontSize: 11, fontFamily: FONT,
              fontWeight: 600, padding: "4px 8px",
            }}>
              Show month ↓
            </button>
          </div>
        </div>
      )}

      {/* ── Month view ── */}
      {viewMode === "month" && (
        <div className="heatmap-fade-in">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button style={navBtnStyle} onClick={() => setCurrentMonth(m => { const n = new Date(m); n.setMonth(m.getMonth() - 1); return n; })}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: FONT }}>
              {MONTHS_FULL[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </span>
            <button style={navBtnStyle} onClick={() => setCurrentMonth(m => { const n = new Date(m); n.setMonth(m.getMonth() + 1); return n; })}>›</button>
          </div>
          {/* Day-of-week headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 3 }}>
            {DAY_LETTERS.map((l, i) => (
              <div key={i} style={{
                textAlign: "center", fontSize: 9, fontWeight: 700,
                color: "var(--t4)", fontFamily: FONT,
                paddingBottom: 4, textTransform: "uppercase",
              }}>{l}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
            {buildMonthGrid(currentMonth).map((d, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "center" }}>
                {d ? renderCircle(d, 28) : <div style={{ width: 28, height: 28 }} />}
              </div>
            ))}
          </div>
          {/* Sub-nav */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <button onClick={() => setViewMode("week")} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--t4)", fontSize: 11, fontFamily: FONT, fontWeight: 600, padding: "4px 0",
            }}>↑ Show less</button>
            <button onClick={() => setViewMode("year")} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--acc)", fontSize: 11, fontFamily: FONT, fontWeight: 600, padding: "4px 0",
            }}>Show year ↓</button>
          </div>
        </div>
      )}

      {/* ── Year view ── */}
      {viewMode === "year" && (
        <div className="heatmap-fade-in">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button style={navBtnStyle} onClick={() => setCurrentYear(y => y - 1)}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: FONT }}>{currentYear}</span>
            <button style={navBtnStyle} onClick={() => setCurrentYear(y => y + 1)}>›</button>
          </div>
          {/* 12 mini-month grids */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {MONTHS_SHORT.map((_, mi) => {
              const monthDt = new Date(currentYear, mi, 1);
              const cells = buildMonthGrid(monthDt);
              return (
                <div key={mi}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, fontFamily: FONT,
                    color: "var(--t3)", textAlign: "center", marginBottom: 4,
                  }}>
                    {MONTHS_SHORT[mi]}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1.5 }}>
                    {cells.map((d, di) => {
                      if (!d) return <div key={di} style={{ aspectRatio: "1" }} />;
                      const key = fmtKey(d);
                      const active = isActive(key);
                      const isT = key === todayKey;
                      return (
                        <div key={di} style={{
                          aspectRatio: "1", borderRadius: "50%", boxSizing: "border-box",
                          background: active ? "var(--acc-d)" : "var(--s2)",
                          border: isT ? "1.5px solid var(--acc)" : "1.5px solid transparent",
                        }} />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 10 }}>
            <button onClick={() => setViewMode("month")} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--t4)", fontSize: 11, fontFamily: FONT, fontWeight: 600, padding: "4px 0",
            }}>↑ Show less</button>
          </div>
        </div>
      )}

      {/* ── Stats footer ── */}
      <div style={{
        display: "flex", gap: 20, marginTop: 14, paddingTop: 12,
        borderTop: "1px solid var(--border)",
      }}>
        {[
          { val: streak,     label: "day streak", color: "var(--acc)" },
          { val: Math.max(longestStreak, streak), label: "longest", color: "var(--text-secondary)" },
          { val: activeDays, label: activeDays === 1 ? "day visited" : "days visited", color: "var(--text-primary)" },
        ].map(({ val, label, color }) => (
          <div key={label}>
            <div style={{ fontSize: 16, fontWeight: 600, color, fontFamily: FONT, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: FONT, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
