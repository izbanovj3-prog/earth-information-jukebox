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
- **Dev-only audit**: 7 moderate advisories in the typescript-eslint toolchain (lint only, not shipped).

## Acceptance criteria

- `npm install && npm run dev` works from a clean clone; `build`, `test`, `e2e` green.
- >= 4 verified real-data tracks with provenance.
- Live sonification synced to the displayed frame (scan line visible, pan follows).
- Keyboard-only + screen-reader flow; axe: zero serious/critical; contrast >= 4.5:1.
- Disclaimer visible: "Unofficial prototype built for NASA Space Apps Challenge. Not a NASA product." No NASA logos.
- Every resource cited in-app and in ATTRIBUTION.md.
- README, ATTRIBUTION, LICENSE (Apache-2.0), DEMO, CONTEXT up to date.

## Open questions

- Which of the candidate themes have GIBS layers with usable colormaps (answered by the spike).
- Real screen-reader testing (NVDA/VoiceOver) is not possible in this sandbox; only automated checks + ARIA review.
