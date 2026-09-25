import { useEffect, useState } from "react";
import { ACCENT_PRESETS } from "./theme.js";

/* Theme and accent colour: the two things the app persists about how it looks.
 *
 * Both write straight to the document — `data-theme` for the stylesheet to
 * branch on, and the accent as inline custom properties on <html> — so this is
 * exactly the "synchronise React state to an external system" shape an effect
 * is for. Lifted out of Scholr() whole; nothing about the behaviour changed.
 */
export function useAppearance() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("scholr-theme") ?? "dark"; }
    catch { return "dark"; }
  });
  const [accentColor, setAccentColor] = useState(() => {
    try { return localStorage.getItem("scholr-accent") ?? "#A78BFA"; }
    catch { return "var(--acc)"; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("scholr-theme", theme); } catch { /* ignore */ }
  }, [theme]);

  // Depends on `theme` as well as the colour. These land as inline properties
  // on <html>, which outrank html[data-theme="light"] — so before this, picking
  // an accent pinned the dark-theme hue into the light theme and there was no
  // way for the stylesheet to take it back. Every accent-coloured label in
  // light mode sat at about 2.4:1 as a result.
  useEffect(() => {
    const preset = ACCENT_PRESETS.find(p => p.color === accentColor) ?? ACCENT_PRESETS[0];
    const light = theme === "light";
    const acc = light ? preset.light : preset.color;
    const root = document.documentElement;
    root.style.setProperty("--acc", acc);
    root.style.setProperty("--acc-h", light ? preset.lightHover : preset.hover);
    root.style.setProperty("--acc-d", light ? preset.lightHover : preset.deep);
    root.style.setProperty("--acc-bg", `${acc}14`);
    root.style.setProperty("--acc-bg-h", `${acc}24`);
    root.style.setProperty("--acc-glow", `${acc}38`);
    // The aliases too. Components use --accent and --acc interchangeably, and
    // only --acc was being written — so choosing any non-purple accent left
    // half the app still purple, in both themes.
    root.style.setProperty("--accent", acc);
    root.style.setProperty("--accent-soft", `${acc}14`);
    try { localStorage.setItem("scholr-accent", accentColor); } catch { /* ignore */ }
  }, [accentColor, theme]);

  return { theme, setTheme, accentColor, setAccentColor };
}
