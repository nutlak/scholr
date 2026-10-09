// The scholr mark, hand-drawn: a wobbly ink speech bubble with a handwritten
// "s" in the accent. Inline SVG so it follows the accent and stays crisp.
export function ScholrMark({ size = 32, title = "scholr" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} style={{ flexShrink: 0 }}>
      <path
        d="M14 9.5c11-1.6 25.4-1.9 36.6-.4 4.6.7 6.1 3.4 6.3 8.2.4 8.5.2 15.7-.6 22.6-.5 4.3-3 6.1-7.4 6.4-7.7.5-15.3.4-22.6.6l-11.6 9.4c-.9.7-2-.1-1.7-1.2l2.2-8.4c-4.3-.6-6.6-2.7-7-7.3-.6-6.8-.7-13.9-.1-21.2.4-5 2.6-7.8 5.9-8.7Z"
        fill="var(--bg-surface-1, #fff)" stroke="var(--text-primary, #1c1c1c)" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round"
      />
      <text x="32.5" y="38" textAnchor="middle" fontFamily="Kalam, cursive" fontWeight="700" fontSize="30" fill="var(--acc, #1D4ED8)">s</text>
    </svg>
  );
}
