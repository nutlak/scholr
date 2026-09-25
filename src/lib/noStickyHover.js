/* Stop tap-triggered hover states sticking on touch devices.
 *
 * Touch has no hover, so browsers fake one: the first tap on an element fires
 * mouseover/mouseenter and the hover styling stays applied until you tap
 * somewhere else. On a phone that means a button you tapped a minute ago is
 * still lit, and a row you scrolled past is still highlighted.
 *
 * This app has ~50 onMouseEnter/onMouseLeave handlers across 17 files that set
 * inline styles directly — the usual fix, wrapping :hover rules in
 * `@media (hover: hover)`, cannot reach any of them. Rather than edit fifty
 * call sites, swallow the synthetic events once, before React sees them.
 *
 * React attaches its listeners to the root container, so a capture-phase
 * listener on `document` runs first and stopPropagation keeps the event from
 * ever reaching React's delegation — which is what turns it into an
 * onMouseEnter call.
 *
 * Only the four hover events. mousemove is deliberately left alone: gestures
 * and drag implementations use it, and it carries no hover semantics of its
 * own.
 */

const HOVER_EVENTS = ["mouseover", "mouseout", "mouseenter", "mouseleave"];

let installed = false;

export function installNoStickyHover() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const swallow = e => {
    // Chrome says outright whether this mouse event was synthesised from a
    // tap. Safari does not implement sourceCapabilities, so fall back to
    // asking whether this device can hover at all — on a phone it cannot, and
    // on an iPad with a trackpad it can, which is exactly the distinction that
    // matters. Never branch on the user agent for this.
    const fromTouch = e.sourceCapabilities?.firesTouchEvents
      ?? !window.matchMedia("(hover: hover)").matches;
    if (fromTouch) e.stopPropagation();
  };

  for (const type of HOVER_EVENTS) {
    document.addEventListener(type, swallow, true);
  }
}
