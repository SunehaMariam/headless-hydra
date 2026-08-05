# HeadlessHydra 🐍

A strictly-typed, headless autocomplete/combobox for React. It owns 100% of
the behavior — state, keyboard navigation, filtering, async data loading,
selection, and accessibility wiring — and renders **zero** markup or styles
of its own.

To prove it's genuinely headless, this repo ships the same hook driving
**two completely different, real-world UIs**:

| Skin | What it is | Data mode |
|---|---|---|
| **Minimal List** (`src/skins/MinimalListSkin.tsx`) | A "From" city field for a flight-search form, styled like a plain text input with a dropdown. | Synchronous, in-memory filtering over 600 real cities. |
| **Command Palette** (`src/skins/CommandPaletteSkin.tsx`) | A ⌘K-triggered "compare cities" tool with a card grid and multi-select chips. | Async — every keystroke debounces into a simulated network search. |

Both consume the exact same `useCombobox<TItem>()` hook with **no forked
logic**. Only markup and CSS differ.

The demo dataset is real: the top 600 world cities by population, pulled
from the SimpleMaps World Cities Database (`src/data/cities.ts`), so filtering
performance is exercised against real-world data volume and messiness (accents,
duplicate city names across countries, etc.), not synthetic placeholders.

---

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
npx tsc -b       # typecheck, strict mode, zero `any`
```

---

## Headless API design: hook, not compound components

HeadlessHydra exposes a single hook, `useCombobox<TItem>()`, rather than a
compound-component tree (`<Combobox.Input>`, `<Combobox.Options>`, etc.).

**Why a hook and not compound components here:**

- The two proof-of-headlessness skins in this repo need *structurally
  different DOM trees* — one is a flat `<ul>` under an `<input>`, the other
  is a modal dialog with a search row, a skeleton-loading grid, and a
  selection-chip tray sitting *outside* the popover entirely. A
  compound-component tree with fixed slots (`Combobox.Input`,
  `Combobox.Options`) would force both skins into the same shape and start
  leaking layout opinions — exactly what the spec says to avoid.
- A hook returns plain state + prop-getter functions. The consumer decides
  what elements exist, in what order, and where each prop-getter gets
  applied. That's a strictly more flexible contract than a fixed component
  tree, at the cost of the consumer needing to call `getInputProps()` /
  `getOptionProps()` themselves — an acceptable tradeoff for a component
  whose whole point is "you own the rendering."
- It composes better with memoization at the option level (see
  Performance below) since consumers render their own option list items
  however they like.

If a future consumer wanted a more guided, "fill in the blanks" API, a thin
compound-component wrapper could be built **on top of** `useCombobox`
without touching the state machine — the hook is the actual headless layer.

---

## The prop-getter pattern

`useCombobox` returns four prop-getters:

```ts
getLabelProps()
getInputProps()
getListProps()
getOptionProps(index, item)
```

Each one returns a plain object of DOM attributes/handlers to spread onto
the element the consumer chooses to render. Critically, **every getter
merges in whatever the consumer passes**, rather than overwriting it:

```ts
// src/headless-hydra/useCombobox.ts
function callAll<E>(...fns: Array<((event: E) => void) | undefined>) {
  return (event: E) => {
    for (const fn of fns) if (fn) fn(event);
  };
}

onChange: callAll(
  (e) => setInputValue(e.target.value),   // HeadlessHydra's own logic
  onChange,                                // consumer's onChange, if any
),
```

So this always works, and both handlers fire, in order:

```tsx
<input {...getInputProps({ onChange: (e) => analytics.track(e.target.value) })} />
```

This is the one invariant the whole library is built around: **a
consumer's event handler passed into a prop-getter must never be silently
dropped.**

---

## Controlled vs. uncontrolled

Uncontrolled (default) — the hook owns `inputValue`, `selectedItems`, and
`isOpen` internally:

```tsx
useCombobox({ items, itemToString, itemToId });
```

Controlled — pass `inputValue` and `selectedItems` (and optionally `isOpen`
+ `onIsOpenChange`) and the hook defers to you, only calling
`onInputValueChange` / `onSelectionChange` so you can update your own state:

```tsx
useCombobox({
  items,
  itemToString,
  itemToId,
  inputValue,
  selectedItems,
  onInputValueChange: setInputValue,
  onSelectionChange: setSelectedItems,
});
```

`isControlled()` (in `types.ts`) detects the mode by checking whether both
`inputValue` and `selectedItems` were supplied — this is a type guard, so
TypeScript narrows the options object accordingly with no `any` involved.

Both demo skins use uncontrolled mode for simplicity; controlled mode is
exercised by the type guard and reducer's `SYNC_EXTERNAL` action, which a
consumer needing external state (e.g. syncing to a URL query param or a
form library) would rely on.

---

## Sync & async filtering

- **Sync mode**: pass `items: TItem[]`. Filtering happens in a `useMemo`
  with a default case-insensitive substring match, or your own `filterFn`.
- **Async mode**: pass `fetchOptions: (query, signal) => Promise<TItem[]>`
  instead of `items`. The hook:
  1. Debounces keystrokes (`debounceMs`, default 300ms) before firing a
     request.
  2. Tags every request with an incrementing id and **only commits the
     response whose id is still the latest** — a fast second keystroke
     that fires request #2 before request #1 resolves can never have
     request #1's stale results overwrite request #2's fresher ones.
  3. Aborts the in-flight request via `AbortController` when a newer one
     starts, and swallows the resulting `AbortError` instead of surfacing
     it as a UI error.
  4. Exposes `isLoading` and `error` (backed by an internal
     `'idle' | 'loading' | 'success' | 'error'` discriminated status) so
     the consumer renders their own spinner/skeleton/error state — see the
     skeleton cards in `CommandPaletteSkin.tsx`.
  5. Exposes `isEmpty` as a state distinct from `isLoading`, so "no
     results" and "still fetching" never get confused in the UI.

The command-palette skin's mock backend (`src/data/mockApi.ts`) uses
**randomized latency (250–900ms)** specifically so that typing quickly
against it will genuinely produce out-of-order responses in practice, not
just in theory.

---

## Keyboard navigation

| Key | Behavior |
|---|---|
| `ArrowDown` / `ArrowUp` | Move highlight, **clamped** at the first/last option (chosen over wrapping so a long list doesn't silently teleport the highlight from the bottom back to the top — see `MOVE_HIGHLIGHT` in `reducer.ts`). |
| `Home` / `End` | Jump to first/last option while open. |
| `Enter` | Select the highlighted option, close (single-select) or toggle it and stay open (multi-select). |
| `Escape` | Close without selecting; restores the previous committed value in uncontrolled mode. |
| `Tab` | Selects the highlighted option (if any) and lets focus move on naturally — the widget never traps focus. |

All of this is handled in one place (`handleKeyDown` inside
`useCombobox.ts`), driven off whatever `options` currently is — so it
behaves identically whether those options came from the sync `items` array
or an in-flight async fetch.

---

## Accessibility contract

The ARIA combobox pattern is wired into the prop-getters, not left to the
consumer to remember:

- `getInputProps()` → `role="combobox"`, `aria-expanded`,
  `aria-controls` (pointing at the listbox id), `aria-activedescendant`
  (pointing at the currently highlighted option's id, only while open),
  `aria-autocomplete="list"`, `aria-labelledby`.
- `getListProps()` → `role="listbox"`, `aria-labelledby`.
- `getOptionProps(index, item)` → `role="option"`, `aria-selected`,
  `aria-posinset` / `aria-setsize` so screen readers can announce "3 of
  600" style position, regardless of how the consumer visually indicates
  it.
- `getLabelProps()` → ties a `<label>` to the input via `htmlFor`.

**What a consumer must not break:** since there's no default styling, a
consumer must (a) actually spread `getInputProps()` onto the real `<input>`
that receives keystrokes — not a decorative wrapper — and (b) apply
`getOptionProps(index, item)` to the element whose `id` matches what's
announced as active, i.e. one call per rendered option, in the same order
they're rendered. As long as those two things hold, CSS can do anything —
hide focus rings, reorder visually, whatever — without touching the
accessibility tree, because the ARIA attributes are computed from state,
not from layout.

The entire component is operable with keyboard only; neither skin has a
mouse-only interaction (clicking options is a convenience, not a
requirement).

---

## Performance strategy for large option sets

- Filtering is wrapped in `useMemo`, keyed on the actual inputs
  (`items`, `inputValue`, `filterFn`), so retyping the same character
  twice or re-rendering the parent doesn't re-filter 600 cities for no
  reason.
- `getOptionProps` is `useCallback`'d and only depends on the pieces of
  state that actually affect an option's props (`selectedItems`,
  `options.length`), not on `inputValue` — so re-filtering doesn't force
  every option's prop-getter identity to change if the underlying item
  didn't change.
- Both skins render option lists as plain, key-stable `.map()`s over
  `options`; because `options` itself is memoized, React's reconciliation
  can bail out on unchanged rows via the stable `key={item.id}`.
- Async requests are debounced (`debounceMs`, default 300ms) specifically
  so typing quickly into a 600+ result async source doesn't fire a
  request-per-keystroke.
- The command-palette grid caps rendered results at 50 (`mockApi.ts`) and
  the list skin caps at 12 (`MinimalListSkin.tsx`) — a real product would
  either paginate or virtualize past that; the headless hook itself has no
  opinion on this and would work identically with a windowing library
  (e.g. `react-window`) swapped in for the `<ul>`/`<div>` rendering.

---

## Multi-select (bonus track)

Pass `multiSelect: true`. `selectedItems` becomes an array; selecting an
already-selected item removes it (toggle behavior); the list stays open
after a selection so the user can keep picking. The headless layer only
tracks and exposes this state — `removeSelectedItem()` and rendering chips
is entirely up to the consumer, as shown in `CommandPaletteSkin.tsx`.

---

## Strict TypeScript

- `tsconfig.app.json` has `strict: true`, `noImplicitAny: true`, and
  `noUncheckedIndexedAccess: true` on top of the Vite template's defaults.
- The public surface is generic: `useCombobox<TItem>(...)`. Every
  consumer call site (`CityOption` in both skins) gets full inference on
  `options`, `selectedItem(s)`, and everything the prop-getters touch.
- Async status is a discriminated union (`'idle' | 'loading' | 'success' |
  'error'`), and controlled vs. uncontrolled option shapes are
  distinguished by a type-guard (`isControlled`), not by casting.
- Zero `any` across `src/headless-hydra/**`. Run `npx tsc -b` to verify —
  it's also run automatically as part of `npm run build`.

---

## Project structure

```
src/
  headless-hydra/          ← the actual library
    types.ts                 — all public + internal types
    reducer.ts                — the interaction state machine
    useCombobox.ts              — the hook: wires reducer + async + prop-getters
    index.ts                     — public exports
  data/
    cities.ts                 — real dataset: top 600 world cities by population
    mockApi.ts                  — simulated async backend (debounce-friendly latency)
  skins/
    MinimalListSkin.tsx       — Skin 1: flight-search "From" field
    CommandPaletteSkin.tsx      — Skin 2: ⌘K compare-cities palette (multi-select)
    *.css                        — skin-scoped styles only; the library ships none
  utils/flag.ts              — flag-emoji + population formatting helpers (demo-only)
  App.tsx / theme.css        — demo shell
```

## Demo walkthrough

1. **Sync skin** — start typing in "Departure city or airport." Filtering is
   instant and local. Arrow through results, `Home`/`End` jump to the ends,
   `Enter` selects, `Escape` restores the previous value.
2. **Async skin** — click "Compare cities…" or hit `⌘K`/`Ctrl+K`. Type
   quickly (e.g. "s" → "sa" → "san") — you'll see the loading skeleton
   flash and, thanks to randomized mock latency, occasionally see an
   earlier request's timer fire after a later one — the UI never shows the
   stale result because of the request-id guard in `useCombobox.ts`.
   Select a few cities to see multi-select chips; remove one via its `×`.
3. Inspect the DOM in devtools on either skin: `role="combobox"`,
   `aria-activedescendant`, and `role="option"` are present with zero CSS
   loaded — disable the stylesheet entirely and the widgets remain fully
   operable by keyboard.

## Known limitations / what a v2 would add

- No positioning library (Floating UI, etc.) — the list is positioned with
  plain absolute CSS in both skins, which is fine at the viewport sizes
  demoed here but wouldn't reliably avoid viewport edges/scroll containers
  in a general-purpose product. This was a deliberate scope cut to keep
  the headless layer from taking on layout responsibility (see spec §2).
- Virtualization isn't wired in; both skins simply cap the rendered result
  count. The hook's output shape (`options: TItem[]`) is virtualization-
  library-agnostic, so this is additive, not a rework.
