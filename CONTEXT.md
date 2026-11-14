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

(More added as work proceeds.)

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
