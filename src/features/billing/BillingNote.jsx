import { FONT } from "../../lib/theme.js";

// What someone is agreeing to when they pay, in the words of Terms §7. One
// component so every place that sells a plan says the same thing, and so it
// sits beside the buy button instead of in a footer: card networks and Apple
// both expect renewal, cancellation and the legal links to be visible there.
// `lead` is an optional price sentence (leave it off where the price is already
// on screen); `consent={false}` drops "By continuing…" for
// places that don't take payment (the landing page's pricing section).
export function BillingNote({ lead, consent = true, align = "center", style }) {
  const link = { color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 };
  const a = (href, label) => <a href={href} target="_blank" rel="noopener noreferrer" style={link}>{label}</a>;
  return (
    <p style={{ margin: "0 0 12px", fontSize: 12.5, lineHeight: 1.5, color: "var(--text-secondary)", fontFamily: FONT, textAlign: align, ...style }}>
      {lead ? `${lead} ` : ""}Renews every month until you cancel. Cancel any time in Settings and keep access until the period you paid for ends.{" "}
      {consent ? <>By continuing you agree to the {a("/terms", "Terms")} and {a("/privacy", "Privacy Policy")}.</> : <>See the {a("/terms", "Terms")} and {a("/privacy", "Privacy Policy")}.</>}
    </p>
  );
}
