import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo, Fragment } from "react";
import { api } from "./api.js";
import { supabase } from "./supabase.js";
import AuthModal from "./AuthModal.jsx";
const LandingPage = lazy(() => import("./LandingPage.jsx"));
const LegalPage = lazy(() => import("./LegalPages.jsx"));
import { LegalFooter } from "./LegalFooter.jsx";
import OnboardingWizard from "./components/OnboardingWizard.jsx";
import SharedNotebook from "./components/SharedNotebook.jsx";
import UsernameSetupModal from "./UsernameSetupModal.jsx";
import NotificationsBell from "./NotificationsBell.jsx";
// Lazy: only renders during an active review session. A static import here also
// defeated NotebookView's lazy() of FlashcardsPanel from this same module.
const FlashcardReview = lazy(() => import("./Flashcards.jsx").then(m => ({ default: m.FlashcardReview })));
import { Star, Plus, Hammer, MessageCircle, Users, Settings, LayoutDashboard, ChevronRight, Sparkles, LogOut, AlertTriangle, Check, X, Menu, Notebook, Trash2, CreditCard } from "lucide-react";
import "./App.css";
import { InviteLanding } from "./features/notebook/InviteModal.jsx";
// Lazy: 52kB of source that only matters once a notebook is open, and never
// for anyone still on the landing page.
const NotebookView = lazy(() => import("./features/notebook/NotebookView.jsx").then(m => ({ default: m.NotebookView })));
import { NewClassModal, NewUnitModal } from "./features/classes/ClassModals.jsx";
import { SyllabusImportModal } from "./features/classes/SyllabusImportModal.jsx";
import { ClassSyllabusModal } from "./features/classes/ClassSyllabusModal.jsx";
import { ConfirmDeleteClassModal } from "./features/classes/ClassCard.jsx";
import { FriendsRow } from "./features/friends/FriendsRow.jsx";
import { MobileTabBar } from "./features/shell/MobileTabBar.jsx";
import { MobileProfileSheet } from "./features/shell/MobileProfileSheet.jsx";

import { SettingsView } from "./features/settings/SettingsView.jsx";
import { PasswordResetModal } from "./features/account/PasswordResetModal.jsx";
import { DeleteAccountModal } from "./features/account/DeleteAccountModal.jsx";
import { TermsWall } from "./features/account/TermsWall.jsx";
import { UpgradeModal } from "./features/billing/UpgradeModal.jsx";
import { WelcomeProModal } from "./features/billing/WelcomeProModal.jsx";
import { StreakMilestoneModal } from "./features/streak/StreakMilestoneModal.jsx";

import { DashboardView } from "./features/dashboard/DashboardView.jsx";

import { Avatar } from "./ui/Avatar.jsx";
import { HudBar } from "./ui/HudBar.jsx";
import { FONT, FONT_HEADING } from "./lib/theme.js";
import { STREAK_MILESTONES, getDisplayName, getGreeting, computeStreak, streakAtRiskFromHeatmap, sameUser } from "./lib/format.js";
import { APP_ORIGIN, IS_MARKETING_HOST, readAuthIntentFromUrl } from "./lib/env.js";
import { MOBILE_QUERY } from "./lib/breakpoints.js";
import { onCheckoutReturn } from "./lib/native.js";
import { useBilling } from "./lib/useBilling.js";

import { useFriendPresence } from "./lib/live.js";
import { useAppearance } from "./lib/useAppearance.js";
import { useCanonicalUrl } from "./lib/useCanonicalUrl.js";
import { useNotificationFeed } from "./lib/useNotificationFeed.js";
import { useNotebookActions } from "./lib/useNotebookActions.js";

// Module-scoped guard: only ever call /track-visit once per page load,
// even if the auth effect re-runs (e.g. on sign-in after landing-page view).
let _visitTrackedThisSession = false;

// Two-domain split: getscholr.com is the marketing site, scholr.dev is the app.
// Auth + the Supabase session live on the app origin (sessions are per-origin and
// cannot cross to a different domain), so marketing CTAs bounce users to APP_ORIGIN
// to sign in rather than authenticating on getscholr.com.

// Reads ?auth=signup|signin from the URL → normalized tab ("signup"/"login"), or
// null. Used to derive the AuthModal's INITIAL open state so it paints open on the
// first render (visitors arriving from getscholr.com), with no effect/double-render.

// Warm tint palette for class/member color accents (deterministic by id/name)

// Named class-color palette (the .color column stores the hex `hue`)

// ── PodcastPanel ────────────────────────────────────────────────────────────
// Two-host AI audio overview of a notebook. Pro-gated. Mirrors TheForge's
// width/layout so it slots into the same desktop side-panel + mobile overlay
// containers. Audio segments come from /podcast/generate (async) and are
// played by a custom <audio> player (no native controls) so we can offer
// playback-speed and downloads consistently across browsers.

const NAV = [
  { id: "dashboard", label: "Dashboard",  Icon: LayoutDashboard },
  { id: "my-notes",  label: "My Notes",   Icon: Notebook },
  { id: "shared",    label: "Shared",     Icon: Users },
  { id: "starred",   label: "Starred",    Icon: Star },
  { id: "settings",  label: "Settings",   Icon: Settings },
];

// Streak alive but at risk = yesterday had activity, today does not (yet).


export default function Scholr() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [termsGate, setTermsGate] = useState(null); // null = unknown, "ok" = accepted, "needed" = must accept
  const [onboarding, setOnboarding] = useState("ok"); // "ok" | "needed" (first-login wizard)
  const [profile, setProfile] = useState(null);       // profile flags: streak, milestones, referral
  const [streakBannerDismissed, setStreakBannerDismissed] = useState(false);
  const [milestoneModal, setMilestoneModal] = useState(null); // { day } | null
  const [activeView, setActiveView] = useState("dashboard");
  const [activeNb, setActiveNb] = useState(null);
  const [search, setSearch] = useState("");
  const [notebooks, setNotebooks] = useState([]);
  const [ownedNotebooks, setOwnedNotebooks] = useState([]);
  const [sharedNotebooks, setSharedNotebooks] = useState([]);
  const [starredNotebooks, setStarredNotebooks] = useState([]);
  const [starredIds, setStarredIds] = useState(new Set());
  const [classes, setClasses] = useState([]);
  const [expandedClassId, setExpandedClassId] = useState(null);
  // Require a 4px drag before activating so taps/clicks on the card body
  // don't accidentally start drags from the handle press.
  const [classUnitsCache, setClassUnitsCache] = useState({});
  const [showNewClassModal, setShowNewClassModal] = useState(false);
  const [showSyllabusModal, setShowSyllabusModal] = useState(false);
  const [syllabusForClass, setSyllabusForClass] = useState(null); // import into an existing class
  const [newUnitFor, setNewUnitFor] = useState(null);
  const [toast, setToast] = useState("");
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteClassTarget, setDeleteClassTarget] = useState(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showAuth, setShowAuth] = useState(() => readAuthIntentFromUrl() !== null);
  const [authIntent, setAuthIntent] = useState(() => readAuthIntentFromUrl() || "signup"); // tab: "signup" | "login"
  const [pendingInviteToken, setPendingInviteToken] = useState(null);
  const [pendingSquadToken, setPendingSquadToken] = useState(null);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [showInviteAuth, setShowInviteAuth] = useState(false);
  const [heatmap, setHeatmap] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const { theme, setTheme, accentColor, setAccentColor } = useAppearance();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMobileFriends, setShowMobileFriends] = useState(false);
  const [myUsername, setMyUsername] = useState(undefined); // undefined=loading, null=unset, string=set
  const [dueCount, setDueCount] = useState(0);            // flashcards due across all notebooks
  const [reviewSession, setReviewSession] = useState(null); // active all-notebooks review (cards[])
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const [upgradeModal, setUpgradeModal] = useState(null); // null | { limitType: string }
  const [welcomePlan, setWelcomePlan] = useState(null); // null | "pro" | "squad" — just paid, show what unlocked
  const [confirmDeleteNb, setConfirmDeleteNb] = useState(null); // notebook pending deletion

  const {
    subscription, setSubscription, portalLoading, billingReady,
    openPortal: handleManageSubscription, refreshSubscription,
  } = useBilling({ onToast: msg => { setToast(msg); setTimeout(() => setToast(""), 3500); } });

  // Every notebook/class CRUD handler — moved out of this component into one
  // hook (src/lib/useNotebookActions.js). State those handlers read/write
  // stays declared here, since the JSX above and below still reads most of it
  // directly; the hook takes it in and hands back logic, not a second copy.
  const {
    deletingNb, syllabusClassId, setSyllabusClassId,
    removeNotebooksByIds, handleDeleteNotebook,
    handleSetStatus, handleSetDueDate, handleSetAssessmentType,
    openNotebookById, handleToggleClass, openClassSyllabus,
    handleCreateClass, handleImportSyllabus, handleImportSyllabusIntoClass,
    handleChangeClassColor, handleReorderClasses, handleCreateUnit,
    openUnitWithClassColor, handleToggleStar, handleDeleteClass,
  } = useNotebookActions({
    user, activeNb,
    notebooks, setNotebooks,
    ownedNotebooks, setOwnedNotebooks,
    sharedNotebooks, setSharedNotebooks,
    starredNotebooks, setStarredNotebooks,
    starredIds, setStarredIds,
    classes, setClasses,
    classUnitsCache, setClassUnitsCache,
    expandedClassId, setExpandedClassId,
    setActiveNb, setActiveView,
    setToast, setShowMobileFriends,
    setConfirmDeleteNb,
    setUpgradeModal, setShowNewClassModal, setNewUnitFor,
    setSubscription,
  });

  // Online presence: heartbeat on mount + every 60s while the app is open. It
  // carries the notebook currently open so friends see "Noah is in Bio 101"
  // rather than a bare green dot — that's what turns presence into company.
  // Heartbeat + realtime presence + the refresh counter, all in one place:
  // additive over the 60s poll so a friend coming online shows in ~1s, with
  // polling left as the safety net if Realtime is unavailable.
  // friendIds itself stays inside the hook — FriendsRow owns the list and
  // hands it up via onFriendIds purely so presence can fan out to it.
  const { setFriendIds, friendsVersion, bumpFriendsVersion } =
    useFriendPresence(user?.id, activeNb?.id);

  const {
    notifications, setNotifications,
    feedActioned, feedError, notifVersion,
    clearInbox, respondToFriendFromFeed,
  } = useNotificationFeed(user, { onFriendRequestHandled: bumpFriendsVersion });


  useEffect(() => {
    if (!profileOpen) return;
    // Mobile renders its own profile sheet (outside profileRef) which dismisses via
    // its backdrop. Without this guard the mousedown below closes the sheet before
    // click lands, killing every button inside it.
    if (window.matchMedia(MOBILE_QUERY).matches) return;
    function handleOutsideClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [profileOpen]);

  // Supabase hands back a NEW object for the same person on every auth event,
  // and this component sets the user from both getSession() and
  // onAuthStateChange — which both fire on a single sign-in. Every effect keyed
  // on `user` therefore ran twice for one identity, and with StrictMode's
  // double-invoke on top that was 52 API requests to paint one dashboard
  // against a six-connection browser limit: the last of them landed seven
  // seconds in, and the streak rail shifted the layout at 2.5s.
  //
  // Fixed here rather than by keying eight effects on user?.id, which would
  // have made every one of their dependency lists a lie. Hold the previous
  // object when it describes the same person, and `user` is simply stable.
  const setUserStable = useCallback(next => {
    setUser(prev => (sameUser(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserStable(session?.user ?? null);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") { setShowPasswordReset(true); return; }
      setUserStable(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [setUserStable]);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/invite\/([^/]+)/);
    if (!match) return;
    const token = match[1];
    setPendingInviteToken(token);
    window.history.replaceState({}, "", "/");
    api.getInvite(token).then(setInviteInfo).catch(() => {});
  }, []);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/squad-invite\/([^/]+)/);
    if (!match) return;
    setPendingSquadToken(match[1]);
    window.history.replaceState({}, "", "/");
  }, []);

  useEffect(() => {
    if (!pendingSquadToken || !user || !authReady) return;
    const token = pendingSquadToken;
    setPendingSquadToken(null);
    api.joinSquad(token)
      .then(() => {
        setActiveView("settings");
        setWelcomePlan("squad");
      })
      .catch(err => {
        setToast(err.message || "Couldn't join that squad.");
        setTimeout(() => setToast(""), 4000);
      });
  }, [pendingSquadToken, user, authReady]);

  useEffect(() => {
    if (!pendingInviteToken || !user || !authReady) return;
    const token = pendingInviteToken;
    setPendingInviteToken(null);
    supabase.auth.getSession()
      .then(() => api.acceptInvite(token))
      .then(({ notebook_id }) => {
        return Promise.all([
          api.listNotebooks(getDisplayName(user)),
          api.listSharedNotebooks(getDisplayName(user)),
        ]).then(([nbs, shared]) => {
          setNotebooks(nbs);
          setSharedNotebooks(shared);
          const nb = shared.find(n => n.id === notebook_id) ?? nbs.find(n => n.id === notebook_id);
          if (nb) { setActiveNb(nb); setActiveView("dashboard"); }
        });
      })
      .catch(console.error);
  }, [pendingInviteToken, user, authReady]);

  // Fourteen requests, keyed on `user`. See setUserStable: the identity of that
  // object is what decides whether this runs once or three times.
  useEffect(() => {
    if (!user || !authReady) return;
    const name = getDisplayName(user);

    // Terms gate: existing users (pre age-gate) have no accepted-terms record →
    // must accept before using the app. Fail-open on transient error (re-checked
    // next load) so a flaky check never locks anyone out.
    api.getTermsStatus()
      .then(s => setTermsGate(s?.accepted ? "ok" : "needed"))
      .catch(() => setTermsGate("ok"));

    // Notebooks + profile together. First login (no notebooks, not onboarded) →
    // seed a "Welcome to Scholr" notebook with a demo note + AI aha and drop the
    // user straight into it, instead of an empty dashboard or setup wizard.
    Promise.all([api.listNotebooks(name), api.getProfile()])
      .then(async ([nbs, prof]) => {
        if (prof && !prof.onboarding_completed && nbs.length === 0) {
          const r = await api.seedWelcome().catch(() => ({ seeded: false }));
          if (r.seeded && r.notebookId) {
            const fresh = await api.listNotebooks(name).catch(() => nbs);
            setNotebooks(fresh);
            setProfile({ ...(prof || {}), onboarding_completed: true });
            setOnboarding("ok");
            const welcome = fresh.find(n => n.id === r.notebookId);
            if (welcome) { setActiveNb(welcome); setActiveView("dashboard"); }
            return;
          }
        }
        setNotebooks(nbs);
        setProfile(prof);
        setOnboarding(prof && !prof.onboarding_completed && nbs.length === 0 ? "needed" : "ok");
      })
      .catch(console.error);
    api.listOwnedNotebooks(name).then(setOwnedNotebooks).catch(console.error);
    api.listSharedNotebooks(name).then(setSharedNotebooks).catch(console.error);
    api.getStarredNotebooks(name)
      .then(starred => {
        setStarredNotebooks(starred);
        setStarredIds(new Set(starred.map(n => n.id)));
      })
      .catch(console.error);
    api.listClasses().then(setClasses).catch(console.error);
    api.getSocialNotifications().then(d => setNotifications(d?.notifications ?? [])).catch(console.error);
    api.getSubscription().then(setSubscription).catch(console.error);
    // A failed request is not the same as "this person has no username". The
    // catch used to collapse both to null, which is the state that opens the
    // first-run username modal — so an expired token showed a brand-new user a
    // blocking setup prompt, whose own save then failed with the same 401, with
    // no dismiss and no way to reach Sign out. Stay in the loading state on
    // failure: no modal, and the session refresh gets a chance to land.
    api.getMyUsername()
      .then(d => setMyUsername(d?.username ?? null))
      .catch(err => { console.warn("getMyUsername failed:", err?.message); setMyUsername(undefined); });
    api.getDueCount().then(d => setDueCount(d?.count ?? 0)).catch(() => {});

    // Mark today as an "active" day for the streak, then re-read the heatmap so
    // today's square is filled in.
    //
    // The re-read used to be the ONLY read, chained off trackVisit's .finally —
    // two round trips in series for the panel that sits at the top of the rail,
    // which is why the streak arrived 2.5s in and shifted the layout under it.
    // Fetch it straight away as well: the first response paints the streak
    // immediately and is correct in every case except today's own square, and
    // the second overwrites it a moment later. Module-scoped flag keeps
    // trackVisit itself to once per session.
    api.getActivityHeatmap().then(setHeatmap).catch(console.error);
    if (!_visitTrackedThisSession) {
      _visitTrackedThisSession = true;
      const dateLabel = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
      api.trackVisit(dateLabel)
        .catch(err => { console.warn("trackVisit failed:", err.message); })
        .finally(() => {
          api.getActivityHeatmap().then(setHeatmap).catch(console.error);
        });
    }
    api.getFriendsLeaderboard().then(setLeaderboard).catch(console.error);

    // Handle ?upgraded=true from Stripe success redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true") {
      window.history.replaceState({}, "", "/app");
      setWelcomePlan("pro");
    }
  }, [user, authReady]);

  // api.js fires this once when a 401 survives a refresh attempt: the session
  // is genuinely gone. Without it the app carries on rendering a plausible,
  // entirely false UI — streak 0, plan Free, no friends — because each caller
  // swallows its own failure. Say so and send them back to sign in.
  useEffect(() => {
    const onExpired = () => {
      // Only meaningful to someone who had a session. A 401 can also come from
      // a call made while signed out, and telling a first-time visitor on the
      // marketing page that their session expired is both false and alarming.
      if (!user) return;
      setToast({ text: "Your session expired — please sign in again.", tone: "error" });
      setTimeout(() => { supabase.auth.signOut().catch(() => {}); }, 1800);
    };
    window.addEventListener("scholr:session-expired", onExpired);
    return () => window.removeEventListener("scholr:session-expired", onExpired);
  }, [user]);

  // The mobile freeze in App.css pins html/body with position:fixed so the
  // document cannot be dragged and only the inner panes scroll. That is right
  // for the app shell and fatal for the landing page, which is an ordinary
  // 5,600px document with no inner scroller — every phone visitor to scholr.dev
  // got the hero and nothing below it. Scope the freeze to when the shell is
  // actually the thing on screen.
  useEffect(() => {
    document.documentElement.classList.toggle("app-shell-active", !!user);
    return () => document.documentElement.classList.remove("app-shell-active");
  }, [user]);

  // Coming back from Stripe in the iOS app. Checkout runs in the system
  // browser, so unlike the web's ?upgraded=true redirect the webview never
  // navigates and nothing refetches on its own — the app was simply in the
  // background. No-op on web, where onCheckoutReturn returns an empty
  // unsubscribe. The webhook is what actually grants the plan, so a refetch
  // that lands ahead of it just shows the old tier until the next load.
  useEffect(() => {
    if (!user) return undefined;
    return onCheckoutReturn(status => {
      if (status !== "success") return;
      refreshSubscription();
      setWelcomePlan("pro");
    });
  }, [user]);

  useCanonicalUrl(authReady, user);

  // Streak gamification: bump longest streak + fire one-time milestone modals.
  // All setState happens inside async callbacks (never synchronously in the
  // effect) to avoid cascading re-renders; guards keep it idempotent.
  useEffect(() => {
    if (!user || !profile || !heatmap.length) return;
    const streak = computeStreak(heatmap);
    if (streak > (profile.longest_streak ?? 0)) {
      api.updateStreak(streak)
        .then(() => setProfile(p => ({ ...p, longest_streak: streak })))
        .catch(() => {});
    }
    const shown = new Set((profile.streak_milestones_shown ?? []).map(String));
    if (STREAK_MILESTONES.includes(streak) && !shown.has(String(streak))) {
      api.recordStreakMilestone(streak)
        .catch(() => {})
        .finally(() => {
          setMilestoneModal({ day: streak });
          setProfile(p => ({ ...p, streak_milestones_shown: [...(p.streak_milestones_shown ?? []), String(streak)] }));
        });
    }
  }, [user, profile, heatmap]);

  // Launch an all-notebooks flashcard review from the dashboard.
  async function startAllReview() {
    try {
      const { cards } = await api.getDueFlashcards();
      if (cards.length) setReviewSession(cards);
      else { setToast("No cards due — you're caught up"); setTimeout(() => setToast(""), 2500); }
    } catch { setToast({ text: "Couldn't load due cards", tone: "error" }); setTimeout(() => setToast(""), 2500); }
  }

  async function endReviewSession() {
    setReviewSession(null);
    try { const d = await api.getDueCount(); setDueCount(d?.count ?? 0); } catch { /* ignore */ }
  }



  async function handleDeleteAccount() {
    await api.deleteAccount();    // cleans DB rows + deletes auth user
    localStorage.clear();
    await api.signOut();          // notifies server + clears local Supabase session
    window.location.href = "/";  // hard-navigate to landing; clears all React state
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const displayName = getDisplayName(user);
  // Rolled once per visit, not per render — otherwise any unrelated state
  // change would reshuffle the greeting and quote mid-session.
  const greeting = useMemo(() => getGreeting(displayName), [displayName]);
  // Large-title collapse. The pane's scroll position drives two things that
  // have to move together — the big heading falling away and the compact title
  // rising into the status strip — so it is published as one 0..1 custom
  // property on the root rather than component state: at 57 useState hooks in
  // this component, a scroll frame that re-renders is a scroll frame that
  // drops. CSS reads it from anywhere in the tree, which the strip needs,
  // since it is not inside the pane.
  useEffect(() => {
    // A view change resets the pane's scrollTop without firing a scroll event,
    // which would otherwise leave the compact title stuck on screen.
    document.documentElement.style.setProperty("--pane-scroll", "0");
  }, [activeView, activeNb]);
  const streakAtRisk = streakAtRiskFromHeatmap(heatmap);

  const filteredClasses = classes.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const viewBase = activeView === "my-notes" ? ownedNotebooks
    : activeView === "shared"   ? sharedNotebooks
    : activeView === "starred"  ? starredNotebooks
    : notebooks;

  const filtered = viewBase.filter(n => {
    const q = search.toLowerCase();
    return n.title.toLowerCase().includes(q) || (n.topic || "").toLowerCase().includes(q);
  });

  const viewLabel = NAV.find(n => n.id === activeView)?.label ?? "Dashboard";

  // Public shared-notebook route (/s/:slug) — standalone, no auth required.
  const shareMatch = (typeof window !== "undefined" ? window.location.pathname : "").match(/^\/s\/([A-Za-z0-9]+)/);
  if (shareMatch) return <SharedNotebook slug={shareMatch[1]} />;

  // Public legal routes — render standalone regardless of auth (no router).
  const legalPage = { "/privacy": "privacy", "/terms": "terms", "/copyright": "copyright" }[
    typeof window !== "undefined" ? window.location.pathname : ""
  ];
  if (legalPage) return <Suspense fallback={null}><LegalPage page={legalPage} /></Suspense>;

  return (
    <>
      {/* Terms wall — authed app only; never on landing/legal (those return earlier) */}
      {user && authReady && termsGate === "needed" && (
        <TermsWall onAccepted={() => setTermsGate("ok")} />
      )}

      {/* First-login onboarding wizard — only after terms are accepted */}
      {user && authReady && termsGate === "ok" && onboarding === "needed" && (
        <OnboardingWizard
          user={user}
          onComplete={() => {
            setOnboarding("ok");
            const nm = getDisplayName(user);
            api.listNotebooks(nm).then(setNotebooks).catch(() => {});
            api.listClasses().then(setClasses).catch(() => {});
          }}
        />
      )}

      {/* Streak milestone celebration */}
      {milestoneModal && (
        <StreakMilestoneModal day={milestoneModal.day} onClose={() => setMilestoneModal(null)} />
      )}

      {pendingInviteToken && authReady && !user && (
        <InviteLanding inviteInfo={inviteInfo} onSignIn={() => setShowInviteAuth(true)} />
      )}

      {authReady && !user && !showPasswordReset && !pendingInviteToken && !showAuth && (
        <Suspense fallback={null}>
        <LandingPage onSignIn={() => {
          // Marketing domain can't host the session → send users to the app origin to sign in.
          if (IS_MARKETING_HOST) { window.location.href = `${APP_ORIGIN}/?auth=signup`; return; }
          setAuthIntent("signup");
          setShowAuth(true);
        }} />
        </Suspense>
      )}

      {authReady && !user && !showPasswordReset && (showAuth || showInviteAuth) && (
        <AuthModal initialTab={authIntent} onAuth={(u) => {
          setShowAuth(false); setShowInviteAuth(false); setUserStable(u);
          // Land the freshly-authed user in the app. On the app origin this is just a
          // URL tidy-up; the marketing-host branch is a defensive fallback (shouldn't fire).
          if (IS_MARKETING_HOST) { window.location.href = `${APP_ORIGIN}/app`; return; }
          window.history.replaceState({}, "", "/app");
        }} />
      )}

      {showPasswordReset && (
        <PasswordResetModal onDone={() => {
          setShowPasswordReset(false);
          setToast("Password updated");
          setTimeout(() => setToast(""), 3000);
        }} />
      )}

      {showDeleteAccount && (
        <DeleteAccountModal
          onClose={() => setShowDeleteAccount(false)}
          onConfirm={handleDeleteAccount}
        />
      )}

      {deleteClassTarget && (
        <ConfirmDeleteClassModal
          cls={deleteClassTarget}
          onClose={() => setDeleteClassTarget(null)}
          onConfirm={() => handleDeleteClass(deleteClassTarget.id)}
        />
      )}

      {confirmDeleteNb && (
        <div
          onClick={e => { if (e.target === e.currentTarget && !deletingNb) setConfirmDeleteNb(null); }}
          style={{
            position: "fixed", inset: 0, zIndex: 3200,
            background: "rgba(0,0,0,0.66)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
            animation: "fadeIn 0.16s ease",
          }}
        >
          <div style={{
            width: "100%", maxWidth: 380, background: "var(--s1)",
            border: "1px solid var(--border)", borderRadius: "var(--r-lg)",
            padding: 22, boxShadow: "var(--sh-modal)",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.28)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--danger)", marginBottom: 14,
            }}><Trash2 size={18} strokeWidth={1.75} /></div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)", fontFamily: FONT_HEADING, marginBottom: 6 }}>
              Delete this notebook?
            </div>
            <div style={{ fontSize: 13, color: "var(--t2)", fontFamily: FONT, lineHeight: 1.55, marginBottom: 20 }}>
              <span style={{ color: "var(--t1)", fontWeight: 500 }}>{confirmDeleteNb.title}</span>{" "}
              and all of its notes will be permanently deleted. This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmDeleteNb(null)}
                disabled={deletingNb}
                style={{
                  height: 38, padding: "0 14px", borderRadius: 8, cursor: deletingNb ? "default" : "pointer",
                  background: "transparent", border: "1px solid var(--border)",
                  color: "var(--t2)", fontFamily: FONT, fontSize: 13.5, fontWeight: 500,
                }}
              >Cancel</button>
              <button
                onClick={() => handleDeleteNotebook(confirmDeleteNb)}
                disabled={deletingNb}
                style={{
                  height: 38, padding: "0 16px", borderRadius: 8, cursor: deletingNb ? "wait" : "pointer",
                  background: "var(--danger)", border: "none",
                  color: "#1A0A0A", fontFamily: FONT, fontSize: 13.5, fontWeight: 650,
                }}
              >{deletingNb ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {upgradeModal && (
        <UpgradeModal
          limitType={upgradeModal.limitType}
          onClose={() => setUpgradeModal(null)}
        />
      )}

      {welcomePlan && (
        <WelcomeProModal plan={welcomePlan} onClose={() => setWelcomePlan(null)} />
      )}

      {/* The toast was green with a tick regardless of what it said, so
          "Your session expired" and "Couldn't update color" both arrived
          looking like good news. setToast still takes a plain string — all 39
          existing callers are untouched — and an object when the tone matters. */}
      {toast && (() => {
        const text = typeof toast === "string" ? toast : toast.text;
        const tone = (typeof toast === "object" && toast.tone) || "success";
        const c = tone === "error" ? "var(--danger)" : "var(--success)";
        const ToneIcon = tone === "error" ? AlertTriangle : Check;
        return (
          <div style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            background: "var(--s2)",
            border: `1px solid color-mix(in srgb, ${c} 32%, transparent)`,
            borderRadius: "var(--r-md)", padding: "0 18px", height: 42,
            fontSize: "var(--fs-sm)", color: c, fontWeight: 600,
            fontFamily: FONT,
            boxShadow: "var(--sh-modal)",
            zIndex: 2000, animation: "slideInUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
            display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
            letterSpacing: "-0.01em",
            maxWidth: "calc(100vw - 32px)", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: "50%",
              background: `color-mix(in srgb, ${c} 16%, transparent)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: c, flexShrink: 0,
            }}><ToneIcon size={12} strokeWidth={2.5} /></span>
            {text}
          </div>
        );
      })()}

      {showNewClassModal && (
        <NewClassModal
          onClose={() => setShowNewClassModal(false)}
          onImportSyllabus={() => { setShowNewClassModal(false); setShowSyllabusModal(true); }}
          onCreate={handleCreateClass}
        />
      )}

      {showSyllabusModal && (
        <SyllabusImportModal
          onClose={() => setShowSyllabusModal(false)}
          onCreated={handleImportSyllabus}
        />
      )}

      {syllabusForClass && (
        <SyllabusImportModal
          targetClass={syllabusForClass}
          onClose={() => setSyllabusForClass(null)}
          onCreated={(_name, notebooks) => handleImportSyllabusIntoClass(syllabusForClass, notebooks)}
        />
      )}

      {syllabusClassId && (() => {
        const cls = classes.find(c => c.id === syllabusClassId);
        if (!cls) return null;
        return (
          <ClassSyllabusModal
            cls={cls}
            units={classUnitsCache[syllabusClassId] ?? []}
            onClose={() => setSyllabusClassId(null)}
            onOpenUnit={unit => { setSyllabusClassId(null); openUnitWithClassColor(unit, cls.color); }}
            onDueDateChange={handleSetDueDate}
            onAssessmentTypeChange={handleSetAssessmentType}
            onStatusChange={handleSetStatus}
          />
        );
      })()}

      {newUnitFor && (
        <NewUnitModal
          classTitle={newUnitFor.classTitle}
          onClose={() => setNewUnitFor(null)}
          onCreate={(title, topic) => handleCreateUnit(newUnitFor.classId, title, topic)}
        />
      )}

      {/* App shell. nb-open lets the phone reclaim the status strip's height
          while a notebook is open — see the rule in hud.css. */}
      <div className={activeNb ? "nb-open" : ""} style={{
        // dvh, not vh: on iOS `100vh` is the *large* viewport, which ignores
        // Safari's toolbar, so the shell ran taller than the visible area and
        // the bottom tab bar sat behind the chrome — unreachable once the page
        // itself stopped scrolling.
        height: "100dvh", overflow: "hidden",
        background: "var(--bg-base)",
        display: user ? "flex" : "none", flexDirection: "column", fontFamily: FONT,
      }}>
        <HudBar
          view={viewLabel}
          streak={computeStreak(heatmap)}
          due={dueCount}
          classes={classes.length}
          tier={subscription?.tier ?? "free"}
        />
        <div className={sidebarOpen ? "" : "mobile-hide-sidebar"}
             style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
        {sidebarOpen && (
          <div className="sidebar-backdrop mobile-only" onClick={() => setSidebarOpen(false)} />
        )}
        {/* Sidebar */}
        <div className="sidebar" style={{
          width: 240,
          background: "var(--bg-chrome)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex", flexDirection: "column",
          flexShrink: 0, overflow: "hidden",
          position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 200,
        }}>
          {/* Scrollable section: brand + nav */}
          <div style={{
            flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0,
            padding: "20px 12px 8px",
            display: "flex", flexDirection: "column", gap: 2,
          }}>
          {/* Brand */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: 22, paddingLeft: 8,
          }}>
            <img
              src={theme === "light" ? "/scholr-logo-white.png" : "/scholr-logo-final.png"}
              alt="scholr"
              style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
            />
            <div style={{
              fontSize: 21, fontWeight: 600,
              color: "var(--text-primary)", letterSpacing: "-0.01em",
              fontFamily: FONT_HEADING,
            }}>
              {/* outer span = one inline box → letter-spacing holds across the color split */}
              <span>schol<span style={{ color: "var(--accent)" }}>r</span></span>
            </div>
            <span style={{ marginLeft: "auto" }}><NotificationsBell onOpenNotebook={openNotebookById} onOpenBilling={handleManageSubscription} reloadSignal={notifVersion} /></span>
            <button
              className="mobile-only"
              onClick={() => setSidebarOpen(false)}
              title="Close menu"
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "1px solid var(--border-default)",
                borderRadius: 8, width: 28, height: 28, cursor: "pointer",
                color: "var(--text-secondary)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            ><X size={14} strokeWidth={1.75} /></button>
          </div>

          {/* Nav */}
          {NAV.map(({ id, label, Icon }) => {
            const active = activeView === id;
            return (
              <Fragment key={id}>
              <div
                onClick={() => { setActiveView(id); setActiveNb(null); setSearch(""); setSidebarOpen(false); }}
                style={{
                  position: "relative",
                  padding: "0 12px", height: 34, borderRadius: 6,
                  display: "flex", alignItems: "center", gap: 10,
                  background: active ? "var(--bg-surface-2)" : "transparent",
                  boxShadow: active ? "inset 2px 0 0 var(--accent)" : "none",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  cursor: "pointer", transition: "background 150ms ease, color 150ms ease",
                  userSelect: "none",
                  letterSpacing: "-0.01em",
                  marginBottom: 1,
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "var(--bg-surface-2)"; e.currentTarget.style.color = "var(--text-primary)"; }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}}
              >
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 18, opacity: active ? 1 : 0.85,
                }}>
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                {label}
                {id === "dashboard" && dueCount > 0 && (
                  <span style={{
                    marginLeft: "auto", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9,
                    background: "var(--accent)", color: "var(--on-acc)", fontSize: 10.5, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: FONT,
                  }}>{dueCount > 99 ? "99+" : dueCount}</span>
                )}
              </div>
              </Fragment>
            );
          })}

          </div>{/* end scrollable nav section */}

          <LegalFooter compact />

          {/* Usage indicator — free users only */}
          {subscription.tier === "free" && (
            <div style={{ padding: "0 12px 10px", flexShrink: 0 }}>
              <div style={{
                background: "var(--bg-surface-2)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 10, padding: "10px 12px",
              }}>
                {/* Messages */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT, display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <MessageCircle size={12} strokeWidth={1.75} /> Messages
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT }}>
                      {subscription.messagesUsed}/{subscription.messagesLimit}
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--bg-surface-3)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      width: `${Math.min(100, Math.round((subscription.messagesUsed / subscription.messagesLimit) * 100))}%`,
                      background: subscription.messagesUsed >= subscription.messagesLimit
                        ? "#F87171"
                        : "linear-gradient(90deg, #A78BFA, #8B5CF6)",
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                </div>
                {/* Forge */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT, display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Hammer size={12} strokeWidth={1.75} /> Forge
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT }}>
                      {subscription.forgeUsed}/{subscription.forgeLimit}
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--bg-surface-3)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      width: `${Math.min(100, Math.round((subscription.forgeUsed / subscription.forgeLimit) * 100))}%`,
                      background: subscription.forgeUsed >= subscription.forgeLimit
                        ? "#F87171"
                        : "linear-gradient(90deg, #FBBF24, #F59E0B)",
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                </div>
                {/* Notes / storage */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT, display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Notebook size={12} strokeWidth={1.75} /> Notes
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT }}>
                      {subscription.notebooksUsed}/{subscription.notebooksLimit}
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--bg-surface-3)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      width: `${Math.min(100, Math.round((subscription.notebooksUsed / subscription.notebooksLimit) * 100))}%`,
                      background: subscription.notebooksUsed >= subscription.notebooksLimit
                        ? "#F87171"
                        : "linear-gradient(90deg, #34D399, #10B981)",
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                </div>
                <button
                  onClick={() => setUpgradeModal({ limitType: "upgrade" })}
                  style={{
                    width: "100%", height: 30,
                    background: "linear-gradient(135deg, rgba(167,139,250,0.18), var(--acc-bg))",
                    border: "1px solid color-mix(in srgb, var(--acc) 25%, transparent)",
                    borderRadius: 7, color: "var(--acc)",
                    fontSize: 11.5, fontWeight: 600, fontFamily: FONT,
                    cursor: "pointer", letterSpacing: "-0.01em",
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                    <Sparkles size={13} strokeWidth={1.75} /> Upgrade to Pro
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Profile card — pinned to bottom, never scrolls away */}
          <div style={{ padding: "0 12px 16px", flexShrink: 0 }}>
          <div ref={profileRef} style={{ position: "relative" }}>
            {profileOpen && (
              <div style={{
                position: "absolute", bottom: "calc(100% + 8px)", left: 0, right: 0,
                background: "var(--bg-surface-1)",
                border: "1px solid var(--border-default)",
                borderRadius: 12, padding: "12px",
                boxShadow: "var(--sh-modal)",
                animation: "slideInUp 0.15s ease",
                zIndex: 100,
              }}>
                {/* Header */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
                </div>
                <div style={{ height: 1, background: "var(--border-subtle)", marginBottom: 6 }} />
                {/* Settings link */}
                <button
                  onClick={() => { setProfileOpen(false); setActiveView("settings"); setActiveNb(null); }}
                  style={{
                    width: "100%", background: "transparent", border: "none",
                    borderRadius: 7, padding: "8px 8px", color: "var(--text-primary)",
                    fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                    fontFamily: FONT, textAlign: "left",
                    display: "flex", alignItems: "center", gap: 8,
                    transition: "background 0.15s",
                    marginBottom: 2,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-surface-2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <Settings size={13} strokeWidth={1.75} /> Settings
                </button>
                {/* Sign out */}
                <button
                  onClick={() => { setProfileOpen(false); handleLogout(); }}
                  style={{
                    width: "100%", background: "transparent", border: "none",
                    borderRadius: 7, padding: "8px 8px", color: "var(--danger)",
                    fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                    fontFamily: FONT, textAlign: "left",
                    display: "flex", alignItems: "center", gap: 8,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(248,113,113,0.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <LogOut size={13} strokeWidth={1.75} /> Sign out
                </button>
              </div>
            )}
            <div
              onClick={() => setProfileOpen(v => !v)}
              style={{
                background: profileOpen ? "var(--bg-surface-2)" : "var(--bg-surface-1)",
                border: `1px solid ${profileOpen ? "var(--border-default)" : "var(--border-subtle)"}`,
                borderRadius: 10, padding: "10px",
                display: "flex", alignItems: "center", gap: 10,
                cursor: "pointer", transition: "background 0.15s, border-color 0.15s",
                userSelect: "none",
              }}
              onMouseEnter={e => { if (!profileOpen) { e.currentTarget.style.background = "var(--bg-surface-2)"; e.currentTarget.style.borderColor = "var(--border-default)"; }}}
              onMouseLeave={e => { if (!profileOpen) { e.currentTarget.style.background = "var(--bg-surface-1)"; e.currentTarget.style.borderColor = "var(--border-subtle)"; }}}
            >
              <Avatar name={displayName} size={32} seed={user?.email ?? displayName} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{displayName}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
              </div>
              <div style={{ color: "var(--text-tertiary)", flexShrink: 0, display: "inline-flex" }}>
                <ChevronRight size={12} strokeWidth={2} style={{ transform: profileOpen ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform 0.15s" }} />
              </div>
            </div>
          </div>
          </div>{/* end padding wrapper */}
        </div>

        {/* Main */}
        {/* height:100vh was wrong here: this pane is a flex child of a row
            that is already the viewport minus the 36px status strip, so a
            100vh pane overflowed its container by exactly the strip height
            and the notebook view — which sizes itself to 100% of it — got
            sliced. flex:1 + minHeight:0 makes it fill what is actually
            there. */}
        <div className={`main-pane${activeNb ? " main-pane-nb" : ""}`} onScroll={e => document.documentElement.style.setProperty(
          "--pane-scroll",
          // 44px of travel: long enough not to trip on a stray wheel tick,
          // short enough that the handoff is over before you have read it.
          Math.min(e.currentTarget.scrollTop / 44, 1).toFixed(3),
        )} style={{ flex: 1, minHeight: 0, padding: "36px 44px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <button
            onClick={() => setSidebarOpen(true)}
            title="Open menu"
            className="mobile-menu-btn"
            style={{
              display: "none",
              position: "fixed", bottom: 80, left: 16, zIndex: 50,
              background: "var(--accent)",
              border: "none",
              borderRadius: "50%", width: 44, height: 44,
              alignItems: "center", justifyContent: "center",
              color: "var(--on-acc)", cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          ><Menu size={20} strokeWidth={1.75} /></button>
          {activeNb ? (
            <div style={{ height: "100%", animation: "fadeIn 0.3s ease" }}>
              <Suspense fallback={null}>
              <NotebookView
                nb={activeNb}
                currentUserId={user?.id}
                onBack={() => setActiveNb(null)}
                onSetStatus={status => handleSetStatus(activeNb, status)}
                onToast={msg => { setToast(msg); setTimeout(() => setToast(""), 3000); }}
                onUpgradeNeeded={limitType => setUpgradeModal({ limitType })}
                onDeleted={id => {
                  removeNotebooksByIds(new Set([id])); // clears lists, starred, cache, and closes it
                  setActiveView("dashboard");           // the open notebook was just deleted → dashboard
                  setToast("Unit deleted");
                  setTimeout(() => setToast(""), 3000);
                }}
              />
              </Suspense>
            </div>

          ) : activeView === "settings" ? (
            <SettingsView
              accentColor={accentColor}
              displayName={displayName}
              handleManageSubscription={handleManageSubscription}
              portalLoading={portalLoading}
              setAccentColor={setAccentColor}
              setShowDeleteAccount={setShowDeleteAccount}
              setTheme={setTheme}
              setUpgradeModal={setUpgradeModal}
              subscription={subscription}
              theme={theme}
              user={user}
            />

          ) : (
            <DashboardView
              activeView={activeView} viewLabel={viewLabel} greeting={greeting}
              displayName={displayName} user={user}
              streakAtRisk={streakAtRisk}
              streakBannerDismissed={streakBannerDismissed}
              setStreakBannerDismissed={setStreakBannerDismissed}
              classes={classes} notebooks={notebooks}
              filtered={filtered} filteredClasses={filteredClasses}
              search={search} setSearch={setSearch}
              setShowNewClassModal={setShowNewClassModal} setProfileOpen={setProfileOpen}
              friendsVersion={friendsVersion} bumpFriendsVersion={bumpFriendsVersion}
              setFriendIds={setFriendIds}
              openNotebookById={openNotebookById} openUnitWithClassColor={openUnitWithClassColor}
              expandedClassId={expandedClassId} classUnitsCache={classUnitsCache}
              handleReorderClasses={handleReorderClasses} handleToggleClass={handleToggleClass}
              handleChangeClassColor={handleChangeClassColor} openClassSyllabus={openClassSyllabus}
              setSyllabusForClass={setSyllabusForClass} setNewUnitFor={setNewUnitFor}
              setDeleteClassTarget={setDeleteClassTarget}
              handleSetStatus={handleSetStatus} handleToggleStar={handleToggleStar}
              starredIds={starredIds} setActiveNb={setActiveNb} setConfirmDeleteNb={setConfirmDeleteNb}
              dueCount={dueCount} startAllReview={startAllReview}
              subscription={subscription} handleManageSubscription={handleManageSubscription}
              portalLoading={portalLoading} billingReady={billingReady}
              heatmap={heatmap} profile={profile} leaderboard={leaderboard}
              notifications={notifications} setNotifications={setNotifications}
              clearInbox={clearInbox} feedActioned={feedActioned} feedError={feedError}
              respondToFriendFromFeed={respondToFriendFromFeed}
            />
          )}
        </div>

        {/* ── Mobile profile sheet (mobile-only) ── */}
        {profileOpen && (
          <div
            className="mobile-only"
            onClick={e => { if (e.target === e.currentTarget) setProfileOpen(false); }}
            style={{
              position: "fixed", inset: 0, zIndex: 320,
              background: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "flex-end", justifyContent: "stretch",
              animation: "fadeIn 0.18s ease",
            }}
          >
            <div style={{
              width: "100%",
              background: "var(--bg-surface-1)",
              borderRadius: "18px 18px 0 0",
              padding: `16px 20px calc(24px + env(safe-area-inset-bottom))`,
              animation: "slideUpSheet 0.26s cubic-bezier(0.32,0.72,0.32,1)",
            }}>
              <div style={{
                width: 36, height: 4, borderRadius: 999,
                background: "var(--border-strong)", margin: "0 auto 14px",
              }} />
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <Avatar name={displayName} size={44} seed={user?.email ?? displayName} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
                </div>
              </div>
              <div style={{ height: 1, background: "var(--border-subtle)", marginBottom: 14 }} />
              {/* Settings link */}
              <button
                onClick={() => { setProfileOpen(false); setActiveView("settings"); setActiveNb(null); }}
                style={{
                  width: "100%", height: 48, borderRadius: 10, cursor: "pointer",
                  background: "transparent", border: "1px solid var(--border-default)",
                  color: "var(--text-primary)", fontSize: 14, fontWeight: 500, fontFamily: FONT,
                  display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
                  marginBottom: 8,
                }}
              >
                <Settings size={16} strokeWidth={1.75} /> Settings
              </button>
              {/* Sign out */}
              <button
                onClick={() => { setProfileOpen(false); handleLogout(); }}
                style={{
                  width: "100%", height: 48, borderRadius: 10, cursor: "pointer",
                  background: "transparent", border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
                  color: "var(--danger)", fontSize: 14, fontWeight: 500, fontFamily: FONT,
                  display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
                }}
              >
                <LogOut size={16} strokeWidth={1.75} /> Sign out
              </button>
            </div>
          </div>
        )}

        {/* ── Mobile bottom tab bar (mobile-only, hidden on desktop via CSS) ── */}
        {user && !activeNb && (
          <MobileTabBar
            activeView={activeView}
            dueCount={dueCount}
            onSelect={id => { setActiveView(id); setActiveNb(null); setSearch(""); }}
            onOpenFriends={() => setShowMobileFriends(true)}
          />
        )}

        {/* The phone's account menu — same profileOpen state as the desktop
            dropdown, a second presentation. mobile-only keeps them from ever
            showing at once. */}
        {profileOpen && (
          <MobileProfileSheet
            displayName={displayName}
            email={user?.email}
            onClose={() => setProfileOpen(false)}
            onSettings={() => { setProfileOpen(false); setActiveView("settings"); setActiveNb(null); }}
            onSignOut={() => { setProfileOpen(false); handleLogout(); }}
          />
        )}

        {/* ── Mobile friends sheet (sidebar Friends/Best Friends, in a bottom sheet) ── */}
        {showMobileFriends && (
          <div
            className="mobile-sheet-overlay"
            onClick={e => { if (e.target === e.currentTarget) setShowMobileFriends(false); }}
            style={{
              position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
              backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              display: "flex", justifyContent: "center", zIndex: 1000,
            }}
          >
            <div className="mobile-sheet" style={{
              background: "var(--bg-base)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 18, width: "100%", maxWidth: 440,
              padding: "8px 12px 20px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 4px 8px" }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT, letterSpacing: "-0.02em" }}>Friends</span>
                <span style={{ marginLeft: "auto" }}><NotificationsBell onOpenNotebook={openNotebookById} onOpenBilling={handleManageSubscription} reloadSignal={notifVersion} /></span>
                <button
                  onClick={() => setShowMobileFriends(false)}
                  aria-label="Close"
                  style={{
                    background: "transparent", border: "1px solid var(--border-default)",
                    borderRadius: 8, width: 36, height: 36, cursor: "pointer",
                    color: "var(--text-secondary)", fontSize: 16,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >✕</button>
              </div>
              <FriendsRow refreshSignal={friendsVersion} onChanged={() => bumpFriendsVersion()} onOpenNotebook={openNotebookById} onFriendIds={setFriendIds} />

              {/* Labeled billing entry — reachable via the Friends tab so mobile
                  users don't have to discover the avatar to manage their plan. */}
              <button
                onClick={() => {
                  setShowMobileFriends(false);
                  if (subscription.tier !== "pro") { setUpgradeModal({ limitType: "upgrade" }); return; }
                  handleManageSubscription();
                }}
                disabled={portalLoading || (subscription.tier === "pro" && !billingReady)}
                style={{
                  width: "100%", minHeight: 48, marginTop: 12, borderRadius: 12,
                  display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
                  background: "var(--bg-surface-1)", border: "1px solid var(--border-default)",
                  color: "var(--text-primary)", fontSize: 14, fontWeight: 600, fontFamily: FONT,
                  cursor: portalLoading ? "wait" : "pointer",
                }}
              >
                <CreditCard size={17} strokeWidth={1.85} style={{ color: "var(--accent)", flexShrink: 0 }} />
                {subscription.tier === "pro" ? "Manage subscription" : "Upgrade to Pro"}
              </button>
            </div>
          </div>
        )}

        {/* First-run username prompt — gates friends features until set */}
        {user && myUsername === null && (
          <UsernameSetupModal onDone={uname => setMyUsername(uname)} onSignOut={handleLogout} />
        )}

        {/* All-notebooks flashcard review (launched from the dashboard) */}
        {reviewSession && (
          <Suspense fallback={null}>
            <FlashcardReview cards={reviewSession} onDone={endReviewSession} />
          </Suspense>
        )}

        {/* ── Mobile FAB: New Class (dashboard only) ── */}
        {user && !activeNb && activeView === "dashboard" && (
          <button
            className="mobile-fab mobile-only"
            onClick={() => setShowNewClassModal(true)}
            aria-label="New class"
            title="New class"
          >
            <Plus size={26} strokeWidth={2} />
          </button>
        )}
        </div>
      </div>
    </>
  );
}

