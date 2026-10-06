// Cloudflare Turnstile — the bot check in front of sign-in and the OTP emails.
//
// Without VITE_TURNSTILE_SITE_KEY this whole module is a no-op and every
// caller gets `undefined`, which Supabase and the server both accept until
// their own Turnstile switches are turned on.
//
// Tokens are single-use, and one auth flow can need two (send-otp, then the
// sign-in after verifying), so each call executes the widget for a fresh one.
// The widget lives in its own container on <body> rather than in AuthModal's
// tree, because AuthModal swaps whole screens and would unmount it mid-flow.
// It stays invisible unless Cloudflare decides it needs a click.
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let widget = null;   // Promise<{ ts, id }>
let pending = null;  // { resolve, reject } for the token in flight
let used = false;

function settle(fn, value) { const p = pending; pending = null; p?.[fn](value); }

function ensureWidget() {
  widget ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = () => { widget = null; reject(new Error("Couldn't load the human check. Check your connection and try again.")); };
    document.head.appendChild(s);
  }).then(ts => {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10000";
    document.body.appendChild(el);
    const fail = () => settle("reject", new Error("Couldn't confirm you're human. Please try again."));
    const id = ts.render(el, {
      sitekey: SITE_KEY,
      execution: "execute",
      appearance: "interaction-only",
      theme: "dark",
      callback: token => settle("resolve", token),
      "error-callback": fail,
      "timeout-callback": fail,
    });
    return { ts, id };
  });
  return widget;
}

// Warm the script while the user is still typing.
export function preloadCaptcha() {
  if (SITE_KEY) ensureWidget().catch(() => {});
}

export async function getCaptchaToken() {
  if (!SITE_KEY) return undefined;
  const { ts, id } = await ensureWidget();
  if (used) ts.reset(id);
  used = true;
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    ts.execute(id);
  });
}
