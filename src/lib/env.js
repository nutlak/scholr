// Origin/host detection. getscholr.com is marketing, scholr.dev is the app.

export const APP_ORIGIN = "https://scholr.dev";

export const IS_MARKETING_HOST =
  typeof window !== "undefined" && /(^|\.)getscholr\.com$/i.test(window.location.hostname);

export function readAuthIntentFromUrl() {
  if (typeof window === "undefined" || IS_MARKETING_HOST) return null;
  const p = new URLSearchParams(window.location.search).get("auth");
  if (!p) return null;
  return p === "login" || p === "signin" ? "login" : "signup";
}
