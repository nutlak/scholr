import { useState } from "react";
import { api } from "../api.js";
import { useServerFeature } from "./useServerFeature.js";

/* Plan state and the one thing you can do with it from inside the app: open
 * Stripe's billing portal. Every paid surface (Settings, the renewal banner,
 * the mobile billing row, the payment-failed notification) routes through
 * `openPortal`, so there is one place where a failed portal session is
 * reported rather than four.
 */
export function useBilling({ onToast }) {
  const [subscription, setSubscription] = useState({
    tier: "free",
    messagesUsed: 0, messagesLimit: 100,
    forgeUsed: 0, forgeLimit: 3,
    notebooksUsed: 0, notebooksLimit: 3,
  });
  const [portalLoading, setPortalLoading] = useState(false);
  // Same gate as SettingsView: the portal 500s without Stripe server-side.
  const billingReady = useServerFeature("pro");

  async function openPortal() {
    setPortalLoading(true);
    try {
      // api.createPortalSession() redirects via window.location.href on success
      await api.createPortalSession();
    } catch (err) {
      console.error("Portal session error:", err);
      onToast?.({ text: "Could not open subscription management. Please try again.", tone: "error" });
      setPortalLoading(false);
    }
  }

  function refreshSubscription() {
    api.getSubscription().then(setSubscription).catch(console.error);
  }

  return { subscription, setSubscription, portalLoading, billingReady, openPortal, refreshSubscription };
}
