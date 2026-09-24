// The Settings pane: account, subscription, referrals, notifications,
// appearance and the danger zone. Lifted out of Scholr() unchanged — the
// eleven props are exactly the state it already read from that closure.
import { PushToggle } from "../notifications/PushToggle.jsx";
import { ReferralSection } from "../referrals/ReferralSection.jsx";
import { SquadSection } from "../squad/SquadSection.jsx";
import { ACCENT_PRESETS, FONT } from "../../lib/theme.js";
import { Avatar } from "../../ui/Avatar.jsx";
import { Moon, Sun } from "lucide-react";
import { useServerFeature } from "../../lib/useServerFeature.js";

export function SettingsView({ accentColor, displayName, handleManageSubscription, portalLoading, setAccentColor, setShowDeleteAccount, setTheme, setUpgradeModal, subscription, theme, user }) {
  // Billing needs Stripe configured server-side. Without this the Manage
  // subscription button looks live and dies on click — which is the exact
  // problem SquadSection already solved for Squad, and the reason /api/health
  // reports a features block at all. It shows up on any environment without
  // Stripe keys, which is every local one: they live only on Railway.
  const billingReady = useServerFeature("pro");
  return (
              <div className="settings-pane" style={{ animation: "fadeIn 0.25s ease", maxWidth: 800, margin: "0 auto", width: "100%" }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT, letterSpacing: "-0.025em", marginBottom: 32 }}>
                  Settings
                </div>

                <div className="ins-caption">Account</div>
                <div className="ins-group">
                <div className="ins-row" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <Avatar name={displayName} size={42} seed={user?.email ?? displayName} />
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT, marginBottom: 3, fontWeight: 500 }}>Signed in as</div>
                    <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600, fontFamily: FONT, letterSpacing: "-0.01em" }}>{user?.email}</div>
                  </div>
                </div>
                </div>

                {/* ── Subscription ──────────────────────────────────────────── */}
                <div className="ins-caption">Subscription</div>
                {/* Pro tints the whole group rather than a card inside a card —
                    two nested rounded surfaces was the thing that read as
                    stacked chrome. */}
                <div className="ins-group"
                     style={subscription.tier === "pro" ? { background: "var(--accent-soft)" } : undefined}>
                <div className="ins-row">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 220px", minWidth: 200 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        {subscription.tier === "pro" && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                            color: subscription.cancelAtPeriodEnd ? "var(--warning)" : "var(--on-acc)",
                            fontFamily: FONT,
                            background: subscription.cancelAtPeriodEnd
                              ? "color-mix(in srgb, var(--warning) 16%, transparent)"
                              : "var(--acc)",
                            border: subscription.cancelAtPeriodEnd
                              ? "1px solid color-mix(in srgb, var(--warning) 38%, transparent)"
                              : "none",
                            padding: "2px 8px", borderRadius: 999,
                          }}>
                            {subscription.cancelAtPeriodEnd ? "Cancelling" : "Active"}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 17, fontWeight: 600,
                        color: "var(--text-primary)",
                        fontFamily: FONT, letterSpacing: "-0.02em", marginBottom: 4,
                      }}>
                        {subscription.tier === "pro" ? (
                          <>scholr <span style={{ color: "var(--accent)" }}>Pro</span> · <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)" }}>$8.49/month</span></>
                        ) : "scholr Free"}
                      </div>
                      {subscription.tier === "pro" && subscription.currentPeriodEnd && (
                        // "Next billing" on a cancelled subscription is a lie —
                        // nothing bills, it ends. Same date, opposite meaning.
                        <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT, lineHeight: 1.5 }}>
                          {subscription.cancelAtPeriodEnd ? "Pro ends on " : "Next billing on "}
                          {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                          {subscription.cancelAtPeriodEnd && " — you keep Pro until then."}
                        </div>
                      )}
                      {subscription.tier !== "pro" && (
                        <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT, lineHeight: 1.5 }}>
                          Upgrade for unlimited messages, Forge, classes, and storage.
                        </div>
                      )}
                    </div>
                    {subscription.tier === "pro" && !billingReady ? (
                      <div style={{
                        fontSize: 12.5, color: "var(--text-tertiary)", fontFamily: FONT,
                        lineHeight: 1.5, maxWidth: 220, flexShrink: 0,
                      }}>
                        Billing isn't available in this environment.
                      </div>
                    ) : subscription.tier === "pro" ? (
                      <button
                        onClick={handleManageSubscription}
                        disabled={portalLoading}
                        className="btn-press"
                        style={{
                          background: "transparent",
                          border: "1px solid color-mix(in srgb, var(--acc) 45%, transparent)",
                          borderRadius: 10, padding: "0 16px", height: 38,
                          color: "var(--acc)",
                          fontSize: 13, fontWeight: 600,
                          cursor: portalLoading ? "wait" : "pointer",
                          fontFamily: FONT, whiteSpace: "nowrap", flexShrink: 0,
                          letterSpacing: "-0.01em",
                          opacity: portalLoading ? 0.7 : 1,
                          transition: "all 0.18s",
                        }}
                        onMouseEnter={e => { if (!portalLoading) { e.currentTarget.style.background = "var(--acc-bg)"; e.currentTarget.style.borderColor = "color-mix(in srgb, var(--acc) 70%, transparent)"; }}}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "color-mix(in srgb, var(--acc) 45%, transparent)"; }}
                      >
                        {portalLoading ? "Opening…" : "Manage subscription"}
                      </button>
                    ) : (
                      <button
                        onClick={() => setUpgradeModal({ limitType: "upgrade" })}
                        className="btn-press"
                        style={{
                          background: "var(--acc)",
                          border: "none",
                          borderRadius: 10, padding: "0 18px", height: 38,
                          color: "var(--on-acc)",
                          fontSize: 13, fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: FONT, whiteSpace: "nowrap", flexShrink: 0,
                          letterSpacing: "-0.01em",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
                          transition: "transform 0.18s, box-shadow 0.18s",
                        }}
                      >
                        Upgrade to Pro
                      </button>
                    )}
                  </div>
                </div>
                </div>

                {/* ── Referrals (1D) ── */}
                <ReferralSection />

                {/* ── Notifications ─────────────────────────────────────────── */}
                <PushToggle />

                <SquadSection />

                {/* ── Appearance ────────────────────────────────────────────── */}
                <div className="ins-caption">Appearance</div>
                <div className="ins-group">

                {/* Theme row */}
                <div className="ins-row" style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 16, flexWrap: "wrap",
                }}>
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", fontFamily: FONT, letterSpacing: "-0.01em" }}>
                      Theme
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT, marginTop: 2 }}>
                      {theme === "light" ? "Light mode" : "Dark mode"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {[
                      { value: "dark", label: "Dark", Icon: Moon },
                      { value: "light", label: "Light", Icon: Sun },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setTheme(opt.value)}
                        style={{
                          minHeight: 44, padding: "0 14px", borderRadius: 10, cursor: "pointer",
                          fontFamily: FONT, fontSize: 13, fontWeight: 500,
                          background: theme === opt.value ? "var(--accent-soft)" : "transparent",
                          border: `1px solid ${theme === opt.value ? "var(--accent)" : "var(--border-default)"}`,
                          color: theme === opt.value ? "var(--accent)" : "var(--text-secondary)",
                          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                          transition: "background 150ms ease, border-color 150ms ease, color 150ms ease",
                        }}
                        onMouseEnter={e => { if (theme !== opt.value) { e.currentTarget.style.background = "var(--bg-surface-2)"; e.currentTarget.style.color = "var(--text-primary)"; }}}
                        onMouseLeave={e => { if (theme !== opt.value) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}}
                      >
                        <opt.Icon size={15} strokeWidth={1.75} /> {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent color row */}
                <div className="ins-row" style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 16, flexWrap: "wrap",
                }}>
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", fontFamily: FONT, letterSpacing: "-0.01em" }}>
                      Accent color
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT, marginTop: 2 }}>
                      {ACCENT_PRESETS.find(p => p.color === accentColor)?.name ?? "Custom"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
                    {ACCENT_PRESETS.map(p => (
                      <button
                        key={p.color}
                        onClick={() => setAccentColor(p.color)}
                        title={p.name}
                        aria-label={`${p.name} accent`}
                        style={{
                          width: 32, height: 32, minWidth: 32, borderRadius: 8, padding: 0, cursor: "pointer",
                          background: `linear-gradient(135deg, ${p.color} 0%, ${p.deep} 100%)`,
                          border: accentColor === p.color ? `2px solid var(--text-primary)` : "2px solid transparent",
                          outline: accentColor === p.color ? `1px solid ${p.color}` : "none",
                          outlineOffset: "1px",
                          transition: "transform 120ms ease",
                          flexShrink: 0,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.12)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                      />
                    ))}
                  </div>
                </div>
                </div>

                {/* Delete account — self-service deletion (satisfies the deletion
                    right + the Privacy Policy/ToS promise that users can delete
                    their account from settings). Backed by DELETE /api/auth/delete-account. */}
                <div className="ins-caption" style={{ color: "rgba(248,113,113,0.75)" }}>Danger zone</div>
                <div className="ins-group" style={{ borderColor: "rgba(248,113,113,0.28)" }}>
                <div className="ins-row" style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT, marginBottom: 3, letterSpacing: "-0.01em" }}>Delete my account</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT, lineHeight: 1.5 }}>Permanently deletes your account, notebooks, notes, and data. This action cannot be undone.</div>
                  </div>
                  <button
                    onClick={() => setShowDeleteAccount(true)}
                    className="btn-press"
                    style={{
                      flexShrink: 0,
                      background: "transparent",
                      border: "1px solid rgba(248,113,113,0.4)",
                      color: "var(--danger)",
                      borderRadius: 10, padding: "0 16px", height: 40,
                      fontFamily: FONT, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                      transition: "background 140ms ease, border-color 140ms ease",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(248,113,113,0.10)"; e.currentTarget.style.borderColor = "var(--danger)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.4)"; }}
                  >Delete account</button>
                </div>
                </div>
              </div>
  );
}
