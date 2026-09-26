import { useState } from "react";
import { Check } from "lucide-react";
import { FONT, FONT_HEADING } from "../../lib/theme.js";
import { worksheetToText, looksLikeReadout } from "../../lib/worksheetText.js";
import { FunctionGraph } from "../../ui/FunctionGraph.jsx";

/* Renders a Forge worksheet: numbered worked problems, each with its steps,
 * an optional real plotted graph, and a highlighted final answer.
 *
 * The one thing worth explaining is the typography, because it's a
 * deliberate departure from Forge's other outputs, which are all plain
 * `white-space: pre-wrap` prose. A worked problem is closer to a textbook
 * page than to a paragraph: the statement is set in Newsreader (the app's
 * display serif) because that's what a problem is — a piece of text meant to
 * be read once and referred back to — while a step's LABEL ("Amplitude")
 * stays in the UI sans and its VALUE ("2") goes in var(--mono). That mono
 * split isn't decorative: CLAUDE.md's own rule is that mono is for numbers
 * you measure, not for words, and a step's value is exactly that.
 */
export function WorksheetView({ worksheet }) {
  const [copied, setCopied] = useState(false);
  const problems = Array.isArray(worksheet?.problems) ? worksheet.problems : [];

  function handleCopy() {
    navigator.clipboard.writeText(worksheetToText(worksheet)).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }
  function handleDownload() {
    const blob = new Blob([worksheetToText(worksheet)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${worksheet?.title || "Worksheet"}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  if (!problems.length) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: 200, color: "var(--t3)", fontFamily: FONT, fontSize: 13,
      }}>
        Nothing to show — try generating again.
      </div>
    );
  }

  return (
    <>
      <div style={{
        flex: 1, overflowY: "auto", minHeight: 240,
        background: "var(--s1)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "18px 20px",
      }}>
        {worksheet.title && (
          <div style={{
            fontFamily: FONT_HEADING, fontWeight: 600, fontSize: 19,
            color: "var(--t1)", letterSpacing: "-0.015em", marginBottom: 16,
          }}>{worksheet.title}</div>
        )}

        {problems.map((p, i) => (
          <article key={i} style={{
            padding: i === 0 ? "0 0 22px" : "20px 0",
            borderTop: i === 0 ? "none" : "1px dashed var(--border)",
          }}>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
              <span style={{
                fontFamily: FONT_HEADING, fontWeight: 700, fontSize: 16,
                color: "var(--accent)", minWidth: "1.6em", flexShrink: 0,
              }}>{i + 1}.</span>
              <p style={{
                margin: 0, fontFamily: FONT_HEADING, fontSize: 16.5,
                lineHeight: 1.45, color: "var(--t1)", letterSpacing: "-0.005em",
              }}>{p.statement}</p>
            </div>

            {Array.isArray(p.steps) && p.steps.length > 0 && (
              <dl style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: "8px 20px", margin: "12px 0 0 0", paddingLeft: "2.6em",
              }}>
                {p.steps.map((s, j) => {
                  // Mono is for what you measure, not for words (CLAUDE.md's own
                  // rule) — and a real generation put a full sentence of reasoning
                  // in a step value despite the prompt asking for a short result,
                  // which wraps badly in a monospace face built for numbers. Fall
                  // back to the reading font whenever a value doesn't look like
                  // the short readout it's supposed to be.
                  const readout = looksLikeReadout(s.value);
                  return (
                    <div key={j} style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 5 }}>
                      <dt style={{ fontSize: 11, color: "var(--t3)", fontFamily: FONT }}>{s.label}</dt>
                      <dd style={{
                        margin: 0, fontSize: readout ? 13.5 : 13, color: "var(--t1)",
                        fontFamily: readout ? "var(--mono)" : FONT,
                        fontVariantNumeric: readout ? "tabular-nums" : undefined,
                        lineHeight: readout ? undefined : 1.4,
                      }}>{s.value}</dd>
                    </div>
                  );
                })}
              </dl>
            )}

            {p.graph && (
              <div style={{ paddingLeft: "2.6em" }}>
                <FunctionGraph spec={p.graph} />
              </div>
            )}

            {p.answer && (
              <div style={{
                margin: "10px 0 0 0", paddingLeft: "2.6em",
                fontFamily: FONT_HEADING, fontSize: 14.5, lineHeight: 1.5,
              }}>
                <span style={{
                  background: "var(--acc-bg)",
                  color: "var(--t1)",
                  padding: "2px 8px",
                  borderRadius: "3px 10px 6px 11px", // a hand-marked shape, not a uniform pill
                  boxDecorationBreak: "clone",
                  WebkitBoxDecorationBreak: "clone",
                }}>{p.answer}</span>
              </div>
            )}
          </article>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={handleCopy} className="btn-press" style={{
          flex: 1, background: copied ? "rgba(52,211,153,0.1)" : "var(--s1)",
          border: `1px solid ${copied ? "rgba(52,211,153,0.3)" : "var(--border)"}`,
          borderRadius: 10, height: 36,
          color: copied ? "#34D399" : "var(--t2)",
          fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          letterSpacing: "-0.005em",
        }}>{copied ? <><Check size={13} strokeWidth={2} /> Copied</> : "Copy"}</button>
        <button onClick={handleDownload} className="btn-press" style={{
          flex: 1, background: "var(--s1)", border: "1px solid var(--border)",
          borderRadius: 10, height: 36, color: "var(--t2)", fontSize: 12, fontWeight: 600,
          cursor: "pointer", fontFamily: FONT,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          letterSpacing: "-0.005em",
        }}>Download</button>
      </div>
    </>
  );
}
