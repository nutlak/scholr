# scholr: notes for any coding agent

`CLAUDE.md` is the full guide (stack, design language, conventions, how to verify).
Read it before changing anything. This file is only the rules that cost real
money, real email or real data if you miss them.

## Hard rules

1. **`server/.env` holds production credentials** (live Supabase and Resend;
   Stripe is test mode). Anything you write locally lands in the real database.
2. **Never start the API without `DISABLE_WORKERS=1`.** The workers email real
   students. Call worker functions directly in tests; never boot them.
3. **Never call a mailer** (`sendRecapEmail`, `sendOtpEmail`, `sendInviteEmail`,
   `sendOnboardingEmail`, `processPendingEmails`, `sendWeeklyRecaps`) against real
   users. `npm run recap` is a dry run and is safe.
4. **Test with throwaway users** whose email starts `brain-e2e-`, and delete them
   when you finish. Look at `auth.users` before and after.
5. **No schema changes from code.** This server can't run DDL. Write a migration
   in the repo-root `migrations/` folder (next number: 043) and hand it to a person to run.
6. **Authorization lives in application code** (the service-role client skips
   RLS). A route that takes a resource id needs its own ownership check.

## Before you say it's done

```
npx vite build
npx eslint src server     # 0 errors; 14 warnings are expected
npm test
```

Then exercise the feature for real (an actual request, or the signed-in UI).
A green build has missed payment bugs here before.

## Product rules that are easy to break

- Friends are the thesis: the dashboard leads with the friends row. Don't demote it.
- Plain and legible beats pretty ("simple enough for an 83-year-old"). No orange
  or brown-amber. Never redraw the logo. Accent colour marks what can be pressed.
- A change to a feature, a limit or a price updates the landing page in the same pass.
- A new kind of email, push or collected data updates the privacy policy
  (`src/LegalPages.jsx`) in the same pass.
