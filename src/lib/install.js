// Installing scholr to a home screen, which is the closest thing to a download
// a web app has.
//
// Two platforms, two stories. Chrome fires `beforeinstallprompt`, which we hold
// onto and replay when the person actually asks. iOS has no such API and never
// has — Safari only installs through Share ▸ Add to Home Screen, so there the
// honest thing is to show that instruction rather than a button that cannot do
// anything.
import { useEffect, useState } from "react";

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    // iOS predates display-mode and sets this instead.
    || window.navigator.standalone === true;
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ reports as a Mac; the touch point count is what separates them.
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function useInstall() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    const onPrompt = (e) => {
      // Chrome shows its own mini-infobar unless this is called; we want the
      // prompt to appear where the person asked for it, not on arrival.
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // A deferred prompt is single-use: Chrome rejects a second prompt() on the
  // same event, so it is dropped either way once it has been shown.
  async function install() {
    if (!deferred) return null;
    deferred.prompt();
    const { outcome } = await deferred.userChoice.catch(() => ({ outcome: "dismissed" }));
    setDeferred(null);
    return outcome;
  }

  return {
    installed,
    canPrompt: !!deferred,
    needsIOSInstructions: !installed && !deferred && isIOS(),
    install,
  };
}
