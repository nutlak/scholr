import { useEffect } from "react";
import { IS_MARKETING_HOST } from "./env.js";

/* Address-bar housekeeping: two effects that only ever touch history, never
 * state, so they have no business sitting among the app's data effects.
 *
 * The app renders by `user`, not by path — these keep the URL honest about
 * which of the two it is, and strip the one-shot ?auth= param so a refresh
 * doesn't reopen the modal.
 */
export function useCanonicalUrl(authReady, user) {
  // The AuthModal's initial open state + tab are derived from ?auth=… in
  // Scholr()'s useState initializers (so it paints open immediately). Here we
  // only strip the param on mount. No setState → no cascading re-render.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).get("auth")) return;
    window.history.replaceState({}, "", (window.location.pathname + window.location.hash) || "/");
  }, []);

  // The logged-in app lives at /app, the landing/auth at /. This is a cosmetic
  // replaceState, and matching ONLY the exact root and /app leaves every other
  // route (/s/:slug, /privacy, /terms, /copyright) untouched.
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
}
