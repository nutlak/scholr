// What the weekly recap would do right now. DRY RUN ONLY: reads the database,
// prints who qualifies and what each email would say, sends nothing.
// Run: npm run recap
import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env", import.meta.url) });
const { planRecaps } = await import("../lib/recap.js");

const mask = (e) => e.replace(/^(.).*(@.*)$/, "$1***$2");
const plan = await planRecaps();
console.log(`\nWeekly recap, dry run: ${plan.length} would be sent\n`);
for (const r of plan) {
  const d = r.data;
  console.log(`${mask(r.email).padEnd(28)} studied ${d.daysStudied}d, ${d.friendsStudied} friends studied, ${d.due.length} due, ${d.sessions.length} sessions`);
}
console.log("");
