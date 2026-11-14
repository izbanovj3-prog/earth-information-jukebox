# CONTEXT — Earth Information Jukebox (frontend)

Living document. Updated at every plan step.

## Goal

NASA Space Apps Challenge 2026 — "The Earth Information Jukebox". Build a web app that pairs
NASA Earth imagery frames (from GIBS, the programmatic source behind many Earth Information Center
visuals) with **sonification generated live from the pixels currently on screen**.
Primary audience: blind and low-vision users. Secondary: anyone who learns by ear.

Time box: 14–15 Nov 2026 (48 h). Polished vertical slice > breadth.
- P0: one track working end to end (data -> values -> notes -> audio -> UI -> a11y).
- P1: 4–5 tracks + accessibility audit (axe clean, keyboard-only, screen reader).
- P2: demo tour, polish, submission docs.

## Stack (fixed)

| Concern | Choice |
|---|---|
| Build | Vite + React 18 + TypeScript (strict) |
| Styling | CSS Modules + CSS custom properties |
| Audio | Web Audio API, no audio library |
| Unit tests | Vitest (jsdom where needed) |
| E2E / a11y | Playwright (pre-installed Chromium) + @axe-core/playwright |
| Lint | ESLint (typescript-eslint, react-hooks) |
| Data | NASA GIBS WMS/WMTS (keyless), bundled fallback frames |
| Fonts | Self-hosted via @fontsource (SIL OFL) |

Frontend only, static build, no backend, no API keys.

## Structure

```
src/
  data/     gibs client, colormap parser, frame loader, catalog.ts
  sonify/   pure mapping: sampleColumn, mapToNotes, scales, presets
  audio/    AudioEngine, scheduler, voices, reverb (only place with audio side effects)
  a11y/     live-region narrator, keyboard map
  ui/       React components
  types.ts  shared contract (Frame, ColumnSample, NoteEvent, ...)
public/frames/   bundled offline frames + manifest.json + colormaps
scripts/         data spike / frame download scripts (Node)
tests/unit/      Vitest
tests/e2e/       Playwright
docs/            challenge text, plan notes
```

## Contract (between data, sonify+audio, ui)

```ts
interface Frame { trackId: string; date: string; width: number; height: number;
  rgba: Uint8ClampedArray; legend?: Legend; source: Provenance }
interface ColumnSample { x: number; bands: { lat: [number, number]; value: number | null }[];
  meanValue: number | null }
sampleColumn(frame, x, bandCount): ColumnSample      // pure
mapToNotes(sample, mapping): NoteEvent[]              // pure
class AudioEngine { start(); stop(); schedule(notes, atTime); setMasterVolume(v) }
```

## Commands

```bash
npm install
npm run dev        # Vite dev server
npm run build      # typecheck + production build
npm run lint
npm run typecheck
npm test           # Vitest unit tests
npm run e2e        # Playwright e2e + axe (builds and serves preview)
npm run frames     # re-download bundled GIBS frames (needs network)
```

## Decisions

- **Repo**: reuse the existing scaffold repo (`izbanovj3-prog/earth-information-jukebox`), app at repo root so `npm install && npm run dev` works from a clean clone. Removed the empty placeholder dirs `data/`, `notebooks/`, `assets/` from the hackathon template.
- **License**: switched MIT -> Apache-2.0 as required.
- **Network**: GIBS was blocked by the default sandbox network; a personal environment allowing only `gibs.earthdata.nasa.gov` was created (user-approved). Real data is used; no synthetic frames needed so far.
- **Styling**: CSS Modules (no Tailwind) — fewer deps, full control of the bespoke look.
- **Fonts**: Atkinson Hyperlegible (body; designed by the Braille Institute for low-vision legibility) + a characterful display face for marquee titles only. Both OFL via @fontsource.
- **Aesthetic**: retro-futuristic valve jukebox: deep-space navy/black base, single amber "valve glow" accent, chrome bezels, CRT-like screen for the frame.
- **Frames in-app**: try live GIBS first (validated, 8 s timeout), fall back to bundled frames with a visible banner.

- **Tracks** (data spike): 5 verified GIBS layers — MERRA-2 2 m air temperature (July, 1980–2024), GHRSST MUR25 sea ice (mid-Sept 2007–2025), GHRSST MUR25 SST (mid-Aug 2003–2025), MODIS Terra NDVI monthly 2024, MERRA-2 aerosol optical thickness monthly 2024. Rejected: MODIS SST monthly (empty image). Pixel colours match GIBS colormap entries 100%, so values are recovered exactly.
- **Sea ice 2003/2005 dropped**: valid-pixel fraction and low-concentration share differ sharply from later years (likely a product/source change), so they are not comparable.
- **Honest stories**: calibration showed Arctic Sept ice 2007–2025 has big year-to-year swings (2012 lowest) and single-day SST barely trends; copy says so instead of claiming a smooth decline.
- **Accents** fire on extreme *pixels* in a band (top 6% of the track range), not band means; low-end accents disabled where they would fire on almost every column (Antarctic winter, clean polar air). Sea ice has no accents.
- **Drone** follows an area-weighted metric vs the first frame (`mean`, `coverage`, or Arctic `northCoverage`), with a per-track `changeScale` = change that moves it a fifth. Documented in-app as a deliberate exaggeration.
- **Pitch** maps value the same way in every band ("higher = more" always holds); bands differ by timbre + a small stagger.
- **Keyboard**: shortcuts never override a focused native control; arrows explore only on the map or page body; E jumps to the map; `,`/`.` step time; D reads the frame description (additions beyond the brief, logged here).
- **Coastline overlay** (GIBS `Coastlines_15m`, © OpenStreetMap contributors, ODbL) for orientation only; never sonified.
- **GIBS colormaps are rainbow-like** (dataviz anti-pattern) but are kept: the legend must describe the source image. A scale legend with ticks, hover crosshair and a live "now" marker is shown.
- **HUD outside the image**: date/source chips sit in the bezel, not over data.
- **URL state**: `?record=<id>&date=<YYYY-MM-DD>` for shareable views.
- **Node scripts** use `NODE_USE_ENV_PROXY=1` so `fetch` honours the sandbox proxy.
- **Lazy frames + session cache** (web-performance-optimization): load the frame in focus, then 2 ahead for the time-lapse; decoded frames live in an in-memory LRU (30 frames, ~31 MB) because GIBS WMS sends `Cache-Control: no-store`. Startup GIBS traffic fell from 12 requests / 994 kB to 3 / 248 kB; switching records away and back fell from 22 requests to 3. LCP 276 ms, CLS 0.027 (headless Chromium, local preview). No code splitting (single screen; React is most of the 69 kB gzip bundle).
- **Demo tour** is pure data (`src/ui/tour.ts`); it turns the time-lapse off where the narration names a date, and any shortcut hands control back.
- **Accepted deviation**: the one-shot CRT power-on animates `clip-path`/`filter` (disabled under reduced motion).
- **Review council** (6 reviewer agents: correctness, security, architecture, interface, test evidence, policy) ran on the full change. Fixed: baseline frame 0 was never loaded on deep links/tour jumps (silent drone, missing comparison); timeouts now cover body reads; streaming size caps; PNG header dimensions checked before decoding; linear-time colormap parsing; https-only WMS override; build-time CSP; manifest validation; offline banner persists across records and has its own text for `VITE_OFFLINE_ONLY`; per-frame load errors with Try Again; brightness fallback uses a 0–1 range with its own words; failed legends are not cached; explore mode silences the drone and tab-hidden pauses all audio; hover never starts audio; pause ends the tour; play() while playing keeps scheduler timing; no stale crossfade while waiting for a frame; menus keep their letter keys; invalid URL params are reported (nearest date); single sources of truth for bands, WMS contract, drone metric; scripts share a timeout+size-capped HTTP helper, verify colormaps with the app parser, and never overwrite the manifest on a partial failure; cross-platform proxy handling; `engines: node >=22.18`.
- **Not done (logged)**: no code splitting (single screen); no service worker; no real screen-reader session (NVDA/VoiceOver) in this sandbox.
- **Dev-only audit**: 7 moderate advisories in the typescript-eslint toolchain (lint only, not shipped).

### UI redesign (Stitch references, 2026-11-14)

Five AI-generated reference screens ("Earth Jukebox Interface") landed in `design/reference/` (untracked on disk; this pass adds them to git). They are **untrusted reference only**: read for layout/tokens/copy, never executed, never copied into `src/` verbatim.

- **Desktop player: Main Player over Console Deck.** Console Deck was not in the original brief and invents a "Sonification Modulation Matrix" (Thermal Pitch/Salinity Cutoff/Albedo Amplitude/Wave Reverb knobs) and an "Observation Tapes" list with track names (Pacific Thermal Upwelling, Saharan Dust Plume Drift, ...) that have no counterpart in the real engine or catalog — building it would mean fabricating controls and data, which conflicts with the "honest stories, real data only" rule already in this file. Main Player's 3-column layout (track rail / map + scanline + scrubber / now-sonifying + live telemetry + 3 band meters + how-to-listen) maps directly onto the real contract (`ColumnSample.bands`, `NoteEvent.freq`, `BANDS`) and fits the brief's "scan line + 3 level meters + transport" requirement with cleaner contrast and less decorative clutter. Chosen as the desktop player.
- **Styling pivot: Tailwind v4 via `@tailwindcss/vite`, superseding the earlier "CSS Modules, no Tailwind" decision.** The user explicitly asked for the Stitch Tailwind design system this time; CSS Modules is dropped in favour of Tailwind utilities + a `@theme` token file generated from the reference `tailwind.config` (colors, spacing, radii, fontFamily, fontSize all carried over verbatim).
- **Fonts: Hanken Grotesk (labels/UI chrome) + Libre Caslon Text (headlines) self-hosted via `@fontsource`, replacing Bungee.** Deviation: long-form reading copy (plain-language story, frame description, how-to-listen body text, sources & limits) keeps **Atkinson Hyperlegible** instead of switching to Hanken Grotesk for body text — the low-vision-legibility reasoning for that font (see earlier Decisions entry) still holds and the brief says to fix the implementation and log it when the design conflicts with accessibility. Atkinson Hyperlegible Mono stays for tabular readouts.
- **Icons: hand-drawn inline SVG, not self-hosted Material Symbols.** The references use ~13 distinct Material Symbols glyphs; self-hosting Google's full variable icon font for that is disproportionate. A small local icon set (`src/ui/icons.tsx`) covers the same semantics (play/pause/prev/next, volume, person, chevron, hearing, info, back). Logged in ATTRIBUTION.md as original artwork, same as the existing hand-drawn transport icons.
- **Track identity: real catalog copy wins over mockup placeholder copy.** The references use generic layer names (Arctic Sea Ice, Sea Surface Temp, Land Surface Temp, Vegetation Index, Aerosols & Particulates) in a fixed A1/A2/A3/B1/B2 order. The real catalog (`src/data/catalog.ts`) has different titles (Fever Pitch, Thin Ice, Ocean Fever, Green Pulse, Hazy Skies — air temperature, not "land surface temp"), different subtitles (real date ranges, not thematic taglines) and a different order. Kept the real catalog as the source of truth; only the visual chrome (slot chips, row layout, spacing) was matched to the design.
- **Left "Telemetry Routing / Master Bay" rail: the four decorative items were removed, not kept as disabled.** All four reference screens share an identical 5-item outer nav (Deck Monitor / Spectrum Rack / Matrix Router / Calibration / Tape Archive) implying a multi-page console this app doesn't have. They were first shipped as `aria-disabled` dimmed items, but user review (2026-11-14) flagged that their box/border styling still reads as clickable to a sighted user even dimmed. Choice: remove the four, rather than add an explicit "Coming soon" label to each — a label on every one of four items is more visual clutter than one real nav item standing alone, and promising features with no near-term plan would be mildly dishonest for a 48-hour hackathon prototype. The rail now shows only the one real link ("Deck Monitor", no slot number, since numbering implied a 1-of-5 sequence that no longer exists).
- **How-to-Listen side sheet consolidates three previously separate pieces**: the old `HowToListen` panel (sonification-meaning copy), the keyboard `SHORTCUTS` table (previously its own small `<dialog>` via `HelpDialog`), and `SourcesPanel`'s sources/limits/credits. The reference's three sections ("What the sound means" / "Try it" / "Sources and limits") map onto exactly those three real sources, so the old standalone `HelpDialog` is retired rather than kept alongside a redundant sheet.
- **Track Library ↔ Player navigation**: the reference screens don't show how you get from the full-page "Choose a record" catalog to the single-record Main Player (Main Player already embeds its own track rail). Added an explicit, accessible affordance (a link from the player's track rail to the full catalog, and selecting/playing a row in the catalog switches to the Player view) since the brief requires both screens to exist and be reachable.
- **Mobile Telemetry Player is responsive CSS on the same component tree**, not a second implementation: the same player component renders the 3-column desktop layout above `xl:` and the stacked mobile layout (fixed bottom transport, collapsed meters) below it, per the brief ("not a separate app").
- **Dropped the reference's "48kHz 24-bit PCM" / "RATE: 48,000 SAMPLES/SEC" labels.** The Web Audio API processes audio as 32-bit floating point internally, not fixed-point 24-bit PCM; repeating the mockup's copy verbatim would have been a factual claim the app doesn't back up. The header now says "Sonification engine: ready (Web Audio, live synthesis)" instead.
- **Header's "Monitor" meter shows a real dB value** (`20*log10(volume)`) computed from the actual master-volume state, not a decorative static readout like the reference's `-12dB`.
- **Transport is `position: fixed` at every breakpoint**, not `sticky`. The real page is taller than one viewport (unlike the reference mockups, which fit one screen), and sticky bottom elements don't become visible until the user scrolls near their natural flow position — so play/pause would have been unreachable without scrolling first. Fixed keeps playback controls reachable from anywhere on the page, matching the Mobile Telemetry reference's own `fixed bottom-0` choice.
- **"Sound settings" (Mood/Key/Narration) is a collapsed `<details>` by default**, not open, to keep the fixed transport bar compact; e2e tests open it first.
- **CSP `font-src` amended to `'self' data:`.** Vite inlines small Fontsource subset files (many language subsets are under its 4 kB default threshold) as base64 `data:` URIs; the original `'self'`-only policy from the CSS-Modules build blocked them under Tailwind's larger, more subset-heavy font CSS.
- **Fix-loop findings from the screenshot pass** (all corrected before commit): `SidePanel` was missing the `xl:w-[360px]` cap that `TrackRail` had, so it claimed 100% row width and broke the 3-column layout; the browser's UA stylesheet gives `<fieldset>` an implicit `min-width: min-content`, which defeated `overflow-x-auto` on the mobile track-selector row until `min-w-0` was added; the header overflowed at 1440px until the "Sonification engine" status text moved from `lg:` to `2xl:` and the Monitor/Volume chips moved from `sm:`/`md:` to `xl:`.

### Merge with the teammate prototype (branch `merge/best-of-both`, 2026-11-14)

Full comparison, measurements and the approved decisions are in `MERGE_PLAN.md`. Summary of what changed here:

- **Base A, plus B's EIC records.** The teammate's engine (`analyze/engine/orchestra/datasets.js`) is vendored into `src/eic/vendor/` with `.d.ts` shims and minimal changes marked `MERGE:`. `EicSession` (`src/eic/session.ts`) is the typed, subscribable controller; the React UI reuses A's shell, rail, library, keyboard map, narrator and URL state for both collections.
- **Default record: Night Lights 2012 → 2023 (SVS 5313)** (decision D4). GIBS records stay one click or `]` away; `[`/`]` walk EIC then GIBS.
- **Orchestra loading (D2).** Play always starts at once in Scientific (synths, no download). If the listener prefers Orchestra (default, stored in `localStorage` as `eic.soundMode`), `instrumentsFor()` dry-runs the orchestra composer to list the instruments that record actually uses, only those are fetched (Night Lights 6.6 MB of 16.4 MB) and playback switches mid-sweep without losing its place. Sample load failure keeps Scientific playing and is announced.
- **Only the first baked picture blocks playback**; the other frames load in the background.
- **IDs:** both collections have an `aerosols` record, so EIC records are `eic-<id>` in the URL and DOM. Plain `?record=aerosols` still opens the GIBS record (older links keep working).
- **EIC frame dates come from the loaded frames**, not the static list in `datasets.js` (lightning frames are sampled from video and dated by measurement). In-between dates snap to the nearest frame.
- **Phone transport:** below `sm` the fixed bar shows only the play row and a "More controls" toggle; at 390 px the map is no longer covered (was: map bottom 562 px, bar top 547 px).
- **CSP:** `media-src 'self'` (was `'none'`) for the coming playlist `<audio>`.
- **Licence (D1):** Apache-2.0 for everything; the prototype's files keep their copyright notice; `NOTICE` lists them.
- **Citation fix:** the prototype cited SVS 5669 for the aerosol frames; 5669 is a different product (GEOS-FP 2 km replay, Aug 2025). Only SVS 5552 is cited now.
- **Not merged yet (should-do, awaiting review):** playlist view, WAV export, trend chart + table, mixer, STORY.md, Pages workflow. Live video stays local-only on the prototype branch (D7).

## Acceptance criteria

- `npm install && npm run dev` works from a clean clone; `build`, `test`, `e2e` green.
- >= 4 verified real-data tracks with provenance.
- Live sonification synced to the displayed frame (scan line visible, pan follows).
- Keyboard-only + screen-reader flow; axe: zero serious/critical; contrast >= 4.5:1.
- Disclaimer visible: "Unofficial prototype for NASA Space Apps Challenge 2026. Not a NASA product." No NASA logos.
- Every resource cited in-app and in ATTRIBUTION.md.
- README, ATTRIBUTION, LICENSE (Apache-2.0), DEMO, CONTEXT up to date.

## Open questions

- ~~Which candidate themes have GIBS layers with usable colormaps~~ answered by the spike (5 tracks).
- The Stitch designs ("Earth Jukebox Interface") could not be fetched: no Stitch connector in this session.
- Real screen-reader testing (NVDA/VoiceOver) is not possible in this sandbox; only automated checks + ARIA review.
