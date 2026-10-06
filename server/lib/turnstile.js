// Cloudflare Turnstile — bot check on the endpoints that send email.
//
// Off until TURNSTILE_SECRET_KEY is set, so the server can deploy ahead of the
// client. Once it is set it fails closed: no token, a bad token, or Cloudflare
// being unreachable all reject. The per-IP and per-email limiters still sit in
// front either way.
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(token, ip, { secret = process.env.TURNSTILE_SECRET_KEY, fetchImpl = fetch } = {}) {
  if (!secret) return true;
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const res = await fetchImpl(VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(5000),
    });
    return (await res.json()).success === true;
  } catch (err) {
    console.error("[turnstile] verify failed:", err.message);
    return false;
  }
}

export async function requireTurnstile(req, res, next) {
  if (await verifyTurnstile(req.body?.captchaToken, req.ip)) return next();
  res.status(403).json({ error: "Couldn't confirm you're human. Refresh the page and try again." });
}
