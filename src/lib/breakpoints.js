import { useEffect, useState } from "react";

// The one mobile boundary, matching the `@media (max-width: 768px)` blocks in
// index.css and App.css — breakpoints.test.js keeps those two agreeing, and
// anything reading the viewport from JS has to agree with them too.
export const MOBILE_QUERY = "(max-width: 768px)";

// For the handful of places where a *string* has to change on a phone, not
// just a style — a placeholder that gets cut mid-word at 390px can't be fixed
// in CSS.
export function useNarrow() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const on = e => setNarrow(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}
