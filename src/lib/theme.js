// Fonts, colour palettes and status metadata shared across the app.

export const FONT = `"Hanken Grotesk", "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;

// Kalam: the hand-lettered face for headings, labels and anything that should
// read like a note in the margin. Body text stays Hanken Grotesk for legibility.
export const FONT_SERIF = `"Kalam", "Hanken Grotesk", system-ui, sans-serif`;

export const FONT_HEADING = `"Kalam", "Hanken Grotesk", system-ui, sans-serif`;

export const MONO = `"JetBrains Mono", ui-monospace, "SF Mono", Consolas, monospace`;

// Per-unit accent when a unit has no class colour: the theme's ink tokens, so
// small labels clear 4.5:1 on light and dark paper.
export const TINTS = [
  { hue: "var(--ink-blue)",   deep: "var(--ink-blue)" },
  { hue: "var(--ink-green)",  deep: "var(--ink-green)" },
  { hue: "var(--ink-amber)",  deep: "var(--ink-amber)" },
  { hue: "var(--ink-violet)", deep: "var(--ink-violet)" },
  { hue: "var(--ink-pink)",   deep: "var(--ink-pink)" },
  { hue: "var(--ink-red)",    deep: "var(--ink-red)" },
  { hue: "var(--ink-teal)",   deep: "var(--ink-teal)" },
];

export function tintFor(seed) {
  if (!seed) return TINTS[0];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

export const CLASS_COLORS = [
  { id: "purple", ink: "var(--ink-violet)",  hue: "#A78BFA", deep: "#8B5CF6", label: "Purple"  },
  { id: "blue", ink: "var(--ink-blue)",    hue: "#60A5FA", deep: "#3B82F6", label: "Blue"    },
  { id: "emerald", ink: "var(--ink-green)", hue: "#34D399", deep: "#10B981", label: "Emerald" },
  { id: "amber", ink: "var(--ink-amber)",   hue: "#FBBF24", deep: "#F59E0B", label: "Amber"   },
  { id: "pink", ink: "var(--ink-pink)",    hue: "#F472B6", deep: "#EC4899", label: "Pink"    },
  { id: "rose", ink: "var(--ink-red)",    hue: "#FB7185", deep: "#F43F5E", label: "Rose"    },
];

export function classTint(color) {
  if (!color) return CLASS_COLORS[0];
  const lower = color.toLowerCase();
  return CLASS_COLORS.find(c => c.hue.toLowerCase() === lower) ?? CLASS_COLORS[0];
}

/* Each preset carries BOTH themes' accents, because one hue cannot serve both
   grounds. `color` is the 400 shade: light enough to read on near-black, and
   far too light on white — #A78BFA on a white card is 2.4:1, so every accent
   label in the light theme was failing AA. `light` is the 700 shade, which
   clears 4.5:1 against white both as text and behind white text, so the same
   value works for a label and for a filled button.

   `--on-acc` does not need a per-preset value: every 400 shade is light enough
   for the dark theme's dark --on-acc, and every 700 shade is dark enough for
   the light theme's white one. */
export const ACCENT_PRESETS = [
  // Ballpoint blue first: the default, and the colour of pen on notebook paper.
  { name: "Blue",    color: "#8AB4FF", hover: "#A8C7FF", deep: "#6E9BF5", light: "#1D4ED8", lightHover: "#1E40AF" },
  { name: "Purple",  color: "#A78BFA", hover: "#C4B5FD", deep: "#7C3AED", light: "#6D28D9", lightHover: "#5B21B6" },
  { name: "Emerald", color: "#34D399", hover: "#6EE7B7", deep: "#10B981", light: "#047857", lightHover: "#065F46" },
  { name: "Amber",   color: "#FBBF24", hover: "#FCD34D", deep: "#F59E0B", light: "#A16207", lightHover: "#854D0E" },
  { name: "Pink",    color: "#F472B6", hover: "#F9A8D4", deep: "#EC4899", light: "#BE185D", lightHover: "#9D174D" },
  { name: "Rose",    color: "#FB7185", hover: "#FDA4AF", deep: "#F43F5E", light: "#BE123C", lightHover: "#9F1239" },
];

export const STATUS_META = {
  in_progress: { label: "In Progress", color: "#60A5FA", bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.32)" },
  done:        { label: "Done",        color: "#34D399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.32)" },
  need_help:   { label: "Need Help",   color: "#F87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.32)" },
};

export const REACTION_EMOJIS = ["👍", "✅", "🔥", "❤️", "😂", "🚀"];
