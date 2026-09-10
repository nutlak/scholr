// Fonts, colour palettes and status metadata shared across the app.

export const FONT = `"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;

export const FONT_SERIF = `"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;

export const FONT_HEADING = `"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;

export const MONO = `ui-monospace, "SF Mono", Consolas, monospace`;

export const TINTS = [
  { hue: "#A78BFA", deep: "#8B5CF6" }, // violet
  { hue: "#60A5FA", deep: "#3B82F6" }, // sky
  { hue: "#34D399", deep: "#10B981" }, // emerald
  { hue: "#FBBF24", deep: "#F59E0B" }, // amber
  { hue: "#F472B6", deep: "#EC4899" }, // pink
  { hue: "#FB7185", deep: "#F43F5E" }, // rose
  { hue: "#22D3EE", deep: "#06B6D4" }, // cyan
];

export function tintFor(seed) {
  if (!seed) return TINTS[0];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

export const CLASS_COLORS = [
  { id: "purple",  hue: "#A78BFA", deep: "#8B5CF6", label: "Purple"  },
  { id: "blue",    hue: "#60A5FA", deep: "#3B82F6", label: "Blue"    },
  { id: "emerald", hue: "#34D399", deep: "#10B981", label: "Emerald" },
  { id: "amber",   hue: "#FBBF24", deep: "#F59E0B", label: "Amber"   },
  { id: "pink",    hue: "#F472B6", deep: "#EC4899", label: "Pink"    },
  { id: "rose",    hue: "#FB7185", deep: "#F43F5E", label: "Rose"    },
];

export function classTint(color) {
  if (!color) return CLASS_COLORS[0];
  const lower = color.toLowerCase();
  return CLASS_COLORS.find(c => c.hue.toLowerCase() === lower) ?? CLASS_COLORS[0];
}

export const ACCENT_PRESETS = [
  { color: "#A78BFA", hover: "#C4B5FD", deep: "#7C3AED", name: "Purple" },
  { color: "#60A5FA", hover: "#93C5FD", deep: "#3B82F6", name: "Blue" },
  { color: "#34D399", hover: "#6EE7B7", deep: "#10B981", name: "Emerald" },
  { color: "#FBBF24", hover: "#FCD34D", deep: "#F59E0B", name: "Amber" },
  { color: "#F472B6", hover: "#F9A8D4", deep: "#EC4899", name: "Pink" },
  { color: "#FB7185", hover: "#FDA4AF", deep: "#F43F5E", name: "Rose" },
];

export const STATUS_META = {
  in_progress: { label: "In Progress", color: "#60A5FA", bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.32)" },
  done:        { label: "Done",        color: "#34D399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.32)" },
  need_help:   { label: "Need Help",   color: "#F87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.32)" },
};

export const REACTION_EMOJIS = ["👍", "✅", "🔥", "❤️", "😂", "🚀"];
