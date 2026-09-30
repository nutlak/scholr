import { Component } from "react";
import { FONT, FONT_HEADING } from "../lib/theme.js";
import { reportClientError } from "../lib/reportError.js";

/* The last line of defence.
 *
 * React 19 unmounts the entire tree when a render throws and nothing catches
 * it, so before this existed one bad render anywhere in the app produced a
 * blank white page: no message, no way back, and no record that it happened.
 * For someone who opened scholr the night before an exam that is the worst
 * failure the app can produce, and it was also completely invisible — the
 * error went to a console nobody was reading.
 *
 * This does the two things that matter: keep a person in the product, and make
 * sure the failure is known about. It deliberately does NOT try to render the
 * broken subtree again on its own — repeated automatic retries of a render that
 * throws deterministically just flicker.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportClientError(error, { kind: "render", componentStack: info?.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{
        minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-base, #0B0B0C)", color: "var(--t1, #F0EDE7)",
        padding: 24, fontFamily: FONT,
      }}>
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <div style={{
            fontFamily: FONT_HEADING, fontSize: 26, fontWeight: 600,
            letterSpacing: "-0.02em", marginBottom: 10,
          }}>
            Something broke on this screen
          </div>
          <p style={{
            fontSize: 14.5, lineHeight: 1.6, color: "var(--t2, rgba(240,237,231,0.76))",
            margin: "0 0 22px",
          }}>
            Your notes are safe — this is a display problem, not a data one.
            Reloading usually clears it.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                height: 44, padding: "0 20px", borderRadius: 10, border: "none", cursor: "pointer",
                background: "var(--acc, #A78BFA)", color: "var(--on-acc, #14121A)",
                fontFamily: FONT, fontSize: 14, fontWeight: 600,
              }}
            >Reload</button>
            <button
              onClick={() => { window.location.href = "/app"; }}
              style={{
                height: 44, padding: "0 20px", borderRadius: 10, cursor: "pointer",
                background: "transparent", border: "1px solid var(--border, rgba(240,237,231,0.10))",
                color: "var(--t2, rgba(240,237,231,0.76))",
                fontFamily: FONT, fontSize: 14, fontWeight: 600,
              }}
            >Back to dashboard</button>
          </div>

          {/* The message, not the stack: enough for someone to tell support what
              they saw, without a wall of minified frames. */}
          {this.state.error?.message && (
            <p style={{
              marginTop: 22, fontSize: 12, fontFamily: "var(--mono)",
              color: "var(--t3, rgba(240,237,231,0.56))", wordBreak: "break-word",
            }}>{String(this.state.error.message).slice(0, 200)}</p>
          )}
        </div>
      </div>
    );
  }
}
