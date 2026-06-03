// Standalone legal pages (/privacy, /terms, /copyright) + a shared LegalFooter.
// Rendered by App.jsx's pathname check (no router). Legal text is VERBATIM — the
// tiny renderer below only maps "# "→h1, "## "→h2, and blank-line-separated
// paragraphs (wrapped source lines are re-joined with spaces, which restores the
// original sentences without changing any words). Paragraph text auto-links the
// exact phrases "Terms of Service" / "Privacy Policy" / "Copyright / DMCA Policy"
// and the support email — the link text is the phrase itself, so wording is
// unchanged. Uses theme tokens (var(--…)) only.

const FONT = `"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
const FONT_SERIF = `"Instrument Serif", "Times New Roman", Georgia, serif`;
const SUPPORT_EMAIL = "support@scholr.dev";

const linkStyle = { color: "var(--accent)", fontWeight: 600, textDecoration: "none" };

const h1Style = {
  fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 400,
  /* Softer: smaller top-end + tight letter-spacing reads elegant, not aggressive */
  fontSize: "clamp(28px, 4.5vw, 38px)",
  color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2,
  margin: "0 0 20px",
};
const h2Style = {
  fontFamily: FONT, fontSize: 19, fontWeight: 600,
  color: "var(--text-primary)", letterSpacing: "-0.015em", lineHeight: 1.3,
  margin: "30px 0 8px",
};
const pStyle = {
  fontFamily: FONT, fontSize: 15, lineHeight: 1.75,
  color: "var(--text-secondary)", margin: "0 0 14px",
};
const metaStyle = {
  fontFamily: FONT, fontSize: 13, lineHeight: 1.5,
  color: "var(--text-tertiary)", margin: "0 0 4px",
};

const LINK_PATTERNS = [
  { phrase: "Copyright / DMCA Policy", href: "/copyright" },
  { phrase: "Terms of Service", href: "/terms" },
  { phrase: "Privacy Policy", href: "/privacy" },
];

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function linkify(text, keyPrefix) {
  const combined = new RegExp(
    `(${LINK_PATTERNS.map(p => escapeRe(p.phrase)).join("|")}|${escapeRe(SUPPORT_EMAIL)})`,
    "g",
  );
  return text.split(combined).map((part, i) => {
    if (part === SUPPORT_EMAIL) {
      return <a key={`${keyPrefix}-${i}`} href={`mailto:${SUPPORT_EMAIL}`} style={linkStyle}>{part}</a>;
    }
    const match = LINK_PATTERNS.find(p => p.phrase === part);
    if (match) {
      return <a key={`${keyPrefix}-${i}`} href={match.href} style={linkStyle}>{part}</a>;
    }
    return part;
  });
}

function renderDoc(body) {
  const lines = body.replace(/^\n+/, "").replace(/\n+$/, "").split("\n");
  const blocks = [];
  let para = [];
  const flush = () => {
    if (para.length) { blocks.push({ type: "p", text: para.join(" ") }); para = []; }
  };
  for (const raw of lines) {
    if (raw.trim() === "") { flush(); continue; }
    if (raw.startsWith("## ")) { flush(); blocks.push({ type: "h2", text: raw.slice(3).trim() }); continue; }
    if (raw.startsWith("# ")) { flush(); blocks.push({ type: "h1", text: raw.slice(2).trim() }); continue; }
    para.push(raw.trim());
  }
  flush();
  return blocks.map((b, i) => {
    if (b.type === "h1") return <h1 key={i} style={h1Style}>{b.text}</h1>;
    if (b.type === "h2") return <h2 key={i} style={h2Style}>{b.text}</h2>;
    const isMeta = /^(Effective date:|Last updated:)/.test(b.text);
    return <p key={i} style={isMeta ? metaStyle : pStyle}>{linkify(b.text, i)}</p>;
  });
}

export function LegalFooter({ compact = false }) {
  const links = [
    ["Privacy", "/privacy"],
    ["Terms", "/terms"],
    ["Copyright", "/copyright"],
  ];
  if (compact) {
    return (
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px",
        padding: "10px 12px", fontFamily: FONT, fontSize: 11,
        color: "var(--text-tertiary)",
      }}>
        {links.map(([label, href]) => (
          <a key={href} href={href} style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>{label}</a>
        ))}
        <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>Contact</a>
      </div>
    );
  }
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "center",
      justifyContent: "center", gap: "8px 18px",
      marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--border-subtle)",
      fontFamily: FONT, fontSize: 13, color: "var(--text-tertiary)",
    }}>
      {links.map(([label, href]) => (
        <a key={href} href={href} style={{ color: "var(--text-secondary)", textDecoration: "none" }}>{label}</a>
      ))}
      <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "var(--text-secondary)", textDecoration: "none" }}>
        Contact: {SUPPORT_EMAIL}
      </a>
    </div>
  );
}

const DOCS = {
  privacy: `# Privacy Policy

Effective date: June 2, 2026

Last updated: June 2, 2026

Policy version: 2026-06-02

Scholr ("Scholr," "we," "us," or "our") operates the website at scholr.dev and
related study tools (the "Service"). This Privacy Policy explains what
information we collect, how we use it, who we share it with, and the choices you
have. By using the Service, you agree to this Policy. Questions? Contact us at
support@scholr.dev.

## 1. Who can use Scholr / Age requirement
You must be at least 13 years old to use Scholr. The Service is not directed to
children under 13, and we do not knowingly collect personal information from
anyone under 13. If you believe a child under 13 has provided us personal
information, contact us at support@scholr.dev and we will delete it. If you are
between 13 and 18 (or the age of majority where you live), you may use Scholr
only with the involvement and consent of a parent or legal guardian, who agrees
to be bound by our Terms of Service on your behalf.

## 2. Information we collect
Information you provide: account information (your email address, used for
sign-in via one-time codes, and any display name you set); content you upload or
create (notes, documents and files you upload such as PDFs and text, notebook
titles, questions you ask our AI study assistant, explanations you write, and
similar study material — "User Content"); payment information (if you subscribe,
payment is processed by Stripe — we do not store your full card number; we
receive limited information such as your subscription status and a customer
identifier); and communications you send us for support.

Information collected automatically: basic usage and device data (such as
actions taken in the app, approximate request information, and error logs) used
to operate and improve the Service; and cookies and similar technologies (see
Section 7). We do not intentionally collect special categories of sensitive
data, and we ask that you not upload such information.

## 3. How we use your information
We use information to provide and operate the Service (authenticate you, store
your notebooks, run the AI study features you request); process subscriptions
and payments; provide customer support; maintain security, prevent abuse, and
enforce usage limits; and improve and develop the Service. We do not sell your
personal information, and we do not use your User Content to train our own
models.

Legal bases for processing (where the GDPR or similar laws apply): we process
your personal data to perform our contract with you and provide the Service you
request; for our legitimate interests in operating, securing, and improving the
Service and preventing abuse (balanced against your rights); to comply with our
legal obligations (such as tax and record-keeping); and, where we rely on it, on
the basis of your consent, which you may withdraw at any time.

## 4. AI processing of your content
Scholr's study features (such as the AI chat assistant, content generation,
audio "podcast" generation, and explanation grading) work by sending the
relevant material — for example, your notebook notes and the questions or text
you submit — to third-party AI providers to generate a response. When you use
these features, the relevant User Content is transmitted to Anthropic (the
Claude API), for text-based study features, and OpenAI, for audio generation
(text-to-speech). These providers process the content to return a result to you.
We rely on these providers' standard API terms, under which API inputs and
outputs are not used to train their models by default. AI outputs can be
inaccurate — see our Terms of Service for the full AI disclaimer. Please do not
upload information you are not comfortable transmitting to these third-party
processors.

Automated processing. Scholr's AI features (chat answers, generated study
materials, audio overviews, and Feynman Mode "grades") are educational study
aids — not authoritative evaluations or legally significant decisions. They do
not determine your grades, academic standing, admissions, or eligibility, and we
do not use them to make decisions that produce legal or similarly significant
effects about you. Always verify AI output independently.

## 5. How we share information
We share information only as described here: with service providers /
subprocessors who help us run Scholr, including Supabase (database, file
storage, and authentication), Vercel (frontend hosting), Railway (backend
hosting), Stripe (payment processing), Resend (transactional email such as
sign-in codes), and Anthropic and OpenAI (AI processing, see Section 4); with
other users, when you choose to share a notebook or invite collaborators, in
which case content in the shared notebook is visible to the people you share it
with; for legal and safety reasons, if required by law or to protect the rights,
safety, or property of Scholr, our users, or others; and in business transfers,
if Scholr is involved in a merger, acquisition, or sale of assets. We may add,
replace, or remove service providers that perform similar functions to those
listed above; we keep this section reasonably current, and any new provider
remains subject to this Policy. When you share a notebook or invite
collaborators, the people you share with may view, download, copy, screenshot,
or otherwise retain that content, and we cannot control or delete copies they
keep outside the Service.

## 6. Data retention and deletion
We keep your account information and User Content for as long as your account is
active. You can delete your account at any time from your account settings (under
Settings) or by contacting us at support@scholr.dev. When you delete your
account, we delete your personal information and User Content within
approximately 30 days, except: (a) information in routine, encrypted backups,
which is overwritten on a rolling basis (generally within 30–90 days); (b)
billing and transaction records, which we and our payment processor retain as
required by tax and accounting law (generally up to 7 years); and (c) limited
records we must keep for legal, security, or fraud-prevention purposes, retained
only as long as necessary for those purposes.

## 7. Cookies and similar technologies
We use only strictly necessary cookies and similar technologies (including
browser local storage) to operate the Service — for example, to keep you signed
in. We do not use advertising or third-party analytics cookies, and we do not
use your personal information for targeted or cross-context behavioral
advertising. If this changes, we will update this Policy and provide any notice
or controls required by law. You can control cookies through your browser
settings, but disabling strictly necessary storage may break parts of the
Service.

## 8. Security
We take reasonable measures to protect your information, including encryption in
transit, access controls on our database, and limiting who and what can access
your data. No method of transmission or storage is 100% secure, so we cannot
guarantee absolute security. If we become aware of a data breach affecting your
personal information, we will notify affected users and any authorities as
required by applicable law.

## 9. Your rights and choices
Depending on where you live, you may have rights to access, correct, delete, or
port your personal information, or to object to or restrict certain processing.
To exercise these rights, contact us at support@scholr.dev. We will respond as
required by applicable law. You will not be discriminated against for exercising
these rights.

California residents. If you are a California resident, you have the right to
know what personal information we collect and how we use and disclose it, to
access and delete it, to correct inaccurate information, and to opt out of the
"sale" or "sharing" of personal information. We do not sell your personal
information and do not share it for cross-context behavioral advertising. To
exercise these rights, email support@scholr.dev; we will verify your request as
required by law, you may use an authorized agent, and we will not discriminate
against you for exercising your rights.

## 10. International users
Scholr is operated from the United States. If you access the Service from
outside the U.S., you understand your information will be processed in the U.S.
and other countries where our service providers operate, which may have
different data protection laws than your own.

## 11. Changes to this Policy
We may update this Policy from time to time. If we make material changes, we
will update the "Last updated" date and, where appropriate, notify you. Your
continued use of the Service after changes take effect means you accept the
updated Policy.

## 12. Contact us
Questions about this Policy or your data? Email support@scholr.dev.`,

  terms: `# Terms of Service

Effective date: June 2, 2026

Last updated: June 2, 2026

Terms version: 2026-06-02

These Terms of Service ("Terms") are a binding agreement between you and Scholr
("Scholr," "we," "us," or "our") governing your use of the website at scholr.dev
and related study tools (the "Service"). By creating an account or using the
Service, you agree to these Terms and to our Privacy Policy. If you do not agree,
do not use the Service.

Scholr is an independent educational technology platform and is not affiliated
with, endorsed by, or sponsored by any school, university, school district,
testing or admissions organization, or other educational institution unless
expressly stated. When you create an account, we record your acceptance of these
Terms and the Privacy Policy, including the versions accepted and the date.

## 1. Eligibility and minors
You must be at least 13 years old to use Scholr. If you are between 13 and 18 (or
the age of majority where you live), you may use the Service only with the
consent and supervision of a parent or legal guardian who agrees to these Terms
on your behalf and accepts responsibility for your use of the Service. By using
the Service, you represent that you meet these requirements.

## 2. Your account
You are responsible for activity that happens under your account and for keeping
your sign-in access secure. You agree to provide accurate information and to
notify us promptly of any unauthorized use of your account. We may suspend or
terminate accounts that violate these Terms.

## 3. The Service
Scholr provides AI-assisted study tools, including features that generate text,
audio, summaries, explanations, practice material, and feedback based on content
you provide. The Service is provided for personal, educational use only. We may
add, change, or remove features at any time. We may also set usage limits (for
example, limits on AI requests per plan tier) and modify those limits. We may
also suspend, discontinue, restrict, or modify the Service or any feature, in
whole or in part, at any time, with or without notice, and we will not be liable
to you for doing so; we will use reasonable efforts to give notice of material
discontinuations where practical.

## 4. AI features and disclaimer
Please read this section carefully. Scholr's features use artificial
intelligence. AI-generated output may be inaccurate, incomplete, or misleading;
should not be relied upon as fact without independent verification; is not
professional advice of any kind (including academic, medical, legal, financial,
or career advice); and is provided for educational support only. You are
responsible for reviewing and verifying any information the Service generates
before relying on it. Scholr is not responsible for academic outcomes, grades,
test results, admissions or eligibility decisions, or any decisions you make
based on AI output, and we do not guarantee any particular grade, score, or
academic or admissions result. AI features are a
study aid, not a substitute for your own learning, judgment, or verification.

## 5. User Content
You own your content. You retain all rights to the notes, documents, and other
material you upload or create ("User Content"). You grant Scholr a limited
license to host, store, process, transmit, and display your User Content solely
as needed to operate and provide the Service to you — including transmitting
relevant content to our AI processors (Anthropic and OpenAI) to generate the
results you request, as described in our Privacy Policy. You are responsible for
your User Content. You represent that you have the rights to upload and use it,
and that doing so does not violate any law or third-party rights (including
copyright). You must not upload content you do not have the right to use.

AI-generated outputs. To the extent Scholr holds any rights in the outputs the
Service generates specifically for you (such as answers, summaries, practice
materials, or audio overviews), Scholr assigns those rights to you, subject to
your compliance with these Terms. You are responsible for how you use AI outputs,
which are provided subject to the disclaimer in Section 4. Because AI outputs are
generated from patterns in data, comparable outputs may be produced for other
users, and we make no claim of exclusivity in non-original outputs.

## 6. Acceptable use
You agree not to: use the Service for any unlawful purpose or to upload unlawful
content; upload or share content you do not have the right to upload, including
copyrighted material such as textbooks, test-prep books, or media you do not own
or have permission to use; upload malware, or attempt to disrupt, overload, or
compromise the Service or its security; reverse engineer, decompile, scrape, or
attempt to extract the source code or underlying models of the Service, except
where such restriction is prohibited by law; resell, sublicense, or commercially
exploit the Service without our permission; use the Service to harass, abuse, or
harm others; or attempt to manipulate or abuse AI features to generate harmful,
infringing, or prohibited content, or to circumvent usage limits. We may remove
content or suspend or terminate access for violations. You also agree not to use
the Service in violation of applicable export-control, sanctions, or trade laws;
you represent that you are not located in, and will not use the Service on behalf
of anyone in, a region subject to comprehensive sanctions, and that you are not
on any government restricted-party or denied-party list.

## 7. Subscriptions, billing, and refunds
Scholr offers a free tier and one or more paid subscription tiers ("Pro").
Current pricing and plan features are shown at checkout. Billing: paid plans are
billed in advance on a recurring basis (for example, monthly) through our
payment processor, Stripe. By subscribing, you authorize recurring charges until
you cancel. Cancellation: you may cancel at any time. When you cancel, your paid
features remain active through the end of the current billing period, and you
will not be charged for the following period. We do not provide prorated refunds
for partial periods unless required by law. Refunds: if you are unhappy with a
paid plan, you may request a refund of your most recent payment within 7 days of
that charge by contacting support@scholr.dev. Renewal charges after the first
payment are non-refundable except where required by law. Price changes: we may
change pricing. If we change the price of your subscription, we will give you
advance notice, and the new price will apply to your next billing period.
Continued use after the change means you accept the new price. Taxes: prices may
not include applicable taxes, which may be added.

## 8. Intellectual property
The Service itself — including its software, design, branding, and content we
create (but excluding your User Content) — is owned by Scholr and protected by
intellectual property laws. We grant you a limited, non-exclusive,
non-transferable license to use the Service in accordance with these Terms. All
rights not expressly granted are reserved.

## 9. Copyright complaints (DMCA)
We respond to notices of alleged copyright infringement. See our Copyright /
DMCA Policy for how to submit a complaint and our repeat-infringer policy.

## 10. Termination
You may stop using the Service and delete your account at any time. We may
suspend or terminate your access if you violate these Terms, if required by law,
or if necessary to protect the Service or other users. Sections that by their
nature should survive termination (such as ownership, disclaimers, limitation of
liability, and dispute terms) will survive.

## 11. Disclaimer of warranties
THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY
KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AND
NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
ERROR-FREE, SECURE, OR THAT AI OUTPUTS WILL BE ACCURATE OR RELIABLE.

## 12. Limitation of liability
TO THE MAXIMUM EXTENT PERMITTED BY LAW, SCHOLR AND ITS OPERATORS WILL NOT BE
LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
DAMAGES, OR ANY LOSS OF DATA, PROFITS, OR ACADEMIC OUTCOMES, ARISING FROM OR
RELATED TO YOUR USE OF THE SERVICE. TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR
TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED THE
GREATER OF (A) THE AMOUNT YOU PAID US IN THE 12 MONTHS BEFORE THE CLAIM, OR
(B) USD $50. Some jurisdictions do not allow certain limitations, so some of the
above may not apply to you.

## 13. Indemnification
You agree to indemnify and hold harmless Scholr and its operators from claims,
damages, and expenses (including reasonable legal fees) arising from your User
Content, your use of the Service, or your violation of these Terms or applicable
law.

## 14. Governing law and disputes
These Terms are governed by the laws of the State of North Carolina, without
regard to its conflict-of-laws rules. You agree that the state and federal
courts located in North Carolina will have exclusive jurisdiction over any
disputes arising from these Terms or the Service.

## 15. Force majeure
We are not liable for any delay or failure to perform caused by events beyond our
reasonable control, including acts of God, natural disasters, war, terrorism,
civil unrest, labor disputes, government actions, power or network failures, and
outages or failures of third-party hosting, infrastructure, payment, email, or AI
providers on which the Service depends.

## 16. Changes to these Terms
We may update these Terms from time to time. If we make material changes, we
will update the "Last updated" date and, where appropriate, notify you. Your
continued use of the Service after changes take effect means you accept the
updated Terms.

## 17. Contact
Questions about these Terms? Email support@scholr.dev.`,

  copyright: `# Copyright / DMCA Policy

Effective date: June 2, 2026

Last updated: June 2, 2026

Policy version: 2026-06-02

Scholr ("we," "us," or "our") respects the intellectual property rights of
others and expects users of scholr.dev and our study tools (the "Service") to do
the same. This policy explains how to report content you believe infringes your
copyright and describes our policy toward repeat infringers. Scholr lets users
upload their own study material. Users are solely responsible for the content
they upload and must not upload material they do not own or have permission to
use (including textbooks, test-prep books, or other copyrighted works).

## Reporting alleged copyright infringement
If you believe content on Scholr infringes your copyright, send a written notice
to support@scholr.dev that includes: (1) your physical or electronic signature;
(2) identification of the copyrighted work you claim has been infringed;
(3) identification of the material you claim is infringing and information
reasonably sufficient to let us locate it (for example, a description and URL);
(4) your contact information (name, address, telephone number, and email);
(5) a statement that you have a good-faith belief that the use is not authorized
by the copyright owner, its agent, or the law; and (6) a statement, made under
penalty of perjury, that the information in your notice is accurate and that you
are the copyright owner or authorized to act on the owner's behalf. We may
remove or disable access to content that is the subject of a valid notice. Upon
receiving a notice, we may, in our discretion, review and investigate the claim,
remove or disable access to the material, notify the user who posted it, and take
other action we consider appropriate. Submitting a notice does not guarantee any
particular outcome.

## Counter-notice
If you believe your content was removed or disabled by mistake or
misidentification, you may send a counter-notice to support@scholr.dev that
includes: (1) your physical or electronic signature; (2) identification of the
material that was removed and the location where it appeared before removal;
(3) a statement, under penalty of perjury, that you have a good-faith belief the
material was removed as a result of mistake or misidentification; and (4) your
name, address, and telephone number, and a statement that you consent to the
jurisdiction of the appropriate court and will accept service of process from
the party who filed the original notice. We may restore the removed content as
permitted by applicable law.

Misrepresentations. Under 17 U.S.C. § 512(f), any person who knowingly
materially misrepresents that material is infringing, or that material was
removed or disabled by mistake or misidentification, may be liable for damages.
Do not submit knowingly false notices or counter-notices.

Records. We may preserve and retain copies of notices, counter-notices, the
material at issue, and related investigation records for legal, compliance, and
enforcement purposes, and may share them as required by law (for example, with
the party who submitted the corresponding notice).

## Repeat infringers
We will, in appropriate circumstances and at our discretion, disable access to
content and suspend or terminate the accounts of users who are repeat infringers
— including users who are the subject of more than one valid or unrebutted
infringement notice, or who repeatedly upload material they do not have the right
to use. Termination may occur without prior notice.

## Designated copyright agent
Send copyright notices and counter-notices to our designated agent:

Scholr — Copyright Agent
Email: support@scholr.dev

## Other intellectual property
This policy addresses copyright claims under the DMCA. For other
intellectual-property concerns (such as trademark) or other complaints about
content, email support@scholr.dev.

## Contact
For copyright matters, email support@scholr.dev.`,
};

export default function LegalPage({ page }) {
  const body = DOCS[page];
  if (!body) return null; // App only renders valid pages; safe no-op fallback
  return (
    <div style={{ minHeight: "100svh", background: "var(--bg)", fontFamily: FONT }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "clamp(24px, 5vw, 48px) 20px 56px" }}>
        <a
          href="/"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            textDecoration: "none", marginBottom: 32,
            fontFamily: FONT, fontSize: 18, fontWeight: 700,
            color: "var(--text-primary)", letterSpacing: "-0.03em",
          }}
        >
          <img src="/scholr-logo-final.png" alt="scholr" style={{ width: 28, height: 28, borderRadius: 7, objectFit: "cover" }} />
          {/* One span = one flex item → gap:8 doesn't split "schol" from "r" */}
          <span style={{ letterSpacing: "-0.03em" }}>schol<span style={{ color: "var(--accent)" }}>r</span></span>
        </a>
        <article>{renderDoc(body)}</article>
        <LegalFooter />
      </div>
    </div>
  );
}
