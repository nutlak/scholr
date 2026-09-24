import { MOBILE_QUERY } from "./breakpoints.js";

/* Drag-to-dismiss for every bottom sheet, installed once.
 *
 * Fourteen components render `.mobile-sheet` inside a `.mobile-sheet-overlay`,
 * and all fourteen already dismiss when the backdrop is clicked. So this is one
 * delegated listener on the document rather than a prop threaded through
 * fourteen call sites, and dismissing is "click the backdrop the way a finger
 * would have" — the app's existing contract, not a second one.
 *
 * The behaviour follows Apple's fluid-interface rules, which are mostly about
 * what happens at the seams:
 *
 *   - the sheet tracks the finger 1:1 from the moment it moves, never after;
 *   - a sheet caught mid-animation is grabbed from where it is ON SCREEN, not
 *     from where it was heading, so there is no jump;
 *   - the release velocity is projected forward to decide where the gesture was
 *     going, the way scrolling decelerates — a flick throws the sheet even from
 *     two pixels down, and a slow drag most of the way down still settles back;
 *   - that same velocity seeds the spring, so there is no seam between dragging
 *     and animating;
 *   - dragging up past the top resists progressively instead of stopping dead.
 */

const DECELERATION = 0.998;

// How far back to look when measuring release velocity. Long enough to average
// out per-frame jitter at 60Hz, short enough that a pause before lifting reads
// as a stop.
const VELOCITY_WINDOW_MS = 100;

// Apple's projection function from the Designing Fluid Interfaces sample code,
// not the v²/2a from a physics textbook: where the gesture would COAST to.
export const project = v => (v / 1000) * DECELERATION / (1 - DECELERATION);

// The further past the edge you pull, the less the sheet follows. Real things
// slow down before they stop; a hard stop reads as frozen.
export const rubberband = (overshoot, dimension, c = 0.55) =>
  (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));

/* Damping ratio and response, the two parameters Apple exposes instead of
 * mass/stiffness/damping. A drawer is 0.8 / 0.3: a little overshoot, because a
 * drag carried momentum and a dead stop would read as hitting a wall.
 * Returns a cancel function — every spring here must be interruptible. */
export function spring(from, to, velocity, onFrame, onRest, dampingRatio = 0.8, response = 0.3) {
  const k = (2 * Math.PI / response) ** 2;
  const c = 4 * Math.PI * dampingRatio / response;
  let x = from - to;
  let v = velocity;
  let last = performance.now();
  let raf = 0;

  const step = now => {
    // Substep at a fixed 240Hz: integrating a stiff spring with a whole 60Hz
    // frame as the timestep is how these blow up on a slow frame.
    const dt = Math.min((now - last) / 1000, 0.064);
    last = now;
    const n = Math.max(1, Math.ceil(dt * 240));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      v += (-k * x - c * v) * h;
      x += v * h;
    }
    if (Math.abs(x) < 0.5 && Math.abs(v) < 20) {
      onFrame(to);
      onRest?.();
      return;
    }
    onFrame(to + x);
    raf = requestAnimationFrame(step);
  };

  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

// What the element is actually showing right now, which is what an interrupted
// gesture has to continue from. Reading the style property instead would give
// the value it is animating TOWARDS, and the sheet would jump on grab.
function presentedY(el) {
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return m.m42 || 0;
}

const last = arr => arr[arr.length - 1];

let installed = false;

export function installSheetDrag() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const mq = window.matchMedia(MOBILE_QUERY);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  let sheet = null;
  let overlay = null;
  let pointerId = null;
  let grabY = 0;        // where the finger went down, in page coordinates
  let baseY = 0;        // the sheet's on-screen offset when it was grabbed
  let height = 0;
  let dragging = false; // true only once the gesture has passed the threshold
  let cancelSpring = null;
  let draggedAt = 0;    // timeStamp of the last drag release
  const trail = [];     // recent {t, y}, for the release velocity

  const setY = y => {
    sheet.style.transform = y ? `translateY(${y}px)` : "";
    // Fading the scrim as the sheet leaves says the dismiss is coming before
    // it commits, which is what makes it feel like a decision you can take back.
    if (overlay) overlay.style.opacity = String(1 - Math.min(y / height, 1) * 0.55);
  };

  // Takes the elements explicitly: by the time a spring rests, the module's
  // `sheet`/`overlay` have already been released for the next gesture.
  const release = (el, ov) => {
    if (el) { el.style.transform = ""; el.style.willChange = ""; el.style.animation = ""; }
    if (ov) ov.style.opacity = "";
  };

  const clearSheet = () => {
    release(sheet, overlay);
    sheet = overlay = null;
    pointerId = null;
    dragging = false;
    trail.length = 0;
  };

  const onDown = e => {
    if (!mq.matches || e.button > 0) return;
    const el = e.target.closest?.(".mobile-sheet");
    if (!el) return;

    // A sheet scrolled down belongs to the scroller, not the gesture — except
    // on the grab handle, which is there to say "this part is for dragging".
    const onHandle = e.clientY - el.getBoundingClientRect().top < 28;
    if (!onHandle && el.scrollTop > 0) return;

    cancelSpring?.();
    cancelSpring = null;

    sheet = el;
    overlay = el.closest(".mobile-sheet-overlay");
    pointerId = e.pointerId;
    grabY = e.clientY;
    height = el.getBoundingClientRect().height;
    // Interrupting the open animation: take over from wherever it has got to.
    baseY = presentedY(el);
    if (baseY) el.style.animation = "none";
    dragging = false;
    trail.length = 0;
    trail.push({ t: e.timeStamp, y: e.clientY });
  };

  const onMove = e => {
    if (!sheet || e.pointerId !== pointerId) return;
    const dy = e.clientY - grabY;

    if (!dragging) {
      // Hysteresis: commit to a direction before stealing the gesture, so a tap
      // that wobbles a pixel is still a tap.
      if (Math.abs(dy) < 10) return;
      if (dy < 0 && sheet.scrollTop > 0) { clearSheet(); return; }
      dragging = true;
      sheet.style.animation = "none";
      sheet.style.willChange = "transform";
      // Keeps tracking even when the finger leaves the sheet's bounds.
      try { sheet.setPointerCapture(pointerId); } catch { /* not capturable */ }
    }

    trail.push({ t: e.timeStamp, y: e.clientY });
    // Enough samples to cover VELOCITY_WINDOW_MS even on a 120Hz screen.
    while (trail.length > 2 && last(trail).t - trail[0].t > VELOCITY_WINDOW_MS * 2) trail.shift();

    const raw = baseY + dy;
    setY(raw >= 0 ? raw : -rubberband(-raw, height));
    e.preventDefault();
  };

  const onUp = e => {
    if (!sheet || e.pointerId !== pointerId) return;
    if (!dragging) { clearSheet(); return; }

    const el = sheet;
    const ov = overlay;
    const h = height;
    const current = Math.max(baseY + (e.clientY - grabY), 0);

    // Velocity over the last moment of the gesture, not the last single move
    // and not the whole drag. One pair of events lands on whatever jitter the
    // final sample carried; the whole drag is worse — hold a sheet still for a
    // beat and then let go, and averaging over the trail reports the speed you
    // were moving at seconds ago, so a deliberate stop flings it away. A finger
    // that has paused has no velocity, which is exactly what this window says.
    // The release itself is a sample. Without it the window ends at the last
    // *move*, so holding the sheet still for a beat and then lifting still
    // reports the speed of the last movement before the pause — the sheet flies
    // away from a finger that had deliberately stopped. Pushing the lift in
    // means a pause shows up as what it is: time passing with no movement.
    trail.push({ t: e.timeStamp, y: e.clientY });

    const end = last(trail);
    const recent = trail.filter(p => end.t - p.t <= VELOCITY_WINDOW_MS);
    const first = recent[0];
    const dt = recent.length > 1 ? end.t - first.t : 0;
    const velocity = dt > 0 ? ((end.y - first.y) / dt) * 1000 : 0;

    // Where the gesture was GOING, not where the finger stopped. This is what
    // makes a short flick throw the sheet and a long slow drag not.
    const dismiss = current + project(velocity) > h * 0.4;

    const finish = () => {
      // Leave the transform in place until after the close: clearing it first
      // snaps the sheet back up for one frame before it unmounts.
      ov?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      release(el, ov);
    };

    // Hand the module state over now, so a second grab during the spring is a
    // fresh gesture rather than a fight with this one.
    sheet = null;
    overlay = null;
    pointerId = null;
    dragging = false;
    // The click that ends a drag must not also press whatever is under it.
    // Checked by timestamp because `dragging` is already false by then.
    draggedAt = e.timeStamp;

    if (reduced.matches) {
      if (dismiss) finish(); else release(el, ov);
      return;
    }

    cancelSpring = spring(
      current,
      dismiss ? h : 0,
      velocity,
      y => {
        el.style.transform = `translateY(${y}px)`;
        if (ov) ov.style.opacity = String(1 - Math.min(y / h, 1) * 0.55);
      },
      dismiss ? finish : () => release(el, ov),
      // Settling back needs no bounce — nothing was thrown, it is returning.
      dismiss ? 0.8 : 1,
    );
  };

  document.addEventListener("pointerdown", onDown, true);
  document.addEventListener("pointermove", onMove, { passive: false });
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", () => { if (dragging) clearSheet(); });

  // A drag that ends over a button must not also press it. The click follows
  // its pointerup in the same task, so a short window is enough and cannot
  // swallow a later real tap.
  document.addEventListener("click", e => {
    if (e.timeStamp - draggedAt > 100) return;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}
