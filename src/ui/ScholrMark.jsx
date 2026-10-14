// The scholr mark: the S-shaped speech bubble with the spark. One element whose
// image comes from the theme (surface.css), so only the matching 1 KB WebP is
// downloaded. Two <img> tags, one hidden, cost both 54 KB PNGs for a 34px logo.
// The PNGs in /public stay for what can't take WebP: favicon, share cards,
// push icons and email.
export function ScholrMark({ size = 32, title = "scholr" }) {
  return <span className="scholr-mark" role="img" aria-label={title} style={{ width: size, height: size, borderRadius: Math.round(size * 0.26) }} />;
}
