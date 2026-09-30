// Client crash reporting, first-party.
//
// scholr has no Sentry and deliberately no third-party error processor: a good
// chunk of the userbase is under 18, and shipping their stack traces and URLs
// to another company is a privacy decision, not a tooling one. So reports go to
// scholr's own API, where they land in jarvis_events alongside the rest of the
// telemetry.
//
// Everything here is best-effort and silent. This module runs when the app is
// already broken, so it must never throw, never retry, and never block: a
// reporter that raises during error handling turns one bug into two.

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

// One report per distinct error per page load. A render error inside a
// component that React retries, or a resize loop, otherwise reports the same
// failure dozens of times and buries everything else.
const seen = new Set();

function currentUserId() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !/^sb-.*-auth-token$/.test(key)) continue;
      return JSON.parse(localStorage.getItem(key))?.user?.id ?? null;
    }
  } catch {
    // Private mode, blocked site data, or a shape change in the stored session.
    // An unattributed report is still worth sending.
  }
  return null;
}

export function reportClientError(error, { kind = "unknown", componentStack } = {}) {
  try {
    const message = String(error?.message ?? error ?? "").slice(0, 500);
    if (!message) return;

    const key = `${kind}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);

    const body = JSON.stringify({
      message,
      kind,
      stack: typeof error?.stack === "string" ? error.stack.slice(0, 4000) : null,
      componentStack: typeof componentStack === "string" ? componentStack.slice(0, 4000) : null,
      // Pathname only. Query strings and hash fragments in this app can carry
      // invite tokens and password-reset tokens, and a crash report is not the
      // place to copy those.
      path: location.pathname,
      appVersion: import.meta.env.VITE_COMMIT_SHA || null,
      userId: currentUserId(),
    });

    // The browser is often about to be reloaded (by the user, or by the error
    // boundary's own button), and a plain fetch dies with the page. sendBeacon
    // is queued by the browser and outlives it.
    const url = `${API_URL}/api/client-error`;
    if (navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }))) return;

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Reporting must never be the thing that breaks.
  }
}

/**
 * Catches what the React error boundary structurally cannot: errors thrown from
 * event handlers, timers, and async code, plus rejected promises nobody
 * handled. React only sees errors raised during render, so without this the
 * majority of real-world failures were invisible.
 */
export function installGlobalErrorReporting() {
  window.addEventListener("error", e => {
    // Failed <img>/<script> loads also fire this, on the element rather than
    // the window, and carry no Error — they're not crashes.
    if (!e.error) return;
    reportClientError(e.error, { kind: "window" });
  });

  window.addEventListener("unhandledrejection", e => {
    reportClientError(e.reason, { kind: "promise" });
  });
}
