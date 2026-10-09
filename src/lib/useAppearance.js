import { useEffect, useState } from "react";
import { ACCENT_PRESETS } from "./theme.js";

/* How the app looks: always the paper theme now (hand-drawn ink on white — the
 * dark "instrument panel" look was retired), plus the accent colour, which is
 * still the student's choice.
 *
 * The accent lands as inline custom properties on <html>, so this is the
 * "synchronise React state to an external system" shape an effect is for.
 * Stored under a new key: the old one held purple for nearly everyone (it was
 * written on first load), which would have pinned the retired default.
 */
const KEY = "scholr-accent-v2";

export function useAppearance() {
  const [accentColor, setAccentColor] = useState(() => {
    try { return localStorage.getItem(KEY) ?? ACCENT_PRESETS[0].color; }
    catch { return ACCENT_PRESETS[0].color; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);

  useEffect(() => {
    const preset = ACCENT_PRESETS.find(p => p.color === accentColor) ?? ACCENT_PRESETS[0];
    const acc = preset.light;
    const root = document.documentElement;
    root.style.setProperty("--acc", acc);
    root.style.setProperty("--acc-h", preset.lightHover);
    root.style.setProperty("--acc-d", preset.lightHover);
    root.style.setProperty("--acc-bg", `${acc}14`);
    root.style.setProperty("--acc-bg-h", `${acc}24`);
    root.style.setProperty("--acc-glow", "transparent");
    // The aliases too: components use --accent and --acc interchangeably.
    root.style.setProperty("--accent", acc);
    root.style.setProperty("--accent-soft", `${acc}14`);
    try { localStorage.setItem(KEY, accentColor); } catch { /* ignore */ }
  }, [accentColor]);

  return { accentColor, setAccentColor };
}
