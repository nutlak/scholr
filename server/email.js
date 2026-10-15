import { Resend } from "resend";
import { createHmac, timingSafeEqual } from "crypto";

// Unsubscribe links must not authorize on a bare user_id — every authenticated
// API surface leaks other users' UUIDs, so a raw `?u=<uuid>` link let anyone
// unsubscribe anyone (IDOR, and CSRF-able). Sign the id with an HMAC keyed off
// a server-only secret, domain-separated by purpose, and verify it before the
// write. No DB/schema change, one-click unsubscribe still works.
const UNSUB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.STRIPE_SECRET_KEY || "";
export function unsubToken(userId) {
  return createHmac("sha256", UNSUB_KEY).update(`unsubscribe:${userId}`).digest("base64url").slice(0, 24);
}
export function unsubTokenValid(userId, token) {
  if (!userId || !token) return false;
  const a = Buffer.from(String(token));
  const b = Buffer.from(unsubToken(userId));
  return a.length === b.length && timingSafeEqual(a, b);
}

// Resend client is created lazily so that dotenv has time to load
// process.env before this module's top-level code runs.
function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set — add it to server/.env");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

// Must exactly match a verified sender domain in your Resend account.
// The "from" stays a noreply sender on the verified domain so delivery
// never breaks; replies are routed to the live support inbox via replyTo.
function getFrom() {
  return process.env.RESEND_FROM ?? "scholr <noreply@scholr.dev>";
}

// Live, monitored support inbox (forwards to the real mailbox). Set as the
// reply-to on every transactional email so user replies reach a human, and
// matches the contact address shown across the app + legal docs.
const SUPPORT_EMAIL = "support@scholr.dev";

// ── One look for every email ──────────────────────────────────────────────
// Mirrors the app: a white card raised off a soft grey page, the S-bubble logo,
// a calm serif heading (Newsreader where the client loads web fonts, Georgia
// otherwise), Nunito/Helvetica body, purple for the one action. Inline styles
// only — mail clients strip <style> blocks unpredictably.
const BRAND = "#6D28D9";
const INK = "#15161B";
const MUTED = "#5E6472";
const SERIF = "'Newsreader',Georgia,'Times New Roman',serif";
const SANS = "'Nunito','Helvetica Neue',Arial,sans-serif";
const H = `font-family:${SERIF};color:${INK};font-weight:500;letter-spacing:-0.005em;line-height:1.2;`;
const P = `font-size:15px;color:#333740;line-height:1.7;margin:0 0 16px;`;
// User-supplied text goes into these templates (unit and class titles, names).
export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function ctaButton(label, href) {
  return `<a href="${href}" style="display:inline-block;background:${BRAND};color:#FFFFFF;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;text-decoration:none;margin:6px 0 8px;box-shadow:0 6px 16px -6px rgba(109,40,217,0.55);">${label}</a>`;
}

// Under the card of every optional email. MAIL_POSTAL_ADDRESS is the sender's
// physical address, which US CAN-SPAM requires on commercial email; set it in
// the server's environment (a PO box or registered-agent address works) and it
// appears here. Read per call so changing it needs no code change.
function optionalFooter() {
  const addr = process.env.MAIL_POSTAL_ADDRESS?.trim();
  return `You're getting this because you signed up for scholr. Reply anytime: <a href="mailto:support@scholr.dev" style="color:${MUTED};">support@scholr.dev</a>.${addr ? `<br>${esc(addr)}` : ""}`;
}

// RFC 8058 one-click unsubscribe: mail apps (Gmail's "Unsubscribe" button,
// Apple Mail) POST to this URL themselves. It's the same signed link as the one
// in the footer, and the endpoint already accepts POST with the token in the URL.
export function unsubHeaders(userId) {
  if (!userId) return undefined;
  const url = `${unsubBase()}/api/email/unsubscribe?u=${userId}&t=${unsubToken(userId)}`;
  return { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

// footer: what sits under the card (why you got it, unsubscribe). Pass the
// userId only for optional mail — transactional mail (codes, invites) has no
// unsubscribe link.
function emailShell(innerHtml, { userId, footer } = {}) {
  const unsub = userId
    ? `<br><a href="${unsubBase()}/api/email/unsubscribe?u=${userId}&t=${unsubToken(userId)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>`
    : "";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="light">
  <style>@import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500&family=Nunito:wght@400;700&display=swap');</style>
</head>
<body style="margin:0;padding:40px 16px;background:#F2F3F6;font-family:${SANS};">
  <div style="max-width:500px;margin:0 auto;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;"><tr>
      <td style="vertical-align:middle;"><img src="${appUrl()}/scholr-logo-white.png" width="36" height="36" alt="" style="display:block;border-radius:9px;box-shadow:0 1px 3px rgba(17,19,26,0.15);"></td>
      <td style="vertical-align:middle;padding-left:10px;font-size:22px;font-weight:700;color:${INK};font-family:${SANS};">schol<span style="color:${BRAND};">r</span></td>
    </tr></table>
    <div style="background:#FFFFFF;border:1px solid rgba(17,19,26,0.08);border-radius:18px;padding:32px 28px;box-shadow:0 1px 2px rgba(17,19,26,0.05),0 12px 28px -12px rgba(17,19,26,0.18);">
      ${innerHtml}
    </div>
    <p style="font-size:12px;color:${MUTED};line-height:1.6;margin:20px 4px 0;">
      ${footer ?? `Questions? Just reply, or write to <a href="mailto:support@scholr.dev" style="color:${MUTED};">support@scholr.dev</a>.`}${unsub}
    </p>
  </div>
</body>
</html>`;
}

// Pure builders, so templates can be previewed and tested without sending.
export function otpEmailHtml(code, type) {
  const isSignup = type === "signup";
  return emailShell(`
      <h1 style="${H}font-size:26px;margin:0 0 8px;">${isSignup ? "Welcome to scholr" : "Reset your password"}</h1>
      <p style="${P}">${isSignup ? "Here's your code to finish signing up." : "Here's your code to reset your password."}</p>
      <div style="background:#F6F7F9;border-radius:14px;padding:22px;text-align:center;margin:8px 0 18px;">
        <div style="font-size:40px;font-weight:700;letter-spacing:12px;color:${BRAND};font-family:'Courier New',monospace;padding-left:12px;">${code}</div>
      </div>
      <p style="font-size:13px;color:${MUTED};line-height:1.6;margin:0;">It expires in <strong style="color:${INK};">10 minutes</strong>. If you didn't ask for it, you can ignore this email.</p>
    `);
}

export async function sendOtpEmail(to, code, type) {
  const isSignup = type === "signup";
  const { error } = await getResend().emails.send({
    from: getFrom(),
    to,
    replyTo: SUPPORT_EMAIL,
    subject: isSignup ? "Verify your scholr account" : "Reset your scholr password",
    html: otpEmailHtml(code, type),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

export function inviteEmailHtml(inviterEmail, notebookTitle, classTitle, inviteUrl) {
  // Titles and the inviter's address are user-typed: escape before they meet HTML.
  inviterEmail = esc(inviterEmail); notebookTitle = esc(notebookTitle);
  const location = classTitle ? ` in ${esc(classTitle)}` : "";
  return emailShell(`
        <h1 style="${H}font-size:25px;margin:0 0 12px;">You're invited to study together</h1>
        <p style="${P}">${inviterEmail} invited you to <strong style="color:${INK};">${notebookTitle}</strong>${location} on scholr: shared notes, shared chat, and Derek, an AI tutor that reads them all.</p>
        ${ctaButton("Join the unit →", inviteUrl)}
      `, { footer: "No account yet? You'll make one in a minute. Weren't expecting this? You can ignore it." });
}

export async function sendInviteEmail(to, inviterEmail, notebookTitle, classTitle, inviteUrl) {
  try {
    const result = await getResend().emails.send({
      from: getFrom(),
      to,
      replyTo: SUPPORT_EMAIL,
      subject: `You've been invited to join ${notebookTitle} on scholr`,
      html: inviteEmailHtml(inviterEmail, notebookTitle, classTitle, inviteUrl),
    });
    if (result.error) throw new Error(`Resend error: ${result.error.message}`);
  } catch (err) {
    console.error("Resend error:", err);
    throw err;
  }
}

// ── Onboarding email sequence (welcome / day-3 Feynman / day-7 invite) ─────────
function appUrl() {
  const o = process.env.CLIENT_ORIGIN;
  return o && !o.startsWith("http://localhost") ? o : "https://scholr.dev";
}
// Where the unsubscribe link points. Set PUBLIC_API_URL to the Railway backend
// URL so one-click unsubscribe resolves; falls back to the app origin otherwise.
function unsubBase() {
  return process.env.PUBLIC_API_URL || appUrl();
}

const ONBOARDING_TEMPLATES = {
  welcome: (name) => ({
    subject: "Welcome to Scholr",
    html: `
      <h1 style="${H}font-size:26px;margin:0 0 14px;">Hey ${esc(name) || "there"}, you're in.</h1>
      <p style="${P}">Scholr turns your class notes into a shared AI tutor. Here's the 10-second version:</p>
      <p style="${P}">
        <strong style="color:#1C1C1C;">Upload notes</strong> — drop a PDF, image, or paste text<br>
        <strong style="color:#1C1C1C;">Ask Derek</strong> — your AI tutor that actually knows your material<br>
        <strong style="color:#1C1C1C;">Ace your class</strong> — quiz yourself with Feynman Mode &amp; study with friends
      </p>
      ${ctaButton("Open Scholr →", appUrl())}
      <p style="font-size:13px;color:#555555;margin:16px 0 0;">PS — reply to this email if you need anything. A real human (me) reads it: support@scholr.dev</p>
    `,
  }),
  feynman: () => ({
    subject: "The study trick your teacher didn't teach you",
    html: `
      <h1 style="${H}font-size:24px;margin:0 0 14px;">Most students re-read notes. The best students explain them.</h1>
      <p style="${P}">It's called the Feynman technique: if you can explain a concept in plain words, you actually understand it. If you stumble, you've found exactly what to review.</p>
      <p style="${P}">Scholr's <strong style="color:#1C1C1C;">Feynman Mode</strong> grades your explanation in real time — it tells you what you nailed, where the gaps are, and asks a follow-up to push you further.</p>
      ${ctaButton("Try Feynman Mode →", appUrl())}
    `,
  }),
  invite_friend: () => ({
    subject: "Studying alone is hard. Studying together isn't.",
    html: `
      <h1 style="${H}font-size:24px;margin:0 0 14px;">You've been on Scholr for a week.</h1>
      <p style="${P}">Here's what we've noticed: the students who get the most out of Scholr study with friends. Shared notebooks, shared notes, same exam.</p>
      <p style="${P}">Invite your study group — everyone's notes in one place, and Derek answers from all of it.</p>
      ${ctaButton("Invite your study group →", appUrl())}
    `,
  }),
};

// Send one onboarding email. type ∈ {welcome, feynman, invite_friend}.
export function onboardingEmail(type, name, userId) {
  const make = ONBOARDING_TEMPLATES[type];
  if (!make) throw new Error(`Unknown onboarding email type: ${type}`);
  const { subject, html } = make(name);
  return { subject, html: emailShell(html, { userId, footer: optionalFooter() }) };
}

export async function sendOnboardingEmail(type, to, name, userId) {
  const { subject, html } = onboardingEmail(type, name, userId);
  const { error } = await getResend().emails.send({
    from: getFrom(),
    to,
    replyTo: SUPPORT_EMAIL,
    subject,
    html,
    headers: unsubHeaders(userId),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

// ── Weekly recap ───────────────────────────────────────────────────────────────
// data: { daysStudied, friendsStudied, due: [{title, dueDate}], sessions: [{title, startsAt, note}] }
const dayLabel = (iso) => new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso)
  .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const li = (html) => `<li style="margin:0 0 8px;font-size:15px;color:#333740;line-height:1.5;">${html}</li>`;
const h3 = (t) => `<h2 style="${H}font-size:19px;margin:24px 0 8px;">${t}</h2>`;

export function recapEmailHtml(name, data, userId) {
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const parts = [];
  parts.push(`<h1 style="${H}font-size:26px;margin:0 0 10px;">Your week${name ? `, ${esc(name)}` : ""}</h1>`);
  parts.push(data.daysStudied > 0
    ? `<p style="${P}">You studied on <strong style="color:${INK};">${plural(data.daysStudied, "day")}</strong> this week${data.friendsStudied > 0 ? `, and <strong style="color:${INK};">${plural(data.friendsStudied, "friend")}</strong> did too` : ""}. Keep it going.</p>`
    : `<p style="${P}">Quiet week. A few minutes on one unit is enough to start the streak back up.</p>`);
  if (data.due.length) {
    parts.push(h3("Coming up"));
    parts.push(`<ul style="margin:0;padding-left:20px;">${data.due.map(d => li(`<strong style="color:${INK};">${esc(d.title)}</strong> · due ${dayLabel(d.dueDate)}`)).join("")}</ul>`);
  }
  if (data.sessions.length) {
    parts.push(h3("Study sessions planned"));
    parts.push(`<ul style="margin:0;padding-left:20px;">${data.sessions.map(s => li(`<strong style="color:${INK};">${esc(s.title)}</strong> · ${dayLabel(s.startsAt)}${s.note ? ` · ${esc(s.note)}` : ""}`)).join("")}</ul>`);
  }
  parts.push(`<div style="margin-top:24px;">${ctaButton("Open scholr →", appUrl())}</div>`);
  return emailShell(parts.join("\n"), { userId, footer: optionalFooter() });
}

export async function sendRecapEmail(to, name, userId, data) {
  const { error } = await getResend().emails.send({
    from: getFrom(),
    to,
    replyTo: SUPPORT_EMAIL,
    subject: data.daysStudied > 0 ? "Your week on scholr" : "What's coming up on scholr",
    html: recapEmailHtml(name, data, userId),
    headers: unsubHeaders(userId),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
