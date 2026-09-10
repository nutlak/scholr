import { useEffect, useState } from "react";
import { api } from "../../api.js";
import { CheckCircle } from "lucide-react";
import { Avatar } from "../../ui/Avatar.jsx";
import { FONT, FONT_HEADING } from "../../lib/theme.js";

export function InviteModal({ notebookId, onClose }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [friends, setFriends] = useState([]);
  const [friendState, setFriendState] = useState({}); // userId → 'busy' | 'done' | 'error'

  useEffect(() => {
    let cancelled = false;
    api.getFriends()
      .then(rows => { if (!cancelled) setFriends(rows ?? []); })
      .catch(() => { /* friends section just stays hidden on error */ });
    return () => { cancelled = true; };
  }, []);

  async function addFriend(friendUserId) {
    setFriendState(s => ({ ...s, [friendUserId]: "busy" }));
    try {
      await api.inviteFriendToNotebook(notebookId, friendUserId);
      setFriendState(s => ({ ...s, [friendUserId]: "done" }));
    } catch {
      setFriendState(s => ({ ...s, [friendUserId]: "error" }));
    }
  }

  async function handleSend() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address."); return;
    }
    setStatus("sending"); setError("");
    try {
      await api.createInvite(notebookId, trimmed);
      setSentTo(trimmed);
      setStatus("success");
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(err.message || "Failed to send invite.");
      setStatus("error");
    }
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
      backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        position: "relative",
        background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
        border: "1px solid var(--border)",
        borderRadius: 18, width: "100%", maxWidth: 440,
        padding: "28px 26px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px var(--acc-bg)",
        animation: "fadeIn 0.2s ease", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -100, right: -60,
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--t1)", fontFamily: FONT_HEADING, marginBottom: 5, letterSpacing: "-0.02em" }}>Invite a collaborator</div>
            <div style={{ fontSize: 13, color: "var(--t2)", fontFamily: FONT, lineHeight: 1.55 }}>They'll get an email with a link to join this unit</div>
          </div>

          {status === "success" ? (
            <div style={{ textAlign: "center", padding: "24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(52,211,153,0.18) 0%, rgba(52,211,153,0.06) 100%)",
                border: "1.5px solid rgba(52,211,153,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--success)",
                boxShadow: "0 0 24px rgba(52,211,153,0.2)",
              }}><CheckCircle size={28} strokeWidth={1.75} /></div>
              <div style={{ fontSize: 15, color: "#34D399", fontFamily: FONT, fontWeight: 600, letterSpacing: "-0.015em" }}>
                Invite sent to {sentTo}!
              </div>
            </div>
          ) : (
            <>
              <input
                type="email"
                placeholder="friend@school.edu"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(""); setStatus("idle"); }}
                onKeyDown={e => e.key === "Enter" && handleSend()}
                autoFocus
                style={{
                  width: "100%", background: "var(--s1)",
                  border: `1px solid ${error ? "rgba(248,113,113,0.45)" : "var(--border)"}`,
                  borderRadius: 10, padding: "0 14px", height: 42, color: "var(--t1)",
                  fontSize: 14, fontFamily: FONT,
                  outline: "none", marginBottom: 10,
                  transition: "all 0.18s", letterSpacing: "-0.01em",
                }}
                onFocus={e => { if (!error) { e.target.style.borderColor = "var(--acc)"; e.target.style.boxShadow = "0 0 0 3px var(--acc-bg-h)"; }}}
                onBlur={e => { if (!error) { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}}
              />
              {error && (
                <div style={{ fontSize: 12.5, color: "#F87171", fontFamily: FONT, marginBottom: 10 }}>{error}</div>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={onClose} className="btn-press" style={{
                  background: "transparent", border: "1px solid var(--border-h)",
                  borderRadius: 10, padding: "0 16px", height: 38,
                  color: "var(--t2)", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", fontFamily: FONT, letterSpacing: "-0.01em",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t2)"; }}
                >Cancel</button>
                <button
                  onClick={handleSend}
                  disabled={status === "sending"}
                  className="btn-press"
                  style={{
                    background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
                    border: "none", borderRadius: 10,
                    padding: "0 20px", height: 38, color: "#fff", fontWeight: 600, fontSize: 13,
                    cursor: status === "sending" ? "not-allowed" : "pointer",
                    fontFamily: FONT, opacity: status === "sending" ? 0.65 : 1,
                    boxShadow: "0 4px 14px rgba(167,139,250,0.34), 0 0 0 1px var(--acc-bg-h)",
                    letterSpacing: "-0.01em",
                  }}
                >{status === "sending" ? "Sending…" : "Send Invite"}</button>
              </div>

              {/* Friends — one-click share with someone you're already friends with */}
              {friends.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
                  }}>
                    <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", fontFamily: FONT, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Or add a friend
                    </span>
                    <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                    {friends.map(f => {
                      const st = friendState[f.userId];
                      const done = st === "done";
                      return (
                        <div key={f.userId} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "7px 9px", borderRadius: 10,
                          background: "var(--s1)", border: "1px solid var(--border)",
                        }}>
                          <Avatar name={f.name} size={26} seed={f.username || f.userId} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                            <div style={{ fontSize: 11, color: "var(--t3)", fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.username ? `@${f.username}` : ""}</div>
                          </div>
                          <button
                            onClick={() => addFriend(f.userId)}
                            disabled={st === "busy" || done}
                            className="btn-press"
                            style={{
                              flexShrink: 0,
                              background: done ? "rgba(52,211,153,0.14)" : "var(--acc-bg)",
                              border: `1px solid ${done ? "rgba(52,211,153,0.32)" : "var(--acc-bg-h)"}`,
                              borderRadius: 8, padding: "6px 12px",
                              color: done ? "#6EE7B7" : "var(--acc-h)",
                              fontWeight: 600, fontSize: 12, fontFamily: FONT,
                              cursor: st === "busy" || done ? "default" : "pointer",
                              opacity: st === "busy" ? 0.7 : 1,
                            }}
                          >
                            {st === "busy" ? "…" : done ? "Added!" : st === "error" ? "Retry" : "Add"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
export function InviteLanding({ inviteInfo, onSignIn }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      backgroundImage: `
        radial-gradient(circle at 20% 0%, var(--acc-bg) 0%, transparent 50%),
        radial-gradient(circle at 80% 100%, rgba(96,165,250,0.08) 0%, transparent 50%)
      `,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 18, padding: 32, fontFamily: FONT,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <img src="/scholr-logo-final.png" alt="scholr" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />
        <div style={{
          fontSize: 28, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.01em",
          fontFamily: FONT_HEADING,
        }}>
          <span>schol<span style={{ color: "var(--acc)" }}>r</span></span>
        </div>
      </div>
      <div style={{ fontSize: 15, color: "var(--t2)", textAlign: "center" }}>
        You've been invited to join a unit
      </div>
      {inviteInfo ? (
        <div style={{
          background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
          border: "1px solid var(--border)",
          borderRadius: 14, padding: "18px 24px", textAlign: "center", maxWidth: 380,
          boxShadow: "0 12px 32px rgba(0,0,0,0.4), 0 0 0 1px var(--acc-bg)",
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)", fontFamily: FONT, marginBottom: 4, letterSpacing: "-0.015em" }}>{inviteInfo.notebook_title}</div>
          {inviteInfo.class_title && <div style={{ fontSize: 12.5, color: "var(--t3)" }}>in {inviteInfo.class_title}</div>}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--t3)" }}>Loading invite info…</div>
      )}
      <div style={{ fontSize: 13, color: "var(--t3)", textAlign: "center" }}>Sign in or create an account to join</div>
      <button
        onClick={onSignIn}
        style={{
          background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
          border: "none", borderRadius: 12,
          padding: "0 24px", height: 44, color: "#fff", fontWeight: 600,
          fontSize: 14, cursor: "pointer", fontFamily: FONT,
          transition: "transform 0.15s, box-shadow 0.2s",
          boxShadow: "0 8px 24px var(--acc-bg-h), 0 0 0 1px color-mix(in srgb, var(--acc) 45%, transparent)",
          letterSpacing: "-0.01em",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
      >Sign in or create account</button>
    </div>
  );
}
