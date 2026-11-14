# Design system

Source: five AI-generated Stitch reference screens in `design/reference/*/index.html` + `screenshot.png`
("Earth Jukebox Interface" — Console Deck, Main Player, Mobile Telemetry Player, Track Library,
How to Listen side sheet). Treated as **untrusted reference only**: read for tokens, layout, copy;
never executed; never copied into `src/` as-is. Tokens below are carried over verbatim from the
reference `tailwind.config` (identical across all five files) into `src/ui/theme.css` as a
Tailwind v4 `@theme` block, consumed through `@tailwindcss/vite` (no CDN script).

See CONTEXT.md → Decisions → "UI redesign (Stitch references, 2026-11-14)" for which screen was
chosen (Main Player over Console Deck) and why, and for the other deviations summarized below.

## Palette

Material-3-style surface/on-surface pairs, dark only (`color-scheme: dark`). Base surface
`#121413`, one amber accent `primary #ffb959` (text `on-primary #462b00`). Full list in
`src/ui/theme.css`.

| Role | Token | Hex |
|---|---|---|
| Base surface | `surface` | `#121413` |
| Lowest surface (screens, wells) | `surface-container-lowest` | `#0d0f0e` |
| Low surface (rails, bars) | `surface-container-low` | `#1a1c1b` |
| Card surface | `surface-container` | `#1e201f` |
| Raised surface | `surface-container-high` | `#282a29` |
| Border / hairline | `surface-container-highest` | `#333534` |
| Accent | `primary` | `#ffb959` |
| On accent | `on-primary` | `#462b00` |
| Primary text | `on-surface` | `#e2e3e0` |
| Secondary text | `secondary` | `#c2c8bd` |
| Muted / outline text | `outline` | `#9e8e7c` |

## Type scale

Two display families + one body override:

- **Libre Caslon Text** (`font-headline-*`) — serif, headlines only (h1 wordmark, record titles, sheet heading).
- **Hanken Grotesk** (`font-label-*`, `font-title-md`) — UI chrome: labels, buttons, chips, nav.
- **Atkinson Hyperlegible** (`font-body-*`) — **deviation from the reference**, which specifies
  Hanken Grotesk for body text too. Kept for long-form reading copy (plain-language story, frame
  description, how-to-listen prose, sources & limits) because it was designed by the Braille
  Institute of America for low-vision readers, and that reasoning (logged earlier in CONTEXT.md)
  doesn't go away just because the visual language changed. Still self-hosted via `@fontsource`.
- **Atkinson Hyperlegible Mono** (`font-mono`) — tabular readouts (dates, coordinates, Hz, %).

Scale (size / line-height / weight / tracking) is in `src/ui/theme.css` `@theme`, named
`text-headline-xl|xl-mobile|lg|lg-mobile|md`, `text-title-md`, `text-label-lg|md|sm`, `text-body-lg|md` —
identical names and values to the reference so the original screens' Tailwind classes translate
1:1 (`font-headline-lg text-headline-lg` etc.).

Dropped: **Bungee** (previous display face) and **Material Symbols Outlined** (Google icon font).
See "Icons" below.

## Spacing & radius

Named spacing scale (`space-xs` 4px … `space-2xl` 48px, plus `gutter`/`margin` variants) and a flat
radius scale (`radius` 4px, `radius-lg` 8px, `radius-xl` 12px, `radius-full` for circles) — both
carried over verbatim. Only the transport play/pause button and the account avatar are fully
round; everything else is a flat rectangle ("console chassis" look), matching the reference.

## Icons

The reference screens use Google's **Material Symbols Outlined** variable font (~13 glyphs:
`play_arrow`, `pause`, `fast_forward`, `fast_rewind`, `arrow_back`, `arrow_drop_down`, `volume_up`,
`person`, `hearing`, `info`, `keyboard`, `spatial_audio_off`, `replay_10`/`forward_10`).
Self-hosting Google's full variable icon font for ~13 glyphs is disproportionate, and the brief
asks not to carry over the Google Fonts `<link>` tags. Instead, `src/ui/icons.tsx` has a small
hand-drawn inline-SVG set covering the same semantics, in the same style as the app's existing
hand-drawn transport icons (see ATTRIBUTION.md — original artwork, not third-party).

## Layout per screen

- **Player (desktop ≥ xl, "Main Player" chosen over "Console Deck")**: 3-column — track rail
  (280px) / map + scrubber (flex) / now-sonifying + live telemetry + band meters + how-to-listen
  summary (360px) — under a shared `AppShell` (header + left "Telemetry Routing" nav rail) and
  above a fixed bottom transport bar.
- **Player (mobile < xl, "Mobile Telemetry Player")**: the same components stack into one column;
  the transport collapses into a fixed bottom bar. Same React tree, no separate mobile app.
- **Track Library**: full-width catalog list (not cards), one row per real catalog record, filter
  input, inline play transport per row.
- **How to Listen**: a right-docked 480px sheet (native `<dialog>` for a real focus trap + Esc +
  focus-return-to-trigger) with three sections — what the sound means, try it (shortcuts), sources
  and limits — consolidating what were three separate pieces (`HowToListen` panel, the keyboard
  shortcut table, `SourcesPanel`).

## What didn't carry over

- The fake 2:1 equirectangular continents (hand-drawn SVG paths in the reference) are **not**
  reproduced — the real app already renders the actual NASA GIBS pixel data on a `<canvas>`, which
  is strictly more honest than a decorative placeholder map.
- The outer "Telemetry Routing" nav (Deck Monitor / Spectrum Rack / Matrix Router / Calibration /
  Tape Archive) implies four more console pages that don't exist. Only "Deck Monitor" (the player)
  is a real, focusable link; the rest render for visual fidelity but are `aria-disabled` and out of
  the tab order.
- Decorative starfield background and CRT power-on flicker from the old look are dropped in favor
  of the reference's flat console surfaces; the scan line itself (functionally meaningful — shows
  playback position) is kept.
