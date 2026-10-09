// Set the theme before first paint so dark-paper users don't get a white flash.
// Mirrors useAppearance's default (saved choice, else the device setting).
try {
  var t = localStorage.getItem("scholr-theme-v2") ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", t);
} catch (e) { /* storage blocked: React sets it on mount */ }
