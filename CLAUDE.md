# scholr

Collaborative study app. React 19 + Vite client, Express + Supabase server.

**The product thesis is friends.** Studying together is the point; solo
features are secondary. The dashboard leads with `FriendsRow` and that
ordering is deliberate — don't demote it.

## Verify before you claim

```
npx vite build          # must succeed
npx eslint src server   # 0 errors; ~8 pre-existing warnings are expected
npm test                # node --test, no React testing library
```

There is **no `server/.env`**, so the API can't run locally and the app can't
be exercised end to end here. To check UI, mount the component temporarily in
`App.jsx`, screenshot it, then revert. Say so when something is unverified.

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

Purple `#A78BFA` on a near-black void. Hard edges (`border-radius: 0`;
circles only for avatars and status dots). Hairline card chrome — a top-left
bracket and a cut bottom-right corner, no glow. **One typeface: Inter**, for
readouts too (`font-variant-numeric: tabular-nums` instead of a mono font).

Panels dock to the **right rail** (`ToolModal`), never centre-screen dialogs.
`.shimmer` in `hud.css` is the one "waiting" indicator — an oscillating purple
gradient clipped to text.

Chrome stays quiet, and copy stays plain: the bar is *simple and clean enough
for a 3-year-old or an 83-year-old*. When the aesthetic fights legibility,
legibility wins. Mobile targets are ≥44px and buttons keep their labels — an
icon-only row is a guessing game.

## Server

`supabase` is the **service-role** client and bypasses RLS, so authorization
is entirely in application code. Every route that takes a resource `:id`
behind `requireAuth` alone must do its own explicit ownership check — match
the existing ones. Use `crypto` for anything auth-bearing; never
`Math.random()`.
