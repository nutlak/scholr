import { useEffect, useState } from "react";
import { ACCENT_PRESETS } from "./theme.js";

/* How the app looks: the paper theme in light or dark (dark = the same
 * notebook at night), and the accent colour.
 *
 * Both are the student's choice. New students get their device's light/dark
 * setting and the default accent. Choices are stored only when someone makes
 * one — saving the default on first load is what pinned everyone to purple,
 * then orange, when the default changed.
 *
 * The accent lands as inline custom properties on <html>, so this is the
 * "synchronise React state to an external system" shape an effect is for.
 */
const THEME_KEY = "scholr-theme-v2";
const ACCENT_KEY = "scholr-accent-v3";
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
const systemTheme = () => (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");

export function useAppearance() {
  const [theme, setThemeState] = useState(() => read(THEME_KEY) ?? systemTheme());
  const [accentColor, setAccentState] = useState(() => read(ACCENT_KEY) ?? ACCENT_PRESETS[0].color);

  const setTheme = (t) => { write(THEME_KEY, t); setThemeState(t); };
  const setAccentColor = (c) => { write(ACCENT_KEY, c); setAccentState(c); };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#1C1E23" : "#FFFFFF");
  }, [theme]);

  useEffect(() => {
    const preset = ACCENT_PRESETS.find(p => p.color === accentColor) ?? ACCENT_PRESETS[0];
    const dark = theme === "dark";
    // One hue can't serve both pages: the pale shade reads on slate, the deep
    // one on white.
    const acc = dark ? preset.color : preset.light;
    const root = document.documentElement;
    root.style.setProperty("--acc", acc);
    root.style.setProperty("--acc-h", dark ? preset.hover : preset.lightHover);
    root.style.setProperty("--acc-d", dark ? preset.deep : preset.lightHover);
    root.style.setProperty("--acc-bg", `${acc}${dark ? "1A" : "12"}`);
    root.style.setProperty("--acc-bg-h", `${acc}${dark ? "2E" : "22"}`);
    root.style.setProperty("--acc-glow", "transparent");
    root.style.setProperty("--accent", acc);
    root.style.setProperty("--accent-soft", `${acc}${dark ? "1A" : "12"}`);
  }, [accentColor, theme]);

  return { theme, setTheme, accentColor, setAccentColor };
}
