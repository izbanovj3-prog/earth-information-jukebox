# Earth Information Jukebox

Unofficial prototype built for NASA Space Apps Challenge. Not a NASA product.

Pick a record, press Play, and you hear NASA's view of the Earth. Ten records in two collections: five **Earth Information Center** visualizations by NASA's Scientific Visualization Studio (night lights, ocean currents, aerosols, lightning, air quality), which you can hear as a sampled chamber **Orchestra** or as a direct **Scientific** synth mapping, and five **NASA GIBS** data records whose colours are read back into physical values. The app opens on Night Lights 2012 → 2023. A scan line sweeps the map from west to east. The app reads the colour of every pixel back into a physical value (degrees, percent of ice, vegetation index) and turns those values into music in your browser as you listen. You can also stop the scan and move a cursor with the arrow keys to hear one place at a time.

We built it for the 2026 challenge [The Earth Information Jukebox](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/) (full text in [`docs/CHALLENGE.md`](docs/CHALLENGE.md)). Our first audience is blind and low-vision listeners, so every feature works by keyboard and by ear, and a screen reader can follow along.

## Run it

You need Node.js 22.18 or newer (the frame script imports TypeScript files directly, which Node supports from 22.18).

```bash
npm install
```

```bash
npm run dev
```

Open the URL Vite prints. The app needs no API keys. It requests images from NASA GIBS and falls back to bundled copies of the same images if GIBS is unreachable.

Two optional settings go in a `.env` file (copy `.env.example`):

| Variable | Effect |
|---|---|
| `VITE_GIBS_WMS_URL` | Use another GIBS WMS endpoint (https only). `npm run frames` uses it too. |
| `VITE_OFFLINE_ONLY` | `true` never contacts GIBS and plays the bundled frames, with an "Offline mode" banner. |

## Test it

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

The first time, install the browser that the end-to-end tests use:

```bash
npx playwright install chromium
```

```bash
npm run e2e
```

`npm test` runs the Vitest unit tests (colormap parsing, value recovery, sampling, note mapping, the scheduler on a fake AudioContext, narration text, keyboard map, demo tour). `npm run e2e` builds the app and runs the Playwright tests in Chromium, with axe accessibility scans on every record, the dialogs, playback, explore mode, the offline fallback and the error state. The e2e suite serves GIBS requests from the bundled frames and ignores your local `.env`, so it runs offline.

`npm run frames` downloads and re-verifies the bundled frames (needs network access to `gibs.earthdata.nasa.gov`). It only rewrites `public/frames/` when every frame and colormap passes.

## The ten records

### Earth Information Center (NASA SVS)

| # | Record | SVS visualization | Frames |
|---|---|---|---|
| E1 | Night Lights 2012 → 2023 | [5313](https://svs.gsfc.nasa.gov/5313/) Change in Night Lights (EIC) | 12, one per year |
| E2 | Sea Surface Currents & Temperature | [3912](https://svs.gsfc.nasa.gov/3912/) ECCO2 | 12, about monthly, Mar 2007 – Mar 2008 |
| E3 | GEOS Aerosols | [5552](https://svs.gsfc.nasa.gov/5552/) GEOS-FP (not in the EIC gallery) | 10, every ~5 days, Aug – Sep 2024 |
| E4 | Lightning seen from the ISS | [5011](https://svs.gsfc.nasa.gov/5011/) (EIC) | 12, monthly 2019 (dates measured from the video) |
| E5 | Air Quality, fire season 2024 | [5533](https://svs.gsfc.nasa.gov/5533/) GEOS-CF (EIC) | 8, every ~9 days, Jul – Aug 2024 |

Each frame is reduced to a 64 x 32 grid by reading the visualization's own colour key; values are normalised across all frames of a record so change over time stays audible. **Scientific** gives each record its own synth rules. **Orchestra** gives every colour family its own section of a CC0 sampled chamber orchestra (blue strings, green woodwinds, yellow harp, orange horns, red trumpets, violet violas, white piano and glockenspiel) with tempo, harmony, melody, bass and a data-driven groove. Play always starts at once in Scientific; when you prefer Orchestra (the default, remembered), only the instruments that record needs are downloaded (Night Lights 6.6 MB, Lightning 4.3 MB, the others 10–12 MB, instead of all 16 MB) and the orchestra takes over mid-sweep. The method and every artistic choice are explained in [`docs/STORY.md`](docs/STORY.md).

### NASA GIBS data records

| # | Record | NASA GIBS layer | Dates |
|---|---|---|---|
| A1 | Fever Pitch | MERRA-2 2-metre air temperature, monthly | July 1980 to July 2024, every 4 years |
| A2 | Thin Ice | GHRSST MUR25 sea ice concentration | 15 September, 2007 to 2025 |
| A3 | Ocean Fever | GHRSST MUR25 sea surface temperature | 15 August, 2003 to 2025, every 2 years |
| A4 | Green Pulse | MODIS Terra vegetation index (NDVI), monthly | January to December 2024 |
| A5 | Hazy Skies | MERRA-2 aerosol optical thickness, monthly | January to December 2024 |

We picked each layer from the GIBS capabilities document and then requested every frame for real: HTTP 200, a PNG of 720 x 360 pixels, `Access-Control-Allow-Origin: *`, and more than 1% data pixels. All 58 frames in the table passed, plus the coastline overlay. Every pixel colour in those frames appears as an entry in the layer's GIBS colormap, so the app recovers the value behind a colour without guessing.

## How you hear the data

| What you hear | What it means |
|---|---|
| Pitch | The value. Higher pitch means warmer, more ice, greener or hazier, depending on the record. Notes snap to a scale; pick "Chromatic" for the closest match to the data. |
| Left to right ear | West to east. Stereo pan follows the scan line. |
| Three voices | Three latitude bands: North (30 to 90°N) plays a glassy chime, the Tropics a soft reed, the South (30 to 90°S) a plucked string, one after the other at each step. |
| Silence | No data at that place, for example land on an ocean layer. |
| Bell | A pixel in that band reaches the extreme top of the scale (for example air at 37 °C or hotter). |
| Low drone | The global average compared with the first frame of the record. It rises when the average goes up. We exaggerate it on purpose and say so in the app. |

The engine schedules notes 100 ms ahead on the AudioContext clock and moves the scan line from the same clock, so the picture and the sound stay in step. Time-lapse mode moves to the next date after each sweep and crossfades both the image and the values.

## Accessibility

- Keyboard: Space plays or pauses, E jumps to the map, arrow keys explore (2° per press, Shift jumps 20°), `[` and `]` switch records, `,` and `.` step through time, D reads a full description of the frame, M mutes, `?` opens the How to Listen sheet, Escape closes it (focus returns to whatever opened it). Shortcuts never take keys away from a focused button, slider or menu; menus keep their letter keys for type-ahead.
- Screen readers: a polite live region tells you what you hear every few seconds ("40°W. North: warm, rising. Tropics: very warm, steady. South: no data."). You can switch narration to "Changes only" or off.
- Each frame has a text description with the area-weighted average, the change since the first frame, the highest and lowest points with coordinates, and each band.
- No colour carries meaning alone. The UI keeps 4.5:1 text contrast, respects `prefers-reduced-motion`, and works from 360 px wide.
- axe reports zero serious or critical issues on every view the e2e suite covers. Nobody has tested the app with NVDA, JAWS or VoiceOver yet.

## Screens

- **Player** (`AppShell` + `PlayerView`): the main view. A record rail, the map with its scan line, the time scrubber, and a side panel with the live telemetry readout, per-band meters and a how-to-listen summary. The same components reflow into a single column with a fixed bottom transport bar on narrow screens; there is no separate mobile build.
- **Earth Information Center player** (`EicPlayerView`): the same rail and transport for the five SVS records, with the Orchestra/Scientific switch and loading progress, a mixer with activity lights, a trend chart with a data table, the record's two playlist tracks and Export WAV. The library adds a curated playlist of all ten pre-rendered soundscapes.
- **Track Library** (`LibraryView`): a full-page, filterable list of all ten records, reachable from the player's "Browse all records" link, with an inline play control per row.
- **How to Listen** (`HowToListenSheet`): a right-docked dialog (opened from the header or `?`) with what the sound means, the keyboard shortcuts, and sources and limits for the current record.

## Architecture

```
src/eic/      Earth Information Center records: EicSession (typed controller), instrumentsFor (orchestra dry run), vendor/ (teammate engine)
src/data/     GIBS URL builder and validated fetch, colormap parser, frame loader, track catalog
src/sonify/   pure functions: sampleColumn, mapToNotes, scales, drone, frame statistics
src/audio/    AudioEngine (the only module that makes sound), look-ahead scheduler, player
src/a11y/     narration text, keyboard map
src/ui/       React components (AppShell, PlayerView, LibraryView, HowToListenSheet, Screen, ...), demo tour script, Tailwind theme
scripts/      data spike and frame download (Node)
tests/        unit (Vitest) and e2e (Playwright + axe)
design/       reference-only Stitch mockups the UI was built from; not shipped code (see .stitch/DESIGN.md)
```

The three sides talk through one contract in `src/types.ts`: a `Frame` (RGBA pixels plus legend and provenance), `sampleColumn(frame, x, bands)` returns a `ColumnSample`, `mapToNotes(sample, mapping)` returns `NoteEvent[]`, and `AudioEngine.schedule(notes, time)` plays them. Stack: Vite, React 18, TypeScript in strict mode, Tailwind CSS v4, the Web Audio API with no audio library.

[`CONTEXT.md`](CONTEXT.md) records every design decision, [`.stitch/DESIGN.md`](.stitch/DESIGN.md) the visual design system, and [`PLAN.md`](PLAN.md) the build steps.

## Limitations

- The sound interprets an image. The app reads values back from a visualization at 0.5° resolution and averages them over wide latitude bands. Treat it as a way to explore, and go to the source datasets for measurements.
- Two records use one day per year (sea ice, sea surface temperature). Single days vary a lot from year to year, so two neighbouring frames tell you little about a trend.
- We dropped the 2003 and 2005 sea ice frames: their data coverage differs a lot from later years, which points to a change in the product.
- The GIBS colour scales are rainbow-like. We keep them because the legend has to describe the source image.
- The map uses an equirectangular projection, which stretches the poles. The text statistics weight each pixel by area to correct for this.
- Browsers only start audio after you press a key or click, so the app never plays sound on load. Hovering the map with the mouse never starts sound on its own.
- The app keeps up to 30 decoded frames (about 31 MB) in memory per session, because GIBS sends `Cache-Control: no-store`.
- Nobody has tested it with a real screen reader yet; the narration and ARIA follow the specs and pass axe.
- EIC records are pre-analysed copies of SVS frames (no live SVS fetch in the static app, because SVS allows cross-origin pixel reads for one partner site only). The prototype's live-video mode needs its local Node server and is not part of the static app (branch `feat/earth-jukebox-mvp`).
- On a slow phone network the orchestra for a record takes a while to arrive (Night Lights: about 37 s on throttled Fast 3G); Scientific plays meanwhile.

## Credits and license

Data comes from NASA SVS and NASA GIBS; orchestral samples are VS Chamber Orchestra 2 Community Edition (CC0). [`ATTRIBUTION.md`](ATTRIBUTION.md) lists every dataset, credit line, font and library, and [`NOTICE`](NOTICE) the files that came from the teammate prototype. Code is under the [Apache License 2.0](LICENSE). The app uses no NASA logos or insignia.
