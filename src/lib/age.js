// Whole years from a YYYY-MM-DD birthdate (what <input type="date"> gives) to
// today; NaN when it isn't a real past date. A convenience for instant form
// feedback — server/lib/signup.js holds the check that counts.
//
// Plain year/month/day numbers on purpose: new Date("YYYY-MM-DD") is UTC
// midnight, which reads as the day before anywhere west of UTC, so a birthday
// used to count a year short.
export function ageFromDob(dateOfBirth, now = new Date()) {
  const match = typeof dateOfBirth === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth.trim());
  if (!match) return NaN;
  const [y, m, d] = match.slice(1).map(Number);
  const check = new Date(y, m - 1, d);
  if (check.getMonth() !== m - 1 || check.getDate() !== d || check > now) return NaN;
  let age = now.getFullYear() - y;
  const dm = now.getMonth() + 1 - m;
  if (dm < 0 || (dm === 0 && now.getDate() < d)) age--;
  return age;
}
