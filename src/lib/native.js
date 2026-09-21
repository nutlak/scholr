// Everything that has to behave differently inside the iOS app.
//
// The web build imports this too — `isNative()` is false there and every
// function falls back to what the browser already did, so callers do not need
// their own branch.
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";

export const isNative = () => Capacitor.isNativePlatform();

// The platform tag the billing routes read to decide where Stripe should send
// the customer back to. Null on web so the body stays empty there.
export const platformTag = () => (isNative() ? "ios" : null);

// Send someone to a URL we do not control — in practice Stripe Checkout and the
// billing portal.
//
// On the web this is the plain redirect it has always been. In the app it must
// leave the webview: navigating the webview to Stripe strands the customer
// inside our app shell with no way back, and Apple does not allow a purchase
// flow to run inside the app's own webview.
//
// NOTE before submitting: Browser.open uses SFSafariViewController, which is an
// in-app browser. Apple's external-purchase-link rules have historically wanted
// the *default* browser, and those rules moved in 2025 and are still moving.
// Confirm which is required and change it here — this is the only call site.
export async function openExternal(url) {
  if (!isNative()) {
    window.location.href = url;
    return;
  }
  await Browser.open({ url });
}

// Stripe cannot redirect to a custom scheme, so the server bounces the browser
// through /api/billing/return, which hands iOS `scholr://checkout-return`. iOS
// foregrounds the app and fires this. Returns an unsubscribe function.
export function onCheckoutReturn(handler) {
  if (!isNative()) return () => {};
  const sub = App.addListener("appUrlOpen", ({ url }) => {
    if (!url?.startsWith("scholr://checkout-return")) return;
    // The system browser sheet is still sitting over the app.
    Browser.close().catch(() => { /* already closed */ });
    const status = new URL(url).searchParams.get("status");
    handler(status === "success" ? "success" : "cancelled");
  });
  return () => { sub.then(s => s.remove()).catch(() => {}); };
}
