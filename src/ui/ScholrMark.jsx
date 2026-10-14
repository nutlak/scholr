// The scholr mark: the S-shaped speech bubble with the spark. The same art as
// the app icon, on its own tile, picked per theme.
export function ScholrMark({ size = 32, title = "scholr" }) {
  return (
    <span className="scholr-mark" style={{ width: size, height: size, borderRadius: Math.round(size * 0.26) }}>
      <img src="/scholr-logo-final.png" alt={title} width={size} height={size} className="scholr-mark-dark" />
      <img src="/scholr-logo-white.png" alt="" aria-hidden="true" width={size} height={size} className="scholr-mark-light" />
    </span>
  );
}
