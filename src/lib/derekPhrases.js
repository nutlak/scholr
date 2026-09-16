import { useEffect, useState } from "react";

// Rotating "Derek is thinking" phrases — same idea as Claude Code's own
// spinner verb rotation, sized to Derek's study-buddy voice rather than a
// generic assistant. Kept short and plain (no in-jokes) per the house rule
// that copy stays legible for an 83-year-old.
export const DEREK_LOADING_PHRASES = [
  "Thinking…",
  "Flipping through your notes…",
  "Connecting the dots…",
  "Reading between the lines…",
  "Cross-referencing your notes…",
  "Piecing it together…",
  "Getting up to speed…",
  "Making sense of it…",
  "Working through it…",
  "Digging into the material…",
  "Following the thread…",
  "Checking my work…",
  "Studying up…",
  "Pulling this together…",
];

// Cycles through DEREK_LOADING_PHRASES every 1.8s while `active`. Starts from
// a random phrase (lazy initializer — no setState-in-effect) so the same
// word doesn't open every single wait.
export function useDerekPhrase(active) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * DEREK_LOADING_PHRASES.length));
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setIdx(i => (i + 1) % DEREK_LOADING_PHRASES.length), 1800);
    return () => clearInterval(id);
  }, [active]);
  return DEREK_LOADING_PHRASES[idx];
}
