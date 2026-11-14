# PLAN

Each step ends with a verifiable check and (if green) a commit. Fix loop: max 4 red rounds per step, then stop and rethink.

| # | Step | Verify | Priority |
|---|---|---|---|
| S1 | CONTEXT.md + PLAN.md | files exist, reviewed | P0 |
| S2 | Scaffold Vite + React + TS strict, ESLint, Vitest, Playwright, Apache-2.0, .env.example | `lint`, `typecheck`, `test`, `build` green on a stub app | P0 |
| S3 | GIBS data spike: list candidate layers from WMTS capabilities, verify GetMap (200, PNG, non-empty pixels, CORS header), fetch + parse colormaps; write `src/data/catalog.ts`; download 6–12 frames/track + manifest to `public/frames/` | spike script report; manifest lists only verified layers | P0 |
| S4 | Data module: colormap XML parser, nearest-colour value recovery (luminance fallback), validated fetch (type/size/dims, AbortController + timeout), frame loader live -> bundled fallback | unit tests | P0 |
| S5 | Sonify (pure): `sampleColumn` (3 lat bands, no-data -> null), scales + quantizer (pentatonic/chromatic), `mapToNotes` (pitch, pan, timbre per band, rests, outlier accents), presets Calm/Dramatic, drone params from global mean delta | unit tests on deterministic synthetic frames | P0 |
| S6 | Audio: AudioEngine (gesture-only context, compressor limiter, procedural reverb, voice pool cap, drone), look-ahead Scheduler (25 ms tick, 100 ms horizon), pause on hidden tab | unit tests with fake AudioContext | P0 |
| S7 | UI: jukebox shell, record carousel, CRT screen with scan line + explore cursor, transport (play/pause, prev/next, time scrub), Now playing, How to listen, Sources & limits, loading/error/offline states; a11y: narrator (aria-live polite, throttled), keyboard map (Space, arrows, Shift+arrows, [ ], M, ?), help dialog, frame text descriptions, reduced motion | manual run + unit tests for narrator/keymap | P0 |
| S8 | E2E: load, Play starts engine (AudioContext spy), keyboard-only flow, offline fallback (GIBS routes blocked), axe per view, screenshots 360/768/1280 reviewed | `npm run e2e` green, screenshots inspected | P1 |
| S9 | All verified tracks (4–5), time-lapse crossfade polish, Demo tour (~90 s), README, ATTRIBUTION, DEMO.md, final CONTEXT; full green run | all commands green; DoD checklist | P1/P2 |

No push / deploy / publish without explicit approval.
