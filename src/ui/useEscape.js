import { useEffect, useRef } from "react";

// Escape closes a dialog. Every modal in the app should call this — before it
// existed only ToolModal handled the key, so every other dialog trapped you
// until you found its × or a safe patch of backdrop.
//
// Only the most recently opened dialog reacts: a confirm-delete sheet on top of
// a class card, or the friend modal over the dashboard, would otherwise all
// close on one press. `onClose` is kept in a ref so an inline arrow (which most
// callers pass) doesn't re-register — re-registering on every render would keep
// bumping a parent back to the top of the stack over its own child.
const stack = [];

export function useEscape(onClose, active = true) {
  const latest = useRef(onClose);
  useEffect(() => { latest.current = onClose; });

  useEffect(() => {
    if (!active) return undefined;
    const token = {};
    stack.push(token);
    function onKey(e) {
      if (e.key !== "Escape") return;
      if (stack[stack.length - 1] !== token) return;
      e.stopPropagation();
      latest.current?.();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const i = stack.indexOf(token);
      if (i !== -1) stack.splice(i, 1);
    };
  }, [active]);
}
