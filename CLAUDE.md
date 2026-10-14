# scholr

Collaborative study app. React 19 + Vite client, Express + Supabase server.

**The product thesis is friends.** Studying together is the point; solo
features are secondary. The dashboard leads with `FriendsRow` and that
ordering is deliberate — don't demote it.

## Verify before you claim

```
npx vite build          # must succeed
npx eslint src server   # 0 errors; 17 pre-existing warnings are expected
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

**Type:** Nunito (`FONT`, `FONT_HEADING`) for headings, body, buttons
and anything read at length — including Derek's answers and PINs. Shantell Sans
(`var(--font-hand)`) is the handwriting layer: section labels (surface.css turns
the inline uppercase labels into handwritten notes), the status strip,
segmented options, the hero's "Study together.", accent words in landing titles.
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
like a slash; Hanken Grotesk went the same night (bold titles read harsh) —
Nunito's rounded terminals keep headings friendly. Keep heading tracking near
zero; the old tight negative tracking was part of the harshness.

**The logo is the S-shaped speech bubble with the spark** (`public/scholr-logo-*.png`,
rendered by `src/ui/ScholrMark.jsx`, white tile in light, dark tile in dark).
Don't redraw it. The landing hero's sketch (`src/ui/HeroSketch.jsx`: notes → Derek as the
logo's spark → friends) is the one illustration, in theme tokens. No Derek
face or bubble — Noah disliked it; faint ruled lines fade out behind the hero.

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

## Server

`supabase` is the **service-role** client and bypasses RLS, so authorization
is entirely in application code. Every route that takes a resource `:id`
behind `requireAuth` alone must do its own explicit ownership check — match
the existing ones. Use `crypto` for anything auth-bearing; never
`Math.random()`.
