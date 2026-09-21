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
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Star, Bell, Plus, Search, FileText, Hammer, MessageCircle, Users, Settings, LayoutDashboard, ChevronRight, Sparkles, BookOpen, Layers, LogOut, AlertTriangle, Check, X, Menu, Notebook, RefreshCw, Trash2, UserPlus, AtSign, FolderPlus, CreditCard } from "lucide-react";
import "./App.css";
import { InviteLanding } from "./features/notebook/InviteModal.jsx";
import { NotebookView } from "./features/notebook/NotebookView.jsx";
import { NewClassModal, NewUnitModal } from "./features/classes/ClassModals.jsx";
import { SyllabusImportModal } from "./features/classes/SyllabusImportModal.jsx";
import { ClassSyllabusModal } from "./features/classes/ClassSyllabusModal.jsx";
import { SortableClassCard, ConfirmDeleteClassModal } from "./features/classes/ClassCard.jsx";
import { FriendsRow } from "./features/friends/FriendsRow.jsx";

import { SettingsView } from "./features/settings/SettingsView.jsx";
import { NotebookCard } from "./features/dashboard/NotebookCard.jsx";
import { UpcomingDeadlines } from "./features/dashboard/UpcomingDeadlines.jsx";
import { PasswordResetModal } from "./features/account/PasswordResetModal.jsx";
import { DeleteAccountModal } from "./features/account/DeleteAccountModal.jsx";
import { TermsWall } from "./features/account/TermsWall.jsx";
import { UpgradeModal } from "./features/billing/UpgradeModal.jsx";
import { StreakMilestoneModal } from "./features/streak/StreakMilestoneModal.jsx";

import { ActivityHeatmap } from "./features/dashboard/ActivityHeatmap.jsx";
import { EmptyState } from "./ui/EmptyState.jsx";

import { Avatar } from "./ui/Avatar.jsx";
import { HudBar } from "./ui/HudBar.jsx";
import { FONT, FONT_HEADING, ACCENT_PRESETS } from "./lib/theme.js";
import { STREAK_MILESTONES, timeAgo, getDisplayName, getGreeting, computeStreak, streakAtRiskFromHeatmap, notifLine, NOTIF_OPENS_NOTEBOOK, NOTIF_OPENS_BILLING } from "./lib/format.js";
import { APP_ORIGIN, IS_MARKETING_HOST, readAuthIntentFromUrl } from "./lib/env.js";
import { MOBILE_QUERY } from "./lib/breakpoints.js";
import { onCheckoutReturn } from "./lib/native.js";

import { useIncomingPresence, pingFriends } from "./lib/live.js";

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

// Unified notification rendering (drives both the dashboard feed and the bell's
// fallback). Reads the social_notifications payload by type.
const NOTIF_ICON = {
  friend_request:  UserPlus,
  friend_accepted: Check,
  notebook_invite: FolderPlus,
  mention:         AtSign,
  note_uploaded:   FileText,
  payment_failed:  AlertTriangle,
  renewal_reminder: RefreshCw,
};
// Which types deep-link into a notebook when tapped.
// Which types open the Stripe billing portal when tapped.

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
  const [notifications, setNotifications] = useState([]);
  const [classes, setClasses] = useState([]);
  const [expandedClassId, setExpandedClassId] = useState(null);
  // Require a 4px drag before activating so taps/clicks on the card body
  // don't accidentally start drags from the handle press.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );
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
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("scholr-theme") ?? "dark"; }
    catch { return "dark"; }
  });
  const [accentColor, setAccentColor] = useState(() => {
    try { return localStorage.getItem("scholr-accent") ?? "#A78BFA"; }
    catch { return "var(--acc)"; }
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMobileFriends, setShowMobileFriends] = useState(false);
  const [myUsername, setMyUsername] = useState(undefined); // undefined=loading, null=unset, string=set
  const [dueCount, setDueCount] = useState(0);            // flashcards due across all notebooks
  const [reviewSession, setReviewSession] = useState(null); // active all-notebooks review (cards[])
  const [feedActioned, setFeedActioned] = useState({});   // notifId -> "busy" | terminal status (e.g. already-handled)
  const [feedError, setFeedError] = useState({});         // notifId -> inline error shown ALONGSIDE the buttons (retryable)
  const [friendsVersion, setFriendsVersion] = useState(0); // bump to refresh FriendsSidebarSection
  const [friendIds, setFriendIds] = useState([]); // lifted from FriendsRow, for Realtime presence fan-out
  const friendIdsRef = useRef([]);
  const [notifVersion, setNotifVersion] = useState(0);     // bump to make NotificationsBell reload
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const [subscription, setSubscription] = useState({
    tier: "free",
    messagesUsed: 0, messagesLimit: 100,
    forgeUsed: 0, forgeLimit: 3,
    notebooksUsed: 0, notebooksLimit: 3,
  });
  const [upgradeModal, setUpgradeModal] = useState(null); // null | { limitType: string }
  const [confirmDeleteNb, setConfirmDeleteNb] = useState(null); // notebook pending deletion
  const [deletingNb, setDeletingNb] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("scholr-theme", theme); } catch { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    const preset = ACCENT_PRESETS.find(p => p.color === accentColor) ?? ACCENT_PRESETS[0];
    const root = document.documentElement;
    root.style.setProperty("--acc", preset.color);
    root.style.setProperty("--acc-h", preset.hover);
    root.style.setProperty("--acc-d", preset.deep);
    root.style.setProperty("--acc-bg", `${preset.color}14`);
    root.style.setProperty("--acc-bg-h", `${preset.color}24`);
    root.style.setProperty("--acc-glow", `${preset.color}38`);
    try { localStorage.setItem("scholr-accent", accentColor); } catch { /* ignore */ }
  }, [accentColor]);

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") { setShowPasswordReset(true); return; }
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

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
        setToast("You're in the squad — enjoy Pro!");
        setTimeout(() => setToast(""), 4000);
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
    api.getMyUsername().then(d => setMyUsername(d?.username ?? null)).catch(() => setMyUsername(null));
    api.getDueCount().then(d => setDueCount(d?.count ?? 0)).catch(() => {});

    // Mark today as an "active" day for the streak. Fire-and-forget; we still
    // refresh the heatmap *after* this resolves so today shows immediately.
    // Module-scoped flag prevents duplicate calls on auth state churn.
    if (!_visitTrackedThisSession) {
      _visitTrackedThisSession = true;
      const dateLabel = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
      api.trackVisit(dateLabel)
        .catch(err => { console.warn("trackVisit failed:", err.message); })
        .finally(() => {
          api.getActivityHeatmap().then(setHeatmap).catch(console.error);
        });
    } else {
      api.getActivityHeatmap().then(setHeatmap).catch(console.error);
    }
    api.getFriendsLeaderboard().then(setLeaderboard).catch(console.error);

    // Handle ?upgraded=true from Stripe success redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true") {
      window.history.replaceState({}, "", "/app");
      setToast("Welcome to scholr Pro!");
      setTimeout(() => setToast(""), 4000);
    }
  }, [user, authReady]);

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
      api.getSubscription().then(setSubscription).catch(console.error);
      setToast("Welcome to scholr Pro!");
      setTimeout(() => setToast(""), 4000);
    });
  }, [user]);

  // Online presence: heartbeat on mount + every 60s while the app is open. It
  // carries the notebook currently open so friends see "Noah is in Bio 101"
  // rather than a bare green dot — that's what turns presence into company.
  useEffect(() => {
    if (!user) return;
    const beat = () => api.sendHeartbeat(activeNb?.id).catch(() => {});
    beat();
    const id = setInterval(beat, 60_000);
    return () => clearInterval(id);
  }, [user, activeNb?.id]);

  // Realtime presence (additive over the heartbeat): a friend nudging my topic
  // means "someone's presence changed" — refetch the authorized friends list
  // now instead of waiting up to 60s. And when MY presence changes (login, or
  // switching the notebook I'm in), nudge my friends so they update in ~1s too.
  useEffect(() => { friendIdsRef.current = friendIds; }, [friendIds]);
  useIncomingPresence(user?.id, () => setFriendsVersion(v => v + 1));
  const hasFriends = friendIds.length > 0;
  useEffect(() => {
    if (user?.id && hasFriends) pingFriends(friendIdsRef.current);
  }, [user?.id, activeNb?.id, hasFriends]);

  // Unified notifications feed — reload helper + 30s polling so the dashboard
  // Recent Activity stays live (the bell polls its own copy independently).
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

  // The AuthModal's initial open state + tab are derived from ?auth=… in the
  // useState initializers above (so it paints open immediately). Here we only
  // strip the param from the URL on mount, so a later refresh won't reopen it.
  // No setState → no cascading re-render.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).get("auth")) return;
    window.history.replaceState({}, "", (window.location.pathname + window.location.hash) || "/");
  }, []);

  // Canonical app URL: the logged-in app lives at /app, the landing/auth at /.
  // Keep the address bar consistent with auth state once it's known. This is a
  // cosmetic replaceState — the app renders by `user`, not by path, and the
  // public routes (/s/:slug, /privacy, /terms, /copyright) return earlier — so
  // matching ONLY the exact root and /app leaves every other route untouched.
  useEffect(() => {
    if (!authReady || IS_MARKETING_HOST) return;
    const path = window.location.pathname;
    const tail = window.location.search + window.location.hash;
    if (user && path === "/") {
      window.history.replaceState({}, "", "/app" + tail);   // logged-in at root → /app
    } else if (!user && path === "/app") {
      window.history.replaceState({}, "", "/" + tail);      // logged-out at /app → /
    }
  }, [authReady, user]);

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

  function patchNotebookEverywhere(notebookId, patch) {
    const apply = list => list.map(n => n.id === notebookId ? { ...n, ...patch } : n);
    setNotebooks(apply);
    setOwnedNotebooks(apply);
    setSharedNotebooks(apply);
    setStarredNotebooks(apply);
    setClassUnitsCache(prev => {
      const next = { ...prev };
      for (const cid of Object.keys(next)) {
        if (Array.isArray(next[cid])) next[cid] = apply(next[cid]);
      }
      return next;
    });
    setActiveNb(curr => curr && curr.id === notebookId ? { ...curr, ...patch } : curr);
  }

  // Remove notebook(s) from EVERY place notebooks are stored: all list views,
  // the starred set, the per-class unit cache, and the currently-open notebook.
  // Deleting a notebook takes its notes with it, so this is only reached from
  // an explicit confirmation naming the notebook.
  async function handleDeleteNotebook(nb) {
    setDeletingNb(true);
    try {
      await api.deleteNotebook(nb.id);
      removeNotebooksByIds(new Set([nb.id]));
      setConfirmDeleteNb(null);
      setToast("Notebook deleted");
      setTimeout(() => setToast(""), 2500);
    } catch (err) {
      console.error("deleteNotebook failed:", err);
      setToast(err?.message || "Couldn't delete that notebook");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setDeletingNb(false);
    }
  }

  function removeNotebooksByIds(idSet) {
    if (!idSet || idSet.size === 0) return;
    const drop = list => list.filter(n => !idSet.has(n.id));
    setNotebooks(drop);
    setOwnedNotebooks(drop);
    setSharedNotebooks(drop);
    setStarredNotebooks(drop);
    setStarredIds(prev => {
      let changed = false;
      const next = new Set(prev);
      for (const id of idSet) if (next.delete(id)) changed = true;
      return changed ? next : prev;
    });
    setClassUnitsCache(prev => {
      const next = { ...prev };
      for (const cid of Object.keys(next)) {
        if (Array.isArray(next[cid])) next[cid] = next[cid].filter(u => !idSet.has(u.id));
      }
      return next;
    });
    setActiveNb(curr => (curr && idSet.has(curr.id) ? null : curr));
  }

  async function handleSetStatus(nb, status) {
    patchNotebookEverywhere(nb.id, { status });
    try { await api.updateNotebookStatus(nb.id, status); }
    catch (err) { console.error(err); setToast("Couldn't update status"); setTimeout(() => setToast(""), 2500); }
  }

  async function handleSetDueDate(nb, dueDate) {
    patchNotebookEverywhere(nb.id, { due_date: dueDate });
    try { await api.updateNotebookDueDate(nb.id, dueDate); }
    catch (err) { console.error(err); setToast("Couldn't update due date"); setTimeout(() => setToast(""), 2500); }
  }

  async function handleSetAssessmentType(nb, assessmentType) {
    patchNotebookEverywhere(nb.id, { assessment_type: assessmentType });
    try { await api.updateNotebookAssessmentType(nb.id, assessmentType); }
    catch (err) { console.error(err); setToast("Couldn't update assessment type"); setTimeout(() => setToast(""), 2500); }
  }

  // Open a notebook by id (from a notification). Look across loaded lists first;
  // if not found (e.g. just invited, not yet in any list), refresh shared and retry.
  async function openNotebookById(notebookId) {
    setShowMobileFriends(false);
    const found = [...notebooks, ...sharedNotebooks, ...ownedNotebooks, ...starredNotebooks]
      .find(n => n.id === notebookId);
    if (found) { setActiveNb(found); setActiveView("dashboard"); return; }
    try {
      const shared = await api.listSharedNotebooks(getDisplayName(user));
      setSharedNotebooks(shared);
      const nb = shared.find(n => n.id === notebookId);
      if (nb) { setActiveNb(nb); setActiveView("dashboard"); }
      else { setActiveView("shared"); }
    } catch { setActiveView("shared"); }
  }

  // Launch an all-notebooks flashcard review from the dashboard.
  async function startAllReview() {
    try {
      const { cards } = await api.getDueFlashcards();
      if (cards.length) setReviewSession(cards);
      else { setToast("No cards due — you're caught up"); setTimeout(() => setToast(""), 2500); }
    } catch { setToast("Couldn't load due cards"); setTimeout(() => setToast(""), 2500); }
  }

  async function endReviewSession() {
    setReviewSession(null);
    try { const d = await api.getDueCount(); setDueCount(d?.count ?? 0); } catch { /* ignore */ }
  }

  // Accept/Decline a friend request straight from the Recent Activity feed.
  // notifId = the social_notifications row id (so we can clear it); requestId =
  // the friend_request id (for respondToFriend).
  // Clear inbox — delete ALL notifications (with a confirm), and clear the bell.
  async function clearInbox() {
    if (!window.confirm("Clear all notifications?")) return;
    setNotifications([]);            // optimistic: empty the feed
    setNotifVersion(v => v + 1);     // tell the bell to reload (→ empty)
    try { await api.clearSocialNotifications(); }
    catch { refreshNotifications(); } // restore on failure
  }

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
      setFriendsVersion(v => v + 1);
      refreshNotifications();
    } catch (err) {
      if (err.status === 409 || err.code === "already_actioned") {
        // Already handled elsewhere — show a brief terminal note, then clear.
        setFeedActioned(s => ({ ...s, [notifId]: err.message || "Already handled" }));
        setFriendsVersion(v => v + 1);
        setTimeout(() => { dropRow(); refreshNotifications(); }, 1400);
      } else {
        // Generic failure — restore the actionable buttons and show an inline
        // error next to them so "try again" is actually possible.
        setFeedActioned(s => { const next = { ...s }; delete next[notifId]; return next; });
        setFeedError(s => ({ ...s, [notifId]: "Couldn't respond — try again" }));
      }
    }
  }

  async function handleToggleClass(classId) {
    if (expandedClassId === classId) { setExpandedClassId(null); return; }
    setExpandedClassId(classId);
    if (classUnitsCache[classId]) return;
    setClassUnitsCache(prev => ({ ...prev, [classId]: null }));
    try {
      const units = await api.listClassNotebooks(classId, getDisplayName(user));
      setClassUnitsCache(prev => ({ ...prev, [classId]: units }));
    } catch {
      setClassUnitsCache(prev => ({ ...prev, [classId]: [] }));
    }
  }

  // "Click a class, see the whole syllabus" — reuses the same units cache the
  // inline expand uses, so opening the syllabus view for an already-expanded
  // class is instant, and expanding it afterward doesn't re-fetch either.
  const [syllabusClassId, setSyllabusClassId] = useState(null);
  async function openClassSyllabus(classId) {
    setSyllabusClassId(classId);
    if (classUnitsCache[classId]) return;
    setClassUnitsCache(prev => ({ ...prev, [classId]: null }));
    try {
      const units = await api.listClassNotebooks(classId, getDisplayName(user));
      setClassUnitsCache(prev => ({ ...prev, [classId]: units }));
    } catch {
      setClassUnitsCache(prev => ({ ...prev, [classId]: [] }));
    }
  }

  async function handleCreateClass(title, color, template) {
    try {
      const cls = await api.createClass(title, color);
      setClasses(prev => [...prev, cls]);
      // Template selected → batch-create its notebooks + starter notes, open the first.
      if (template && template.id !== "blank" && template.notebooks?.length) {
        try {
          const result = await api.applyTemplate(cls.id, template.notebooks);
          const nm = getDisplayName(user);
          api.listNotebooks(nm).then(setNotebooks).catch(() => {});
          api.listClasses().then(setClasses).catch(() => {});
          if (result.firstNotebookId) {
            const units = await api.listClassNotebooks(cls.id, nm).catch(() => []);
            const first = units.find(u => u.id === result.firstNotebookId) || units[0];
            if (first) { setActiveNb(first); setActiveView("dashboard"); }
          }
          if (result.limitHit) {
            setToast("Some notebooks weren't added — you've hit the free plan limit.");
            setTimeout(() => setToast(""), 4500);
          }
        } catch (e) {
          console.error("applyTemplate failed:", e);
          setToast("Class created, but template setup failed.");
          setTimeout(() => setToast(""), 3500);
        }
      }
    } catch (err) {
      if (err.code === "class_limit_reached") {
        setShowNewClassModal(false);
        setUpgradeModal({ limitType: "class_limit_reached" });
        return;
      }
      throw err;
    }
  }

  // Same underlying flow as handleCreateClass's template branch — a syllabus
  // is just a template the user didn't have to hand-type, extracted by
  // SyllabusImportModal and reviewed before this ever runs.
  async function handleImportSyllabus(className, notebooks) {
    const cls = await api.createClass(className);
    setClasses(prev => [...prev, cls]);
    try {
      const result = await api.applyTemplate(cls.id, notebooks, { fromSyllabus: true });
      const nm = getDisplayName(user);
      api.listNotebooks(nm).then(setNotebooks).catch(() => {});
      api.listClasses().then(setClasses).catch(() => {});
      if (result.firstNotebookId) {
        const units = await api.listClassNotebooks(cls.id, nm).catch(() => []);
        const first = units.find(u => u.id === result.firstNotebookId) || units[0];
        if (first) { setActiveNb(first); setActiveView("dashboard"); }
      }
      if (result.limitHit) {
        setToast("Some units weren't added — you've hit the free plan limit.");
        setTimeout(() => setToast(""), 4500);
      }
    } catch (e) {
      console.error("syllabus applyTemplate failed:", e);
      throw new Error("Class created, but adding the units failed.", { cause: e });
    }
  }

  // Importing into a class that already exists: the same parse-and-review the
  // dashboard import uses, minus createClass — the syllabus only supplies the
  // units. Refreshes the open card's cached units so they appear in place
  // rather than after a collapse/expand.
  async function handleImportSyllabusIntoClass(cls, notebooks) {
    const result = await api.applyTemplate(cls.id, notebooks, { fromSyllabus: true });
    const nm = getDisplayName(user);
    api.listNotebooks(nm).then(setNotebooks).catch(() => {});
    api.listClasses().then(setClasses).catch(() => {});
    const units = await api.listClassNotebooks(cls.id, nm).catch(() => null);
    if (units) setClassUnitsCache(prev => ({ ...prev, [cls.id]: units }));
    setToast(result.limitHit
      ? "Some units weren't added — you've hit the free plan limit."
      : `Added ${result.created} unit${result.created === 1 ? "" : "s"} to ${cls.title}`);
    setTimeout(() => setToast(""), 4500);
  }

  const [portalLoading, setPortalLoading] = useState(false);
  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      // api.createPortalSession() redirects via window.location.href on success
      await api.createPortalSession();
    } catch (err) {
      console.error("Portal session error:", err);
      setToast("Could not open subscription management. Please try again.");
      setTimeout(() => setToast(""), 3500);
      setPortalLoading(false);
    }
  }

  async function handleChangeClassColor(classId, color) {
    // Optimistic update so the UI feels snappy
    const prevClasses = classes;
    setClasses(cs => cs.map(c => c.id === classId ? { ...c, color } : c));
    try {
      await api.updateClassColor(classId, color);
    } catch (err) {
      console.error("updateClassColor failed:", err);
      setClasses(prevClasses);
      setToast("Could not update color");
      setTimeout(() => setToast(""), 2500);
    }
  }

  async function handleReorderClassesDnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = classes.findIndex(c => c.id === active.id);
    const newIndex = classes.findIndex(c => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const prev = classes;
    const next = arrayMove(classes, oldIndex, newIndex);
    setClasses(next);                          // optimistic
    try {
      await api.reorderClasses(next.map(c => c.id));
    } catch (err) {
      console.error("reorderClasses failed:", err);
      setClasses(prev);                        // revert
      setToast("Could not reorder classes");
      setTimeout(() => setToast(""), 2500);
    }
  }

  async function handleCreateUnit(classId, title, topic) {
    try {
      const unit = await api.createClassNotebook(classId, title, topic, getDisplayName(user));
      setClassUnitsCache(prev => ({ ...prev, [classId]: [...(prev[classId] ?? []), unit] }));
      setNotebooks(prev => [unit, ...prev]);
      setSubscription(prev => ({ ...prev, notebooksUsed: (prev.notebooksUsed ?? 0) + 1 }));
    } catch (err) {
      if (err.code === "notebook_limit_reached") {
        setNewUnitFor(null);
        setUpgradeModal({ limitType: "notebook_limit_reached" });
        return;
      }
      throw err;
    }
  }

  // When opening a unit from a class card, attach the class's color so
  // NotebookView/Forge can tint accordingly. For units opened from My Notes /
  // Shared / Starred views we fall back to the deterministic per-notebook tint.
  function openUnitWithClassColor(unit, classColor) {
    setActiveNb(classColor ? { ...unit, color: classColor } : unit);
  }

  async function handleToggleStar(nb) {
    const isStarred = starredIds.has(nb.id);
    setStarredIds(prev => { const next = new Set(prev); isStarred ? next.delete(nb.id) : next.add(nb.id); return next; });
    setStarredNotebooks(prev => isStarred ? prev.filter(n => n.id !== nb.id) : [...prev, nb]);
    try {
      const { starred } = await api.toggleStar(nb.id);
      setStarredIds(prev => { const next = new Set(prev); starred ? next.add(nb.id) : next.delete(nb.id); return next; });
      if (!starred) setStarredNotebooks(prev => prev.filter(n => n.id !== nb.id));
    } catch (err) {
      console.error("star toggle failed:", err);
      setStarredIds(prev => { const next = new Set(prev); isStarred ? next.add(nb.id) : next.delete(nb.id); return next; });
      setStarredNotebooks(prev => isStarred ? [...prev, nb] : prev.filter(n => n.id !== nb.id));
    }
  }

  async function handleDeleteClass(classId) {
    await api.deleteClass(classId);
    // The server cascades the class's notebooks → drop every one of them from
    // all client-side notebook state (lists, starred, open notebook), not just
    // the class + its unit cache.
    const removed = new Set();
    for (const list of [notebooks, ownedNotebooks, sharedNotebooks, starredNotebooks, ...Object.values(classUnitsCache)]) {
      for (const n of (list || [])) if (n && n.class_id === classId) removed.add(n.id);
    }
    setClasses(prev => prev.filter(c => c.id !== classId));
    setClassUnitsCache(prev => { const next = { ...prev }; delete next[classId]; return next; });
    removeNotebooksByIds(removed);
    if (activeNb && removed.has(activeNb.id)) setActiveView("dashboard");
    if (expandedClassId === classId) setExpandedClassId(null);
    setToast("Class deleted");
    setTimeout(() => setToast(""), 3000);
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
  // The dashboard header is sticky. It only needs an opaque backdrop WHILE the
  // pane is scrolled (so rows don't bleed under it); at rest it must stay
  // transparent, or its solid fill reads as a black card over the HUD void.
  const [paneScrolled, setPaneScrolled] = useState(false);
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
          setShowAuth(false); setShowInviteAuth(false); setUser(u);
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

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
          border: "1px solid rgba(52,211,153,0.3)",
          borderRadius: 12, padding: "0 18px", height: 42,
          fontSize: 13.5, color: "#34D399", fontWeight: 600,
          fontFamily: FONT,
          boxShadow: "0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(52,211,153,0.15), 0 0 24px rgba(52,211,153,0.2)",
          zIndex: 2000, animation: "slideInUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
          display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
          letterSpacing: "-0.01em",
        }}>
          <span style={{
            width: 18, height: 18, borderRadius: "50%",
            background: "rgba(52,211,153,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--success)",
          }}><Check size={12} strokeWidth={2.5} /></span>
          {toast}
        </div>
      )}

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
                    background: "var(--accent)", color: "#fff", fontSize: 10.5, fontWeight: 700,
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
        <div className={`main-pane${activeNb ? " main-pane-nb" : ""}`} onScroll={e => setPaneScrolled(e.currentTarget.scrollTop > 4)} style={{ flex: 1, minHeight: 0, padding: "36px 44px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
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
              color: "#fff", cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          ><Menu size={20} strokeWidth={1.75} /></button>
          {activeNb ? (
            <div style={{ height: "100%", animation: "fadeIn 0.3s ease" }}>
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
                  doesn't read as a black card over the HUD void.
                  var(--bg), not var(--bg-base): hud.css forces bg-base inline
                  backgrounds transparent, which would defeat the scrolled fill. */}
              <div className="pane-heading" style={{
                position: "sticky", top: 0, zIndex: 20,
                background: paneScrolled ? "var(--bg)" : "transparent",
                boxShadow: paneScrolled ? "0 -40px 0 0 var(--bg)" : "none",
                transition: "background 120ms ease",
                paddingTop: 10, paddingBottom: 24,
                display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12,
              }}>
                <div className="dash-heading">
                  <div className="greeting-text" style={{
                    fontSize: "clamp(27px, 5.5vw, 36px)", fontWeight: 650, color: "var(--text-primary)",
                    fontFamily: FONT_HEADING, letterSpacing: "-0.022em", lineHeight: 1.15,
                    display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                  }}>
                    {activeView === "dashboard" ? greeting.text : viewLabel}
                  </div>
                  <div style={{
                    fontSize: 15, color: "var(--text-tertiary)",
                    fontFamily: FONT, marginTop: 5,
                  }}>
                    {activeView === "dashboard"
                      ? `${classes.length} ${classes.length === 1 ? "class" : "classes"} · ${notebooks.length} ${notebooks.length === 1 ? "notebook" : "notebooks"}`
                      : `${filtered.length} ${filtered.length === 1 ? "notebook" : "notebooks"}`}
                  </div>
                  {activeView === "dashboard" && (
                    <div style={{
                      fontSize: 14.5, color: "var(--text-tertiary)", fontFamily: FONT,
                      marginTop: 10, maxWidth: 680, lineHeight: 1.5,
                    }}>
                      “{greeting.quote.text}”
                      <span style={{ opacity: 0.72 }}> — {greeting.quote.author}</span>
                    </div>
                  )}
                </div>
                {activeView === "dashboard" && (
                  <>
                    <button
                      onClick={() => setShowNewClassModal(true)}
                      className="btn-press desktop-only"
                      style={{
                        background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
                        border: "none", borderRadius: 10, padding: "0 22px", height: 46,
                        color: "#fff", fontWeight: 600, fontSize: 15, cursor: "pointer",
                        fontFamily: FONT, flexShrink: 0,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
                        letterSpacing: "-0.01em",
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >+ New Class</button>
                  </>
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
              <div className={activeView === "dashboard" ? "dash-grid" : undefined}>
                <div className="dash-main">
                  {/* Friends first: the reason the app exists. */}
                  {activeView === "dashboard" && (
                    <FriendsRow
                      refreshSignal={friendsVersion}
                      onChanged={() => setFriendsVersion(v => v + 1)}
                      onOpenNotebook={openNotebookById}
                      onFriendIds={setFriendIds}
                    />
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
                      placeholder="Search notebooks…"
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

                {/* Dashboard: upcoming deadlines */}
                {activeView === "dashboard" && (
                  <UpcomingDeadlines
                    notebooks={notebooks}
                    classes={classes}
                    onOpen={(nb, classColor) => openUnitWithClassColor(nb, classColor)}
                  />
                )}

                {/* Dashboard: class cards */}
                {activeView === "dashboard" ? (
                  filteredClasses.length === 0 ? (
                    <EmptyState
                      icon={search ? <Search size={32} strokeWidth={1.5} /> : <BookOpen size={32} strokeWidth={1.5} />}
                      title={search ? "No classes match" : "Welcome to Scholr"}
                      body={search
                        ? "Try a different search term."
                        : "Create your first class to start organizing your notes and chatting with Derek."}
                      cta={!search ? { label: "+ Create your first class", onClick: () => setShowNewClassModal(true) } : null}
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
                    <DndContext
                      sensors={dndSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleReorderClassesDnd}
                    >
                      <SortableContext
                        items={filteredClasses.map(c => c.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 40 }}>
                          {filteredClasses.map(cls => (
                            <SortableClassCard
                              key={cls.id}
                              cls={cls}
                              dragDisabled={!!search}
                              expanded={expandedClassId === cls.id}
                              units={classUnitsCache[cls.id] ?? null}
                              onToggle={() => handleToggleClass(cls.id)}
                              onChangeColor={color => handleChangeClassColor(cls.id, color)}
                              onOpenUnit={unit => openUnitWithClassColor(unit, cls.color)}
                              onViewSyllabus={() => openClassSyllabus(cls.id)}
                              onImportSyllabus={() => setSyllabusForClass(cls)}
                              onNewUnit={() => setNewUnitFor({ classId: cls.id, classTitle: cls.title })}
                              onDeleteClass={() => setDeleteClassTarget(cls)}
                              onUnitStatusChange={(unit, status) => handleSetStatus(unit, status)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                    </>
                  )

                ) : filtered.length === 0 ? (
                  <EmptyState
                    icon={
                      search ? <Search size={32} strokeWidth={1.5} />
                      : activeView === "starred" ? <Star size={32} strokeWidth={1.5} />
                      : activeView === "shared" ? <Users size={32} strokeWidth={1.5} />
                      : <Notebook size={32} strokeWidth={1.5} />
                    }
                    title={
                      search ? "No notebooks match"
                      : activeView === "starred" ? "No starred notebooks"
                      : activeView === "shared"  ? "Nothing shared with you yet"
                      : "No notebooks yet"
                    }
                    body={
                      search ? "Try a different search term."
                      : activeView === "starred" ? "Tap the star on any notebook to add it here."
                      : activeView === "shared"  ? "When a classmate invites you to a notebook, it'll show up here."
                      : "Notebooks you create will appear in this view."
                    }
                  />
                ) : (
                  <>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: "var(--t3)",
                      fontFamily: FONT, letterSpacing: "0.08em", marginBottom: 14, textTransform: "uppercase",
                    }}>
                      {viewLabel}
                    </div>
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
                          starred={starredIds.has(nb.id)}
                          onToggleStar={() => handleToggleStar(nb)}
                          onStatusChange={status => handleSetStatus(nb, status)}
                          // Only the owner can delete; the API returns role per
                          // notebook, so a shared notebook shows no trash rather
                          // than offering one that 403s.
                          onDelete={nb.role === "member" ? undefined : () => setConfirmDeleteNb(nb)}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Dashboard: cards due — spaced repetition entry point */}
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
                      background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)", color: "#fff",
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

                {/* Dashboard: passive renewal reminder — Pro plan renewing within 3 days.
                    No cron needed; computed from the stored current_period_end on load. */}
                {activeView === "dashboard" && subscription.tier === "pro" && subscription.currentPeriodEnd && (() => {
                  const days = Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / 86400000);
                  if (days < 0 || days > 3) return null;
                  const when = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
                  return (
                    <button
                      onClick={handleManageSubscription}
                      disabled={portalLoading}
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
                          Your Pro plan renews {when}
                        </span>
                        <span style={{ display: "block", fontSize: 12.5, color: "var(--text-secondary)", marginTop: 1 }}>
                          Manage or cancel anytime before you're charged
                        </span>
                      </span>
                      <span style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                        {portalLoading ? "Opening…" : "Manage →"}
                      </span>
                    </button>
                  );
                })()}

                </div>

                <aside className="dash-rail">
                  {/* Dashboard: activity heatmap */}
                  {activeView === "dashboard" && (
                    <ActivityHeatmap data={heatmap} longestStreak={profile?.longest_streak ?? 0} leaderboard={leaderboard} />
                  )}

                  {/* Notifications — dashboard only. Unified social_notifications feed. */}
                  {activeView === "dashboard" && (
                    <>
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
                          {notifications.filter(n => !n.read).length > 0 && (
                            <span style={{
                              fontSize: 10.5, fontWeight: 700, color: "var(--accent)",
                              background: "var(--acc-bg)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                              padding: "1px 7px", borderRadius: 999,
                            }}>{notifications.filter(n => !n.read).length}</span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {notifications.some(n => !n.read) && (
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
                              ? () => openNotebookById(n.payload.notebookId)
                              : opensBilling ? () => handleManageSubscription() : undefined;
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
                    </>
                  )}
                </aside>
              </div>
            </div>
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
          <nav className="mobile-tab-bar mobile-only" aria-label="Primary">
            {[
              { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
              { id: "my-notes",  label: "Notes",     Icon: FileText },
              { id: "shared",    label: "Shared",    Icon: Users },
              { id: "starred",   label: "Starred",   Icon: Star },
            ].map(({ id, label, Icon }) => {
              const active = activeView === id;
              return (
                <button
                  key={id}
                  className={`mobile-tab ${active ? "active" : ""}`}
                  onClick={() => { setActiveView(id); setActiveNb(null); setSearch(""); }}
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
                      background: "var(--accent)", color: "#fff", fontSize: 9.5, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: FONT, border: "2px solid var(--bg-surface-1)",
                    }}>{dueCount > 9 ? "9+" : dueCount}</span>
                  )}
                </button>
              );
            })}
            {/* Friends opens a bottom sheet (sidebar is hidden on mobile) */}
            <button
              className="mobile-tab"
              onClick={() => setShowMobileFriends(true)}
              aria-label="Friends"
            >
              <UserPlus size={22} strokeWidth={1.75} />
              <span>Friends</span>
            </button>
          </nav>
        )}

        {/* ── Mobile profile sheet ──────────────────────────────────────────
            The desktop profile dropdown lives inside .sidebar, and .sidebar is
            display:none at phone width — so tapping the avatar toggled a menu
            that rendered into a hidden subtree. Settings and Sign out were
            unreachable on a phone entirely: no theme, no notification toggle,
            no Squad, no delete account, and no way to log out.

            Same profileOpen state, a second presentation. mobile-only keeps the
            two from ever showing at once, so desktop is untouched. The legal
            links come along because they live in that same hidden sidebar. */}
        {profileOpen && (
          <div
            className="mobile-sheet-overlay mobile-only"
            onClick={e => { if (e.target === e.currentTarget) setProfileOpen(false); }}
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
                    letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{displayName}</div>
                  <div style={{
                    fontSize: 12, color: "var(--text-tertiary)", fontFamily: FONT, marginTop: 1,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{user?.email}</div>
                </div>
                <button
                  onClick={() => setProfileOpen(false)}
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
                onClick={() => { setProfileOpen(false); setActiveView("settings"); setActiveNb(null); }}
                style={{
                  width: "100%", minHeight: 52, borderRadius: 12, marginBottom: 8,
                  display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
                  background: "var(--bg-surface-1)", border: "1px solid var(--border-default)",
                  color: "var(--text-primary)", fontSize: 14, fontWeight: 600,
                  fontFamily: FONT, cursor: "pointer",
                }}
              >
                <Settings size={17} strokeWidth={1.85} style={{ color: "var(--accent)", flexShrink: 0 }} />
                Settings
              </button>

              <button
                onClick={() => { setProfileOpen(false); handleLogout(); }}
                style={{
                  width: "100%", minHeight: 52, borderRadius: 12,
                  display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
                  background: "transparent", border: "1px solid var(--border-default)",
                  color: "var(--danger)", fontSize: 14, fontWeight: 600,
                  fontFamily: FONT, cursor: "pointer",
                }}
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
              <FriendsRow refreshSignal={friendsVersion} onChanged={() => setFriendsVersion(v => v + 1)} onOpenNotebook={openNotebookById} onFriendIds={setFriendIds} />

              {/* Labeled billing entry — reachable via the Friends tab so mobile
                  users don't have to discover the avatar to manage their plan. */}
              <button
                onClick={() => {
                  setShowMobileFriends(false);
                  if (subscription.tier === "pro") handleManageSubscription();
                  else setUpgradeModal({ limitType: "upgrade" });
                }}
                disabled={portalLoading}
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
          <UsernameSetupModal onDone={uname => setMyUsername(uname)} />
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

