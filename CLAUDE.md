# scholr

Collaborative study app. React 19 + Vite client, Express + Supabase server.

**The product thesis is friends.** Studying together is the point; solo
features are secondary. The dashboard leads with `FriendsRow` and that
ordering is deliberate — don't demote it.

## Verify before you claim

```
npx vite build          # must succeed
npx eslint src server   # 0 errors; 14 warnings expected (react-hooks/set-state-in-effect on working load-then-poll effects)
npm test                # node --test, no React testing library
```

A green build is not a verified feature. `server/.env` **does** exist (it is
gitignored, so it won't show in a file listing) and the whole app runs locally:

```
cd server && node index.js   # :3001
npm run dev                  # :5173 — must be this port; CORS allows 5173/4173 only
```

Those are **production** credentials — live Supabase, live Resend. Anything
written locally lands in the real database, and `DISABLE_WORKERS=1` must stay
set or booting sends real email to real users. Stripe here is **test mode**
(`sk_test_…` in `server/.env`, and both price ids are test-mode prices at
$8.49 and $24.99 a month, checked against the Stripe API 2026-10-14; this section
used to say Stripe was absent), so `/api/health` reports `pro` and `squad` true
and the billing routes talk to Stripe's test data, never real charges. A real
card is only ever exercised on scholr.dev. Never paste these local price ids
into Railway: production uses the live ones.

So exercise the real thing: hit the endpoints with a real token, or drive the
signed-in UI. Two payment bugs that a green build never caught were found that
way. Say so when something is genuinely unverified — but check before claiming it.

**Driving the signed-in UI.** The sign-in form sits behind Turnstile, so an
automated browser can't use it ("Couldn't confirm you're human"). Instead make a
throwaway user with the service-role key (`email` starting `brain-e2e-`,
`profiles` row with `terms_accepted_at` and `onboarding_completed`), mint a
session (`auth.admin.generateLink({ type: "magiclink" })`, then `verifyOtp({
token_hash })` on an anon client), write the **whole, unedited** session JSON to
`localStorage["sb-<project-ref>-auth-token"]`, and load `/app`. A hand-trimmed
session got revoked on the first attempt. Delete the user afterwards.

**Hooks** (`.claude/settings.json`, scripts in `.claude/hooks/`, active from the
next session): after every `Edit`/`Write` of a `src` or `server` JS/JSX file,
`check-after-edit.sh` lints that file and, for logic files, runs `npm test`;
exit 2 puts the failure in front of Claude (it can't undo the edit). Before
every `Bash`, `guard-production.sh` blocks starting the API without
`DISABLE_WORKERS=1` and blocks calling the mailers directly unless
`ALLOW_REAL_EMAIL=1` (see the production-credentials warning above).

## Styling

Inline styles, driven by CSS custom properties. `style={{ color: "var(--t1)" }}`
is the house pattern — so **editing the `:root` tokens in `src/index.css`
restyles the whole app**, which is almost always the right lever.

Load order is `index.css` → `hud.css` → `App.css` → `surface.css` (the last
two are imported from `App.jsx`, surface last, so it wins ties). `src/hud.css` is now
just layout for the status strip and the phone shell.

Because styles are inline, attribute selectors are how you reach many
components at once — `[style*="var(--card-bg)"]` applies the card chrome
without editing 30 files. Only do this for tokens written consistently.

Watch out: several components declare their own local `const FONT = ...`
rather than importing `src/lib/theme.js`. Font changes must sweep all of them
*and* the `--font-*` tokens.

## Design language

**Layered depth, with handwriting as an accent.** (2026-10-14. The dark violet
"instrument panel" and then a flat hand-drawn "paper" look both came and went;
Noah called the flat one cheap and fake.) The page is a stack of planes —
page `--bg`, chrome `--bg-chrome`, cards `--card-bg`, raised `--s2`/`--s3` —
separated by light, not outlines: every card has a 1px top highlight (`--hi`)
and a soft shadow (`--sh-card`, `--sh-card-h` on hover, `--sh-modal` for
overlays). Filled buttons are top-lit with a coloured shadow (`--acc-glow`).
The content has one light source: a faint accent wash at the top.

**Two themes**, light (`#F2F3F6` page, white cards) and dark (`#0C0D11` page,
`#16181E` cards), both in `index.css`. `useAppearance` holds the choice (device
setting by default, Settings → Theme), `public/theme-boot.js` applies it before
first paint. Accent is the student's choice; **purple is the default** because
it's the logo's colour. No orange or brown-amber anywhere (Noah rejected it).
Never hard-code a colour a component paints: `--paper` for surfaces,
`--ink-blue|green|amber|red|violet|pink|teal` for coloured icons and labels
(each clears 4.5:1 in its theme), `color-mix(in srgb, <colour> N%, transparent)`
for tints, since `${hex}22` breaks on a `var()`.

**`src/surface.css` is the depth layer and loads last** (after App.css). It
reaches inline-styled components by class or by the tokens they write
(`[style*="var(--card-bg)"]`). Don't add `corner-shape` squircles.

**Type:** three faces, each with one job. Newsreader (`FONT_HEADING`,
`FONT_SERIF`, `--font-heading`) for page titles and headings — a quiet book
serif, held at weight 500 by surface.css whatever the inline weight says.
Nunito (`FONT`) for everything structural and read at length: body, buttons,
cards, Derek's answers, PINs, the wordmark. Shantell Sans (`var(--font-hand)`)
is the handwriting layer: section labels (surface.css turns inline uppercase
labels into handwritten notes), the status strip, segmented options, the hero's
"Study together.", accent words in landing titles.
Scales: `--fs-*` with matching `--tr-*`/`--lh-*`, spacing `--sp-1`…`--sp-8`.

**Hand-drawn marks live in `src/ui/Hand.jsx`**: `HandCircle` (a pen loop
around a label or icon — landing badges, feature/step icons, study tiles, empty
states), `HandCheck` (pricing ticks), `HandRule` (wavy divider). They draw in
`currentColor`. `.hand-underline` is the wavy underline (hero, active nav item).
Reuse these rather than drawing new one-offs. Small notes — dates, counts,
due dates, meter labels, stat captions, "here now" — take `className="hand"`
(size via `--hand-size`), and page titles get a `.pen-squiggle` under them.
**Handwriting stays soft**: Shantell Sans ships 400–600 only and
`font-synthesis-weight: none` stops faux bold; labels and notes run at 500.
Kalam was dropped (2026-10-14) for reading harsh and for a "1" that looked
like a slash. Bold sans titles read "sharp" to Noah — Hanken, then even
Nunito — so titles are a serif at book weight. Keep heading tracking near zero.

**The logo is the S-shaped speech bubble with the spark**, rendered by
`src/ui/ScholrMark.jsx` as one element whose image `surface.css` picks by theme:
`public/scholr-mark-{dark,light}.webp` (~1 KB each; the old two-`<img>` version
shipped both 54 KB PNGs for a 34px logo). The PNGs `scholr-logo-*.png` stay for
what can't take WebP: favicon, apple-touch-icon, share cards, push icons
(`public/sw.js`) and email (`server/email.js`). Don't redraw it. The landing hero's sketch (`src/ui/HeroSketch.jsx`: notes → Derek as the
logo's spark → friends) is the one illustration, in theme tokens. No Derek
face or bubble — Noah disliked it; faint ruled lines fade out behind the hero.

**Accent paint means "you can press this."** Buttons, links and the selected
state get `--acc`; a price, a decorative icon, a card border or a number does
not, because a purple box beside a purple button reads as a second button. The
upgrade modal is the first screen brought in line (price in ink, one purple
button). Many older screens still tint figures and borders with the accent
(streak counts, leaderboard "you", the pen squiggle): leave those unless you are
already editing the screen, and never read the rule as a reason to drop purple
from the buttons or the brand marks.

Panels dock to the **right rail** (`ToolModal`), never centre-screen dialogs.
`.shimmer` is the one "waiting" indicator.

Chrome stays quiet, and copy stays plain: the bar is *simple and clean enough
for a 3-year-old or an 83-year-old*. When the aesthetic fights legibility,
legibility wins. Mobile targets are ≥44px and buttons keep their labels — an
icon-only row is a guessing game.

### Interaction

Press feedback is asymmetric: `scale(0.97)` at 0ms going down, 260ms settling
back. A button pushed *into* the surface reads as physical; one nudged down a
pixel reads as a layout shift.

**Named patterns, each with one implementation — reuse them rather than
rebuilding:**

- **Large-title collapse.** The heading is content and scrolls away while the
  compact view title rises into the status strip. Both halves read
  `--pane-scroll` (0→1 over 44px), which `.main-pane`'s scroll handler writes
  to the root element. Deliberately not React state: `Scholr()` holds 57
  `useState` hooks, so a scroll frame that re-renders is a scroll frame that
  drops. A view change must reset it — switching views zeroes `scrollTop`
  without firing a scroll event.
- **Segmented control** (`.seg-control` / `.seg-pill` / `.seg-option`, App.css)
  for any small mutually-exclusive choice. The track is grid with `1fr`
  columns; flex collapses each segment to min-content when the control has no
  free space, and the pill then misses the last one.
- **Grouped inset list** (`.ins-caption` / `.ins-group` / `.ins-row`) for
  settings-shaped screens. Separators sit *between* rows and inset to the
  text's left edge, never full-bleed under each row.
- **Bottom sheets** are draggable via `src/lib/sheetDrag.js`, one delegated
  listener installed from `main.jsx`. A new sheet gets the gesture free by
  rendering `.mobile-sheet` inside `.mobile-sheet-overlay` and dismissing on a
  backdrop click; nothing needs wiring.

Gesture work follows the fluid-interface rules: track 1:1 after ~10px of
hysteresis, continue an interrupted animation from the *presented* value (read
the computed transform, not the style property), project release velocity
forward to decide the outcome and hand that same velocity to the spring,
rubber-band at boundaries. Measure release velocity over the last ~100ms **with
the pointerup included** — without it a finger that stops before lifting still
reads as a flick.

A CSS rule inside a media query has no extra specificity. `.hud-seg` and
`.hud-title` both being single classes is why the phone title rule had to be
`.hud-bar .hud-title`; check the rendered box rather than assuming a media
query wins.

## Features that borrow tables

This server can't run DDL, so some features live in existing tables. Know
which, so nobody "cleans up" a row that is a feature:

- **Study sessions** (`lib/sessions.js`, `routes/sessions.js`) are rows in
  `forge_outputs` with `type` `study_session` (content = JSON `{startsAt, note,
  remindedAt}`) and `study_session_in` (title = session id; one per person
  going). `routes/forge.js` hides both types from saved outputs. Their
  notifications ride on `social_notifications.type = "notebook_invite"` with
  `payload.kind` (`session_planned` / `session_reminder`), because the CHECK
  constraint rejects new types. If this grows, give it real tables.
- **Getting started** (`features/dashboard/GettingStarted.jsx`) derives its
  steps from real data; `notes_filled` (text or a file) is separate from
  `notes_count`, because course templates add empty placeholder notes.

## Scheduled work

Workers start only when `DISABLE_WORKERS` is not `1` (it stays `1` locally: the
local `.env` is production, so a running worker would email real users). Hourly:
onboarding emails, and the **weekly recap** (`lib/recap.js`), which acts only on
Sunday 22:00–23:59 UTC, once per person per 6 days, only if there's something to
say, never to an unsubscribed profile; `WEEKLY_RECAP_DISABLED=1` turns it off.
Every minute: study-session reminders. To see what the recap would do without
sending: `npm run recap` (dry run only). To see what students use:
`npm run usage`. Test workers by calling their functions directly, never by
starting them.

## Email, notifications and the privacy policy

Optional email (the welcome series, the weekly recap) is one flag,
`profiles.email_unsubscribed`: set by the signed link in every such email, by
the RFC 8058 one-click headers (`unsubHeaders` in `email.js`), and by
Settings → Notifications → Study emails (`/api/me/email-prefs`). Codes,
invitations and billing notices ignore it. Set `MAIL_POSTAL_ADDRESS` on the
server (a PO box or registered-agent address) and it prints under every
optional email: US CAN-SPAM wants a physical address on commercial mail.

**The privacy policy (`src/LegalPages.jsx`) describes what we send.** Adding a
new kind of email, push notification or collected data means updating
Sections 2, 3 and 5 and the Privacy Policy's "Last updated" date in the same
change (the Terms and the recorded policy version stay put; nothing compares the
version, so an edit doesn't trigger the terms wall). Push consent copy lives in
`features/notifications/PushToggle.jsx` and must name every kind of push sent.
Account deletion (`routes/auth.js`) clears the tables that block it; tables with
a cascading foreign key to `auth.users` need nothing. Verified 2026-10-14 by
deleting throwaway users: only `forge_outputs` (which also holds study sessions)
and `starred_notebooks` block deleting the auth user; `user_events`,
`social_notifications`, `push_subscriptions`, `flashcards`, `classes`,
`daily_activity`, `notebook_members` and the friend tables all cascade. A new
table that references users must be tested the same way before it ships.

## Server

`supabase` is the **service-role** client and bypasses RLS, so authorization
is entirely in application code. Every route that takes a resource `:id`
behind `requireAuth` alone must do its own explicit ownership check — match
the existing ones. Use `crypto` for anything auth-bearing; never
`Math.random()`.

**Per-person lookups are batched.** `resolveUserBrief` (name, username, presence)
used to cost two requests per person, so a friends list of N was 2N requests,
polled every minute per open browser. `lib/users.js` now sends profile reads made
in the same tick as one `IN (...)` query (`lib/batch.js`) and caches auth-side
names and emails for 10 minutes (`authIdentity`). So `Promise.all(ids.map(resolveUserBrief))`
is fine; don't call `supabase.auth.admin.getUserById` in a loop, use
`authIdentity`. PostgREST caps a response at 1000 rows without saying so, which is
why `/api/friends/best` batches memberships but still counts activity per friend.

**Anything that sells a plan carries `BillingNote`** (`features/billing/`): the
renewal, how to cancel and the Terms/Privacy links, in the words of Terms §7. It
sits directly under the buy button in the upgrade modal and the Squad card, and
under the landing pricing cards. Change the Terms' billing section and this
component together.
