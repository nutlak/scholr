import { Resend } from "resend";

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

export async function sendOtpEmail(to, code, type) {
  const isSignup = type === "signup";

  const { error } = await getResend().emails.send({
    from: getFrom(),
    to,
    replyTo: SUPPORT_EMAIL,
    subject: isSignup ? "Verify your scholr account" : "Reset your scholr password",
    html: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:40px 20px;background:#0A0A0F;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:460px;margin:0 auto;">
    <div style="font-size:26px;font-weight:900;color:#E8E8F0;margin-bottom:6px;letter-spacing:-0.02em;">
      schol<span style="color:#A78BFA;">r</span>
    </div>
    <p style="font-size:13px;color:#808098;margin:0 0 28px;">
      ${isSignup ? "Complete your signup" : "Reset your password"}
    </p>

    <div style="background:#111118;border:1px solid #2A2A38;border-radius:14px;padding:32px;text-align:center;margin-bottom:20px;">
      <div style="font-size:12px;color:#505070;margin-bottom:14px;text-transform:uppercase;letter-spacing:0.1em;">
        Your verification code
      </div>
      <div style="font-size:46px;font-weight:700;letter-spacing:16px;color:#A78BFA;font-family:monospace;padding-left:16px;">
        ${code}
      </div>
    </div>

    <p style="font-size:12px;color:#404060;line-height:1.6;margin:0;">
      This code expires in <strong style="color:#606080;">10 minutes</strong>.
      If you didn't request this, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

export async function sendInviteEmail(to, inviterEmail, notebookTitle, classTitle, inviteUrl) {
  console.log("Resend key present:", !!process.env.RESEND_API_KEY);
  const location = classTitle ? ` in ${classTitle}` : "";
  try {
    console.log("Resend call starting");
    const result = await getResend().emails.send({
      from: getFrom(),
      to,
      replyTo: SUPPORT_EMAIL,
      subject: `You've been invited to join ${notebookTitle} on scholr`,
      html: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:40px 20px;background:#0A0A0F;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:460px;margin:0 auto;">
    <div style="font-size:26px;font-weight:900;color:#E8E8F0;margin-bottom:6px;letter-spacing:-0.02em;">
      schol<span style="color:#A78BFA;">r</span>
    </div>
    <p style="font-size:13px;color:#808098;margin:0 0 28px;">Study together, learn faster</p>

    <div style="background:#111118;border:1px solid #2A2A38;border-radius:14px;padding:32px;margin-bottom:20px;">
      <p style="font-size:15px;color:#C0C0D8;line-height:1.7;margin:0 0 24px;">
        ${inviterEmail} invited you to join <strong style="color:#E8E8F0;">${notebookTitle}</strong>${location} on scholr. Click below to accept and start studying together.
      </p>
      <a href="${inviteUrl}" style="display:inline-block;background:#A78BFA;color:#0A0A0F;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none;">Accept Invite</a>
    </div>

    <p style="font-size:12px;color:#404060;line-height:1.6;margin:0;">
      If you don't have a scholr account yet, you'll be prompted to create one first.<br>
      If you weren't expecting this invite, you can safely ignore it.
    </p>
  </div>
</body>
</html>`,
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

function emailShell(innerHtml, userId) {
  const unsub = userId
    ? `<a href="${unsubBase()}/api/email/unsubscribe?u=${userId}" style="color:#5b5b6b;text-decoration:underline;">Unsubscribe</a>`
    : "";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap');</style>
</head>
<body style="margin:0;padding:40px 20px;background:#08080C;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;">
    <div style="font-size:26px;font-weight:900;color:#E8E8F0;margin-bottom:24px;letter-spacing:-0.02em;">schol<span style="color:#A78BFA;">r</span></div>
    ${innerHtml}
    <p style="font-size:12px;color:#404060;line-height:1.6;margin:28px 0 0;border-top:1px solid #1c1c28;padding-top:16px;">
      You're getting this because you signed up for Scholr. Reply anytime — <a href="mailto:support@scholr.dev" style="color:#8b8b9b;">support@scholr.dev</a>.<br>${unsub}
    </p>
  </div>
</body>
</html>`;
}

const H = `font-family:'Playfair Display',Georgia,'Times New Roman',serif;color:#F5F5FA;font-weight:700;`;
const P = `font-size:15px;color:#C0C0D8;line-height:1.7;margin:0 0 16px;`;
function ctaButton(label, href) {
  return `<a href="${href}" style="display:inline-block;background:#A78BFA;color:#0A0A0F;font-weight:700;font-size:15px;padding:14px 30px;border-radius:10px;text-decoration:none;margin:6px 0 8px;">${label}</a>`;
}

const ONBOARDING_TEMPLATES = {
  welcome: (name) => ({
    subject: "Welcome to Scholr 🎓",
    html: `
      <h1 style="${H}font-size:26px;margin:0 0 14px;">Hey ${name || "there"}, you're in.</h1>
      <p style="${P}">Scholr turns your class notes into a shared AI tutor. Here's the 10-second version:</p>
      <p style="${P}">
        📤 <strong style="color:#E8E8F0;">Upload notes</strong> — drop a PDF, image, or paste text<br>
        💬 <strong style="color:#E8E8F0;">Ask Derek</strong> — your AI tutor that actually knows your material<br>
        🎯 <strong style="color:#E8E8F0;">Ace your class</strong> — quiz yourself with Feynman Mode &amp; study with friends
      </p>
      ${ctaButton("Open Scholr →", appUrl())}
      <p style="font-size:13px;color:#808098;margin:16px 0 0;">PS — reply to this email if you need anything. A real human (me) reads it: support@scholr.dev</p>
    `,
  }),
  feynman: () => ({
    subject: "The study trick your teacher didn't teach you",
    html: `
      <h1 style="${H}font-size:24px;margin:0 0 14px;">Most students re-read notes. The best students explain them.</h1>
      <p style="${P}">It's called the Feynman technique: if you can explain a concept in plain words, you actually understand it. If you stumble, you've found exactly what to review.</p>
      <p style="${P}">Scholr's <strong style="color:#E8E8F0;">Feynman Mode</strong> grades your explanation in real time — it tells you what you nailed, where the gaps are, and asks a follow-up to push you further.</p>
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
export async function sendOnboardingEmail(type, to, name, userId) {
  const make = ONBOARDING_TEMPLATES[type];
  if (!make) throw new Error(`Unknown onboarding email type: ${type}`);
  const { subject, html } = make(name);
  const { error } = await getResend().emails.send({
    from: getFrom(),
    to,
    replyTo: SUPPORT_EMAIL,
    subject,
    html: emailShell(html, userId),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
