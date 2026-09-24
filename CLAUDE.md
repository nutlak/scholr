# scholr

Collaborative study app. React 19 + Vite client, Express + Supabase server.

**The product thesis is friends.** Studying together is the point; solo
features are secondary. The dashboard leads with `FriendsRow` and that
ordering is deliberate — don't demote it.

## Verify before you claim

```
npx vite build          # must succeed
npx eslint src server   # 0 errors; 9 pre-existing warnings are expected
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
set or booting sends real email to real users. Stripe is deliberately absent
locally, so `/api/health` reports `pro: false, squad: false`; billing is tested
on scholr.dev only.

So exercise the real thing: hit the endpoints with a real token, or drive the
signed-in UI. Two payment bugs that a green build never caught were found that
way. Say so when something is genuinely unverified — but check before claiming it.

## Styling

Inline styles, driven by CSS custom properties. `style={{ color: "var(--t1)" }}`
is the house pattern — so **editing the `:root` tokens in `src/index.css`
restyles the whole app**, which is almost always the right lever.

Load order is `index.css` → `hud.css` → `App.css` (App.css is imported from
`App.jsx`, so it lands last and wins ties). `src/hud.css` is the override
layer: it retunes tokens and adds chrome on top of index.css.

Because styles are inline, attribute selectors are how you reach many
components at once — `[style*="var(--card-bg)"]` applies the card chrome
without editing 30 files. Only do this for tokens written consistently.

Watch out: several components declare their own local `const FONT = ...`
rather than importing `src/lib/theme.js`. Font changes must sweep all of them
*and* the `--font-*` tokens.

## Design language

Violet `#A78BFA` on a warm near-black `#0B0B0C`, with warm off-white text
`#F0EDE7` — not blue-white, and not pure black. One accent; colour elsewhere
only where it carries meaning (streak green, warning gold, danger red).

**Text on the accent is `var(--on-acc)`, never `#fff`.** White on `#A78BFA` is
2.72:1, under AA on the app's most-clicked surface. `--on-acc` is dark in the
dark theme (7.23:1) and white in the light one, where the accent is the deep
violet. Where a fill is conditional, the foreground has to be conditional too —
the disabled and locked states are dark surfaces. Don't grep for `"#fff"` to
audit this; walk the rendered page and compute real ratios, which is how the
last two rounds of it were found.

**Three typefaces, each with a job.** Newsreader for display, Hanken Grotesk
for UI, and `var(--mono)` for *readouts only* — numbers you measure, with
`tabular-nums` so they don't jitter. Mono is not for headings or labels; a
sweep that put it on 57 UI labels was reverted for exactly that reason.

**Type and space come from scales, not from taste per component.** `--fs-*`
with a matching `--tr-*` (tracking is size-specific: negative on display,
slightly positive at micro) and `--lh-*` (leading runs inverse to size).
Spacing is `--sp-1`…`--sp-8`.

Rounded, not hard-edged — the old global `border-radius: 0` and the corner
bracket/cut-corner card chrome are gone. Flat surfaces with hairline borders;
no gradients or glows on interactive surfaces. In-app buttons take
`var(--acc)`, never a hardcoded gradient, or the token lever stops reaching
them. The landing page is deliberately its own visual world and keeps its
gradients.

Chrome is a **material**, not a lid: `backdrop-filter: blur(20px)
saturate(180%)` over a translucent fill, with a short gradient scroll edge
rather than a 1px rule. Honour `prefers-reduced-transparency` and
`prefers-contrast`.

Panels dock to the **right rail** (`ToolModal`), never centre-screen dialogs.
`.shimmer` in `hud.css` is the one "waiting" indicator — an oscillating purple
gradient clipped to text.

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

## Server

`supabase` is the **service-role** client and bypasses RLS, so authorization
is entirely in application code. Every route that takes a resource `:id`
behind `requireAuth` alone must do its own explicit ownership check — match
the existing ones. Use `crypto` for anything auth-bearing; never
`Math.random()`.
