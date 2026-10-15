import { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { BarChart3, BookOpen, Layers, Notebook, RefreshCw, Search, Users } from "lucide-react";
import { FONT, FONT_HEADING } from "../../lib/theme.js";
import { Avatar } from "../../ui/Avatar.jsx";
import { EmptyState } from "../../ui/EmptyState.jsx";
import { FriendsRow } from "../friends/FriendsRow.jsx";
import { GettingStarted } from "./GettingStarted.jsx";
import { NotebookCard } from "./NotebookCard.jsx";
import { UpcomingDeadlines } from "./UpcomingDeadlines.jsx";
import { DashboardRail } from "./DashboardRail.jsx";

// Lazy: the only thing that needs the drag library, and reordering classes is
// not something anyone does in their first second on the page.
const SortableClassList = lazy(() => import("../classes/SortableClassList.jsx").then(m => ({ default: m.SortableClassList })));

/* Everything the main pane renders when a notebook isn't open and Settings
 * isn't selected: the dashboard proper plus the Units list (every unit you're
 * in, with an All / Shared-with-me filter), which share this heading.
 *
 * Lifted out of Scholr() whole. The props are wide because the view really
 * does touch that much state — the alternative was leaving 300 lines of JSX
 * inside a component that already holds the app's entire state.
 */
export function DashboardView({
  activeView, viewLabel, greeting, displayName, user,
  streakAtRisk, streakBannerDismissed, setStreakBannerDismissed,
  classes, classesLoaded, notebooks, filtered, filteredClasses,
  search, setSearch,
  setShowNewClassModal, setProfileOpen,
  friendsVersion, bumpFriendsVersion, setFriendIds,
  openNotebookById, openUnitWithClassColor,
  expandedClassId, classUnitsCache,
  handleReorderClasses, handleToggleClass, handleChangeClassColor,
  openClassSyllabus, setSyllabusForClass, setNewUnitFor, setDeleteClassTarget,
  unitsFilter, setUnitsFilter, setActiveNb, setConfirmDeleteNb, onJoinClass, onInviteToClass,
  dueCount, startAllReview,
  subscription, handleManageSubscription, portalLoading, billingReady,
  heatmap, profile, leaderboard,
  notifications, setNotifications, clearInbox,
  feedActioned, feedError, respondToFriendFromFeed,
}) {
  // Unknown until FriendsRow reports in; the checklist waits for it so a
  // student who's done every step never sees it flash.
  const [friendCount, setFriendCount] = useState(null);
  // A brand-new account has nothing to count, schedule or log yet. Show the
  // friends row and one clear way in (the empty state), and nothing else: the
  // checklist, the PIN link, the heatmap and the feed all reappear the moment a
  // class exists. A pending friend request still earns the rail. Until the first
  // answer arrives we don't know which kind of account this is, so the class
  // area stays blank rather than flashing the new-account screen.
  const fresh = activeView === "dashboard" && classesLoaded && classes.length === 0;
  const more = activeView === "dashboard" && classesLoaded && classes.length > 0;
  const [railHidden, setRailHidden] = useState(() => { try { return localStorage.getItem("scholr:rail-hidden") === "1"; } catch { return false; } });
  const setRail = hidden => { setRailHidden(hidden); try { localStorage.setItem("scholr:rail-hidden", hidden ? "1" : "0"); } catch { /* private mode */ } };
  const unread = notifications.filter(n => !n.read).length;
  const showRail = activeView === "dashboard" && classesLoaded && !railHidden && (!fresh || notifications.length > 0);
  // Stable on purpose: FriendsRow's refresh depends on this callback, so a new
  // function each render would refetch the friends list on every render.
  const handleFriendIds = useCallback(ids => { setFriendIds(ids); setFriendCount(ids.length); }, [setFriendIds]);
  // Reading the clock during render is impure: two renders a second apart can
  // disagree, and the banner would flicker on the boundary. Pin it per
  // period-end instead, which is the only input that actually changes.
  const renewsIn = useMemo(() => {
    if (!subscription.currentPeriodEnd) return null;
    // Deliberate clock read. The rule is right in general — an impure render
    // can tear under concurrent rendering — but the only thing that can tear
    // here is whether a passive reminder appears one render either side of a
    // day boundary. Pinning it to currentPeriodEnd above is what actually
    // matters: without it the banner recomputed on every unrelated re-render.
    // eslint-disable-next-line react-hooks/purity
    const days = Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / 86400000);
    if (days < 0 || days > 3) return null;
    return days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  }, [subscription.currentPeriodEnd]);

  return (
    // Content measure: the pane is as wide as the window, and a dashboard
    // of short rows stretched across 1600px reads as scattered debris —
    // cap it and centre it, the way Settings already does.
    <div className="dash-wrap" style={{ animation: "fadeIn 0.25s ease", width: "100%", maxWidth: 1280, margin: "0 auto" }}>
      {activeView === "dashboard" && streakAtRisk && !streakBannerDismissed && (
        <div className="streak-banner">
          🔥 Your streak is at risk! Study today to keep it alive.
          <button onClick={() => setStreakBannerDismissed(true)} aria-label="Dismiss">×</button>
        </div>
      )}
      {/* Header. Sticky so the greeting isn't sliced when the pane
          scrolls under the status strip. The opaque backdrop (and the
          spread shadow that covers the pane's top-padding band) apply
          ONLY while scrolled — at rest the header is transparent so it
          doesn't read as a black card over the HUD void. */}
      <div className="pane-heading" style={{
        position: "relative",
        paddingTop: 6, paddingBottom: 14,
        display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12,
      }}>
        <div className="dash-heading">
          <div className="greeting-text" style={{
            fontSize: "clamp(23px, 4.6vw, 30px)", fontWeight: 650, color: "var(--text-primary)",
            fontFamily: FONT_HEADING,
            letterSpacing: "var(--tr-display)", lineHeight: "var(--lh-display)",
            display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
          }}>
            {activeView === "dashboard" ? greeting.text : viewLabel}
          </div>
          <span className="pen-squiggle" aria-hidden="true" />
          {(activeView !== "dashboard" || more) && (
            <div className="hand" style={{ "--hand-size": "18px", color: "var(--text-tertiary)", marginTop: 4 }}>
              {activeView === "dashboard"
                ? `${classes.length} ${classes.length === 1 ? "class" : "classes"} · ${notebooks.length} ${notebooks.length === 1 ? "unit" : "units"}`
                : `${filtered.length} ${filtered.length === 1 ? "unit" : "units"}`}
            </div>
          )}
          {activeView === "dashboard" && (
            <div className="hand" style={{
              "--hand-size": "17px", color: "var(--text-tertiary)",
              marginTop: 6, maxWidth: 680, lineHeight: 1.4,
            }}>
              “{greeting.quote.text}”
              <span style={{ opacity: 0.72 }}> — {greeting.quote.author}</span>
            </div>
          )}
        </div>
        {more && railHidden && (
          <button onClick={() => setRail(false)} className="btn-press" style={{
            height: 46, padding: "0 16px", borderRadius: 10, cursor: "pointer", fontFamily: FONT, fontSize: 14, fontWeight: 600,
            background: "transparent", border: "1px solid var(--border-strong)", color: "var(--text-primary)",
            display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0,
          }}>
            <BarChart3 size={16} strokeWidth={1.9} /> Streak &amp; activity
            {unread > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, background: "var(--acc)", color: "var(--on-acc)", borderRadius: 999, padding: "1px 7px" }}>{unread}</span>}
          </button>
        )}
        {more && (
          <button
            onClick={() => setShowNewClassModal(true)}
            className="btn-press desktop-only"
            style={{
              background: "var(--acc)",
              border: "none", borderRadius: 10, padding: "0 22px", height: 46,
              color: "var(--on-acc)", fontWeight: 600, fontSize: 15, cursor: "pointer",
              fontFamily: FONT, flexShrink: 0,
              boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
              letterSpacing: "-0.01em",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >+ New Class</button>
        )}
        {/* Mobile-only profile avatar trigger (opens existing dropdown) */}
        <button
          className="mobile-header-avatar mobile-only"
          onClick={() => setProfileOpen(v => !v)}
          aria-label="Open profile menu"
        >
          <Avatar name={displayName} size={36} seed={user?.email ?? displayName} />
        </button>
      </div>

      {/* Two-column dashboard on a wide window: the work you act on
          stays in a readable column on the left, while the streak
          calendar and the activity feed move into a rail that fits
          them. Narrower than that it is one column, in this same
          order — the breakpoint lives with .dash-grid in App.css. */}
      <div className={showRail ? "dash-grid" : undefined}>
        <div className="dash-main">
          {/* Friends first: the reason the app exists. */}
          {activeView === "dashboard" && (
            <FriendsRow
              refreshSignal={friendsVersion}
              onChanged={() => bumpFriendsVersion()}
              onOpenNotebook={openNotebookById}
              onFriendIds={handleFriendIds}
            />
          )}
          {more && friendCount !== null && (
            <GettingStarted
              userId={user?.id} classes={classes} notebooks={notebooks}
              messagesUsed={subscription?.messagesUsed ?? 0} friendCount={friendCount}
              onNewClass={() => setShowNewClassModal(true)} onJoinClass={onJoinClass}
              onOpenUnit={openNotebookById} onNewUnit={setNewUnitFor} onInvite={onInviteToClass}
            />
          )}
          {/* Cards due: the one thing to do right now, so it sits straight under
              Friends instead of below every class (it was ~900px down on a phone). */}
          {activeView === "dashboard" && dueCount > 0 && (
            <button
              onClick={startAllReview}
              className="btn-press"
              style={{
                width: "100%", textAlign: "left", marginBottom: 18,
                display: "flex", alignItems: "center", gap: 14, minHeight: 64,
                padding: "14px 18px", borderRadius: 14, cursor: "pointer",
                background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, transparent) 0%, var(--acc-bg) 100%)",
                border: "1px solid var(--acc-bg-h)", fontFamily: FONT,
              }}
            >
              <span style={{
                width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--acc)", color: "var(--on-acc)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
              }}><Layers size={19} strokeWidth={2} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.015em" }}>
                  {dueCount} card{dueCount === 1 ? "" : "s"} due
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--text-secondary)", marginTop: 1 }}>
                  Review now to keep your streak sharp
                </span>
              </span>
              <span style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13, flexShrink: 0 }}>Review →</span>
            </button>
          )}

          {/* Search — only once there are enough classes for it to earn its space. */}
          {(activeView !== "dashboard" || classes.length > 4) && (
            <div style={{ position: "relative", marginBottom: 28 }}>
              <span style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                color: "var(--text-tertiary)", pointerEvents: "none",
                display: "inline-flex", alignItems: "center",
              }}><Search size={15} strokeWidth={1.75} /></span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search units…"
                style={{
                  width: "100%", background: "var(--bg-surface-1)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10, padding: "0 14px 0 38px", height: 40,
                  color: "var(--text-primary)", fontSize: 13.5, fontFamily: FONT, outline: "none",
                  transition: "all 0.18s", letterSpacing: "-0.01em",
                }}
                onFocus={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 2px var(--accent-soft)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--border-default)"; e.target.style.boxShadow = "none"; }}
              />
            </div>
          )}

          {more && (
            <UpcomingDeadlines
              notebooks={notebooks}
              classes={classes}
              onOpen={(nb, classColor) => openUnitWithClassColor(nb, classColor)}
            />
          )}

          {activeView === "dashboard" ? (
            filteredClasses.length === 0 ? (
              !classesLoaded ? null : <EmptyState
                icon={search ? <Search size={32} strokeWidth={1.5} /> : <BookOpen size={32} strokeWidth={1.5} />}
                title={search ? "No classes match" : "Start with a class"}
                body={search
                  ? "Try a different search term."
                  : "A class is one course. Make your own, or join a classmate's with their PIN."}
                cta={!search ? { label: "+ Create your first class", onClick: () => setShowNewClassModal(true) } : null}
                secondary={!search ? { label: "Join a class with a PIN", onClick: onJoinClass } : null}
              />
            ) : (
              // Drag-to-reorder is enabled only when not searching, since the
              // SortableContext items would otherwise be a filtered subset and
              // a persisted order would be incomplete.
              <>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)",
                  fontFamily: FONT, letterSpacing: "0.08em", textTransform: "uppercase",
                  marginBottom: 6,
                }}>Classes</div>
                <Suspense fallback={<div style={{ minHeight: 120 }} />}>
                  <SortableClassList
                    classes={filteredClasses}
                    dragDisabled={!!search}
                    onReorder={handleReorderClasses}
                    cardProps={cls => ({
                      expanded: expandedClassId === cls.id,
                      units: classUnitsCache[cls.id] ?? null,
                      onToggle: () => handleToggleClass(cls.id),
                      onChangeColor: color => handleChangeClassColor(cls.id, color),
                      onOpenUnit: unit => openUnitWithClassColor(unit, cls.color),
                      onViewSyllabus: () => openClassSyllabus(cls.id),
                      onImportSyllabus: () => setSyllabusForClass(cls),
                      onNewUnit: () => setNewUnitFor({ classId: cls.id, classTitle: cls.title }),
                      onDeleteClass: () => setDeleteClassTarget(cls),
                      onInvite: () => onInviteToClass(cls),
                    })}
                  />
                </Suspense>
              </>
            )
          ) : (
            <>
              {/* One list of every unit; "Shared with me" is a filter on it.
                  Replaced the separate My Notes / Shared / Starred views. */}
              <div className="seg-control units-filter" role="radiogroup" aria-label="Which units" style={{ "--seg-n": 2 }}>
                <span className="seg-pill" aria-hidden="true" style={{ transform: `translateX(${unitsFilter === "shared" ? 100 : 0}%)` }} />
                {[["all", "All units"], ["shared", "Shared with me"]].map(([id, label]) => (
                  <button key={id} className="seg-option" role="radio" aria-checked={unitsFilter === id} onClick={() => setUnitsFilter(id)}>{label}</button>
                ))}
              </div>
              {filtered.length === 0 ? (
                <EmptyState
                  icon={search ? <Search size={32} strokeWidth={1.5} /> : unitsFilter === "shared" ? <Users size={32} strokeWidth={1.5} /> : <Notebook size={32} strokeWidth={1.5} />}
                  title={search ? "No units match" : unitsFilter === "shared" ? "Nothing shared with you yet" : "No units yet"}
                  body={search ? "Try a different search term."
                    : unitsFilter === "shared" ? "When a classmate invites you, or you join a class with a PIN, their units show up here."
                    : "Units you create or join will appear here."}
                />
              ) : (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: 12, marginBottom: 40,
                }}>
                  {filtered.map(nb => (
                    <NotebookCard
                      key={nb.id}
                      nb={nb}
                      onClick={() => setActiveNb(nb)}
                      // Only the owner can delete; the API returns role per
                      // notebook, so a shared notebook shows no trash rather
                      // than offering one that 403s.
                      onDelete={nb.role === "member" ? undefined : () => setConfirmDeleteNb(nb)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Dashboard: passive renewal reminder — Pro plan renewing within 3 days.
              No cron needed; computed from the stored current_period_end on load. */}
          {activeView === "dashboard" && subscription.tier === "pro" && renewsIn && (
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading || (subscription.tier === "pro" && !billingReady)}
                className="btn-press"
                style={{
                  width: "100%", textAlign: "left", marginBottom: 18,
                  display: "flex", alignItems: "center", gap: 14, minHeight: 60,
                  padding: "13px 18px", borderRadius: 14,
                  cursor: portalLoading ? "wait" : "pointer",
                  background: "var(--bg-surface-1)", border: "1px solid var(--border-default)",
                  fontFamily: FONT,
                }}
              >
                <span style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "var(--bg-surface-2)", color: "var(--accent)",
                }}><RefreshCw size={17} strokeWidth={1.9} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                    Your Pro plan renews {renewsIn}
                  </span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--text-secondary)", marginTop: 1 }}>
                    Manage or cancel anytime before you're charged
                  </span>
                </span>
                <span style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                  {portalLoading ? "Opening…" : "Manage →"}
                </span>
              </button>
          )}
        </div>

        {showRail && (
          <DashboardRail
            onHide={() => setRail(true)}
            heatmap={heatmap}
            longestStreak={profile?.longest_streak ?? 0}
            leaderboard={leaderboard}
            notifications={notifications}
            setNotifications={setNotifications}
            clearInbox={clearInbox}
            feedActioned={feedActioned}
            feedError={feedError}
            respondToFriendFromFeed={respondToFriendFromFeed}
            onOpenNotebook={openNotebookById}
            onOpenBilling={handleManageSubscription}
          />
        )}
      </div>
    </div>
  );
}
