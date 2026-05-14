import { Resend } from "resend";

// Resend client is created lazily so that dotenv has time to load
// process.env before this module's top-level code runs.
function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set — add it to server/.env");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

// Must exactly match a verified sender domain in your Resend account
function getFrom() {
  return process.env.RESEND_FROM ?? "Scholr <noreply@scholr.dev>";
}

export async function sendOtpEmail(to, code, type) {
  const isSignup = type === "signup";

  const { error } = await getResend().emails.send({
    from: getFrom(),
    to,
    subject: isSignup ? "Verify your Scholr account" : "Reset your Scholr password",
    html: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:40px 20px;background:#0A0A0F;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:460px;margin:0 auto;">
    <div style="font-size:26px;font-weight:900;color:#E8E8F0;margin-bottom:6px;letter-spacing:-0.02em;">
      Schol<span style="color:#A78BFA;">r</span>
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
