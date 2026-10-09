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

**Paper: a hand-drawn explainer sketched on white.** (Since 2026-10-09; the
dark violet "instrument panel" look is retired.) Pure white `#FFFFFF` — no
beige, no texture — with black ink `#1C1C1C` for text and lines, and colour
only where it means something: orange `--acc` (`#C2410C`) for the way forward
and primary actions, red `--danger` for problems, blue `--info` for notes,
green `--success` for "solid". Every text colour clears 4.5:1 on white; don't
add pastels (`#FBBF24`, `#60A5FA`…) as text, use the inks in `src/lib/theme.js`.
There is one theme: `useAppearance` pins `data-theme="light"`, and the
accent is still the student's choice (Orange default).

**`src/paper.css` is the hand-drawn layer and loads last** (after App.css).
It gives cards, sheets, panels, tiles, inputs and outlined/filled buttons an
ink outline with the `--wobble` border-radius (the PaperCSS ellipse trick that
reads as drawn by hand), turns tracked-uppercase "instrument labels" into
handwritten notes, kills glows, shadows, radial gradients and frosted glass,
and restyles the status strip. Reach new components through classes or the
tokens they write, the same way. No gradients, glows, shadows or blur.

**Two typefaces.** Kalam (`--font-hand`, `FONT_HEADING`, `FONT_SERIF`) for
headings, labels, PINs and anything that reads like a margin note; Hanken
Grotesk (`FONT`) for body text, buttons and anything read at length —
including Derek's answers. Handwriting for a paragraph fails the legibility bar.

**Type and space come from scales, not from taste per component.** `--fs-*`
with a matching `--tr-*` and `--lh-*`. Spacing is `--sp-1`…`--sp-8`.

**Illustrations are hand-drawn SVG** in the same ink/orange/blue/red palette
(`src/ui/HeroSketch.jsx`, `src/ui/ScholrMark.jsx`, the brain's `HandOrb`). No
WebGL effects, no mock app screenshots.

Panels dock to the **right rail** (`ToolModal`), never centre-screen dialogs.
`.shimmer` is the one "waiting" indicator — an oscillating ink-to-orange
sweep clipped to text.

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
