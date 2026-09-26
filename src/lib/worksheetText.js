/* Renders a worksheet's structured data as plain text — for Copy and Download,
 * where the raw JSON that's actually stored would be useless to a student.
 * Graphs can't survive into a .txt file, so a problem that has one gets a
 * short note instead of silently dropping the fact that a graph existed.
 */
/* Does this step value read as a short computed result rather than a
 * sentence of explanation? The worksheet prompt asks the model for exactly
 * the former ("2", "π/2", "sin x = 1/2") and a real generation still
 * returned full-sentence reasoning in a step value despite that — so the
 * renderer decides for itself whether to use var(--mono), which is built for
 * short readouts and wraps a genuine sentence badly, rather than trusting the
 * model to have followed the prompt.
 *
 * The 40-character cap is what actually separates the two — a real
 * generation produced "A = 2, B = 1, D = 5" (naming three coefficients at
 * once, 9 whitespace-separated tokens but 19 characters) alongside genuine
 * prose ("The amplitude is the coefficient A, which here is 2.", 54
 * characters), so a low word-count cap would have rejected the first
 * alongside the second. The word cap stays as a secondary net (loose enough
 * not to catch that case, tight enough that a real sentence — which is also
 * long in characters — still fails on word count too) rather than the
 * primary signal. */
export function looksLikeReadout(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 40) return false;
  return trimmed.split(/\s+/).filter(Boolean).length <= 12;
}

export function worksheetToText(worksheet) {
  if (!worksheet || !Array.isArray(worksheet.problems)) return "";
  const lines = [];
  if (worksheet.title) lines.push(worksheet.title, "");

  worksheet.problems.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.statement ?? ""}`);
    for (const step of Array.isArray(p.steps) ? p.steps : []) {
      if (!step?.label) continue;
      lines.push(`   ${step.label}: ${step.value ?? ""}`);
    }
    if (p.graph) lines.push("   (graph shown in the app)");
    if (p.answer) lines.push(`   Answer: ${p.answer}`);
    lines.push("");
  });

  return lines.join("\n").trimEnd() + "\n";
}
