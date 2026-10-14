// Public URL builders: the app origin and unsubscribe pages.
// Where links in emails and PIN invites point: the deployed client, never
// localhost.
export function appOrigin() {
  const o = process.env.CLIENT_ORIGIN;
  return o && !o.startsWith("http://localhost") ? o : "https://scholr.dev";
}

// ── Email unsubscribe — GET confirm page (scanner-safe), POST sets the flag ────
// The standalone page behind an email's unsubscribe link: same look as the app
// (a white card on a soft page, light or dark with the reader's device).
export const unsubPage = (body) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>scholr</title><style>
:root{--bg:#F2F3F6;--card:#fff;--ink:#15161B;--muted:#5E6472;--acc:#6D28D9;--on:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#0C0D11;--card:#16181E;--ink:#ECEDF2;--muted:#9096A3;--acc:#A78BFA;--on:#160F2B}}
body{margin:0;padding:48px 16px;display:flex;justify-content:center;background:var(--bg);color:var(--ink);font-family:Nunito,-apple-system,"Helvetica Neue",Arial,sans-serif}
main{width:100%;max-width:440px;box-sizing:border-box;padding:32px 28px;background:var(--card);border-radius:18px;box-shadow:0 1px 2px rgba(0,0,0,.08),0 12px 28px -12px rgba(0,0,0,.25)}
.brand{font-size:22px;font-weight:800;margin-bottom:18px}.brand span{color:var(--acc)}
p{margin:0 0 18px;line-height:1.65;font-size:15px}.muted{color:var(--muted);font-size:13.5px}
button{background:var(--acc);color:var(--on);border:0;border-radius:12px;padding:13px 26px;font-weight:700;font-size:15px;font-family:inherit;cursor:pointer}
</style></head><body><main><div class="brand">schol<span>r</span></div>${body}</main></body></html>`;
