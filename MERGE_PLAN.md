# MERGE_PLAN — Earth Information Jukebox (A + B)

Phase 1 output. Read-only analysis: no app code was changed. Written 2026-11-14.

- **A** = this repo, `main` @ `dbdfe13` (React 18 + Vite + TS strict + Tailwind v4, NASA GIBS records).
- **B** = teammate patch applied as worktree `../jukebox-teammate`, branch `feat/earth-jukebox-mvp` @ `72f6b46` (on `3e6a441`). Vanilla JS, Node server, NASA SVS / EIC visualizations.

Goal: one product that scores higher on Impact, Creativity, Validity, Relevance and Presentation than either version alone.

Note: the brief mentions a HANDOFF section ("merge the best of both") in B. B contains no such section (searched every `.md` file and the patch). This plan follows the rules in the request instead.

---

## 1. How this was measured

Both apps were built (`npm run build` in A; B's existing `dist/` is newer than its sources) and served by **the same plain static file server** under `/earth-information-jukebox/`, the way GitHub Pages serves them. No Node API routes and no Vite preview. Then headless Chromium (Playwright 1.63) with CDP throttling:

- **Fast 3G**: 562.5 ms RTT, 180 KB/s down (Chrome DevTools preset). Viewport 390 × 844, DPR 2, mobile + touch.
- An `AudioContext` spy counts contexts created before and after the first click.
- A tap on every connection to `AudioDestinationNode` records the real output. "First sound" = first time the output RMS goes above 0.002 after the click.
- axe-core 4.14 (WCAG 2.0/2.1/2.2 A + AA) at 1280 px and 390 px, before and during playback.
- 20 s of real output from each app was recorded to WAV, and objective metrics were computed from it.

**About listening.** I can't hear audio, so I didn't judge the sound by ear. The judgement below rests on the recorded output's measurable properties. The WAVs are saved here so you can listen and confirm before approving (scratchpad, temporary):
- `C:\Users\User\AppData\Local\Temp\claude\b04268289c19c037\757e8f5f-cd51-4fe7-9bd4-b97955be17a0\scratchpad\audio\A-feverpitch.wav`
- `C:\Users\User\AppData\Local\Temp\claude\b04268289c19c037\757e8f5f-cd51-4fe7-9bd4-b97955be17a0\scratchpad\audio\B-nightlights-orchestra.wav`
- `C:\Users\User\AppData\Local\Temp\claude\b04268289c19c037\757e8f5f-cd51-4fe7-9bd4-b97955be17a0\scratchpad\audio\B-nightlights-science.wav`

### 1.1 First load at 390 px on Fast 3G (static host)

| Metric | A | A, GIBS blocked | B, Orchestra (default) | B, Scientific |
|---|---|---|---|---|
| DOMContentLoaded | 2.9 s | 2.9 s | 2.6 s | 2.6 s |
| Play button usable | 7.8 s | 6.6 s | 10.0 s | 10.5 s |
| Bytes before first click | 586 KB | 665 KB | 1,137 KB | 1,137 KB |
| AudioContext before any click | 0 | 0 | 0 | 0 |
| **First sound after clicking Play** | **0.4 s** | 0.7 s | **94.7 s** | 0.75 s |
| Total transferred, session | 586 KB / 14 req | 829 KB / 16 req | **17.2 MB / 136 req** | 1.2 MB / 31 req |
| Horizontal scroll at 390 px | no | no | no | no |
| Console errors | 0 | 2 (the blocked GIBS requests, expected) | 0 | 0 |

- **Audio starts only after a click in both apps**: 0 contexts before the gesture, 1 after.
- **B's default mode costs 95 s of silence on Fast 3G.** It downloads 16 MB of uncompressed 32 kHz WAV samples (19 instruments) on the first Play. Unthrottled it takes 1.0 s. The status line shows "Loading orchestra samples… i of n", so the app does say what is happening. On a phone in a judging room this is the single biggest risk in either version.
- A's map arrives from GIBS live or from bundled frames; blocking GIBS costs nothing visible except a banner.

### 1.2 Static hosting without the Node server

| | A | B |
|---|---|---|
| Works as plain static files under a sub-path | Yes (`base: './'`). Live GIBS fetch with fallback to bundled frames. | Yes, via `tools/build-static.js`: baked JPEG frames + features JSON (`assets/baked`, 7 MB). Verified with the per-frame values in its README. |
| Needs the server for | nothing | **Live video** only (SVS lets one partner origin read video pixels). Hidden on the static build with a note. Bake and playlist rendering are authoring tools that also need it. |
| Deployed now? | No. `https://izbanovj3-prog.github.io/earth-information-jukebox/` returns **404**. | Same URL in its README; not deployed. |

### 1.3 Sound (recorded, 20 s, unthrottled)

| Clip | RMS | Peak | Clipping | Onsets/s | Spectral centroid | Stereo corr. |
|---|---|---|---|---|---|---|
| A, Fever Pitch (default volume 35 %) | −31.9 dBFS | −19.7 dBFS | 0 | 0.1 | 475 Hz | 0.89 |
| B, Night Lights, Orchestra | −21.3 dBFS | −4.9 dBFS | 0 | 1.7 | 1,373 Hz | 0.95 |
| B, Night Lights, Scientific | −23.2 dBFS | −6.5 dBFS | 0 | 0.6 | 892 Hz | 0.89 |

What this says: A's default output is about 10 dB quieter, darker (centroid 475 Hz) and almost free of distinct attacks. It is a smooth, drone-like texture. B's Orchestra mode has clear rhythmic events (kick/snare/harp onsets), harmony and a brighter, louder mix, and it still doesn't clip. On the challenge's own terms ("balance between data interpretation and musically pleasing output") **B's Orchestra is the stronger listening experience**. A's mapping is the more *validated* one: values come back through each GIBS layer's own colormap, accents are calibrated, and the drone exaggeration is disclosed. Your ears decide the final call (see Open decision D2).

### 1.4 Accessibility (automated)

| Check | A | B |
|---|---|---|
| axe WCAG 2.2 AA, 1280 + 390, idle + playing | 0 violations | 0 violations |
| Skip link, `lang`, single h1 | yes | yes |
| Live regions | 1 (`narrator`) | 3 (`#status`, `#narration`, `#render-out`), so it can get chatty |
| Keyboard play / explore / step / describe | Space, E + arrows, `,` `.`, `[` `]`, D, M, `?` | Space/K, E + arrows, N/P, D, 1–5, T |
| Explore by ear | yes | yes (verified: "3°S, 8°E, Africa: Faint lights, intensity 8 percent.") |
| Frame description | yes (area-weighted stats) | yes (verified: aerosol load, strongest regions) |
| Timeline as an ARIA slider with dates | scrubber | yes (`aria-valuetext="2012, frame 1 of 12"`) |
| Trend data table for screen readers | no | yes (13 rows for 12 frames) |
| Light colour scheme | dark only | light + dark |
| Real screen-reader session | none in either | none in either |

### 1.5 Tests

| | A | B |
|---|---|---|
| Unit | 87 / 87 pass (Vitest, 0.6 s) | none |
| E2E + axe | 21 / 21 pass (Playwright, 15 s) | none |

---

## 2. Comparison by area

| Area | A | B | Better, and why (from running) |
|---|---|---|---|
| **Sound engine** | Web Audio synth: 3 latitude-band voices, pitch = value via colormap, bells at extremes, drone vs. first frame, look-ahead scheduler. Quiet, gentle, accurate. | Two modes. **Orchestra**: CC0 sampled chamber orchestra, colour → section, tempo/key per dataset, melody, bass, groove. **Scientific**: per-dataset synth rules. Mixer per layer. Deterministic seeded jitter. | **B for musicality and creativity** (louder, rhythmic, harmonic; 1.7 vs 0.1 onsets/s). **A for validity of the value mapping.** They complement each other: keep both engines. |
| **NASA data and frames** | 5 GIBS records, 58 frames, colormap-inverted to physical units (°C, %, NDVI, AOT). Live GIBS + bundled fallback. Calibration notes (sea ice 2003/05 dropped). | 5 SVS visualizations, 54 dated frames. **4 of 5 are in the EIC gallery** (5313, 5011, 5533, 3912; aerosols 5552 is not). Colour-key CV on a 64 × 32 grid. Lightning dates *measured*. | **B for Relevance**: the challenge asks for EIC frames, and A's GIBS layers are EIC-adjacent, not EIC items. **A for Validity** (true units). They complement each other: keep all 10. |
| **UI and accessibility** | Stitch console design, record rail, library, How-to-Listen sheet, demo tour, URL state, CSP. axe clean. **Issue found:** at 390 px the fixed transport covers the bottom ~third of the map. | Clean light/dark single page, timeline, trend chart + table, mixer, meter, narration with chord names. axe clean. 3 live regions. | **A as the shell** (design, tour, library, tests). **Port from B:** trend chart + table, mixer, timeline ticks. Fix A's 390 px overlap. |
| **Static hosting** | Works; 586 KB; sound 0.4 s after click on 3G. | Works; 17 MB; **95 s to first sound on 3G** in default mode. | **A's loading model.** Port B's orchestra *with* lazy, compressed samples (see P0-4). |
| **Playlist / docs / story** | README, ATTRIBUTION, DEMO (90 s script + 200-word summary), CONTEXT. No audio files. | **10-file playlist** (5 datasets × 2 modes, Opus/WebM, 14 MB, plays: verified), **WAV export** (verified: orchestra 30 s, scientific 169 s for a 99 s track), **docs/STORY.md** (strong "why" document). | **B.** The challenge explicitly allows "a curated collection of audio files" and asks to "document the why". Keep the playlist, WAV export and STORY.md. |
| **Demo video and slides** | DEMO.md: scripted 90 s tour that runs in-app. | None (README: Video TODO; "Presentation: see docs/" has no slides). | Neither has a video or slides. A's in-app tour is the base; extend it with 2–3 EIC/orchestra steps. |
| **Tests** | 87 unit + 21 e2e + axe. | none | **A.** New ported features get e2e coverage. |
| **Licence / compliance** | Apache-2.0, disclaimer, no NASA logos, CSP. | MIT; "NASA does not endorse"; **favicon is a NASA-blue (#0b3d91) circle with a white swoosh**, which reads like the NASA insignia. | A's licence and disclaimer. Drop B's favicon. Licence choice: see D1. |

---

## 3. Recommendation

**Base: A.** B's sound and data come in as an "EIC Visualizations" collection next to A's "GIBS Data Records", in one interface.

Why A and not B:
- A already has the test harness, the typed contract, CSP, the axe suite, the demo tour, the library and the design system. Rebuilding any of that in B would take more than the day we have.
- B's engine is self-contained ES modules (`analyze.js`, `engine.js`, `orchestra.js`, `datasets.js`, `webm.js`, ~1,900 lines) with no dependencies. They can be vendored almost unchanged behind a thin typed adapter, which is far cheaper than porting A's React UI into vanilla JS.
- Nothing is dropped. Every B feature has a slot in the list below, and the Node server stays as the authoring tool (bake / render / live video).

### Port list (one day ≈ 10–11 focused hours)

| # | Item | From | Effort | Priority |
|---|---|---|---|---|
| P0-1 | Vendor B's engine modules into `src/eic/` (allowJs + `.d.ts` shims), static mode only; baked frames + features to `public/eic/` | B | 2.0 h | must |
| P0-2 | Adapter: SVS records appear in the record rail, library and URL state as a second collection (10 records). Transport, explore, D (describe) and narration route to the active engine | A+B | 2.0 h | must |
| P0-3 | Mode switch Orchestra / Scientific in Sound settings for EIC records | B | 0.5 h | must |
| P0-4 | **Fix sample weight**: load only the families the current dataset uses (`familiesUsed` already exists), play Scientific instantly and crossfade to Orchestra when samples are ready, with a progress line. Optional: Opus re-encode with WAV fallback | new | 1.5 h | must |
| P0-5 | CSP: `media-src 'self'` (the playlist `<audio>` is blocked by today's `'none'`) | A | 0.1 h | must |
| P0-6 | Fix 390 px: the transport must not cover the map (compact bar or reserve bottom padding) | A | 0.5 h | must |
| P0-7 | ATTRIBUTION.md, in-app sources, README, licence headers (section 4) | both | 0.7 h | must |
| P1-1 | Playlist view: 10 WebM tracks + "Export WAV" for the current record | B | 1.0 h | should |
| P1-2 | Trend chart + data table in the side panel (both collections; A already computes per-frame stats) | B | 1.5 h | should |
| P1-3 | Mixer (layer mute + activity lights) for EIC records | B | 0.8 h | should |
| P1-4 | e2e: EIC record plays after a click, mode switch, playlist present, axe on new views, 390 px overlap check | A | 1.2 h | should |
| P1-5 | Merge docs: STORY.md (B) + "how you hear the data" (A); DEMO tour +3 steps (EIC Night Lights orchestra, mixer solo, playlist) | both | 1.0 h | should |
| P1-6 | GitHub Pages workflow adapted to `npm ci && npm run build` → `dist/` (ready, **not pushed**) | B | 0.4 h | should |
| P2-1 | Light colour scheme from B | B | 1.5 h | if time |
| P2-2 | Live video (local server only), documented as local-only | B | 1.0 h | if time |
| P2-3 | Orchestra mode for GIBS records | new | 2–3 h | after D3 |

**Must: about 7.3 h. Should: about 5.9 h.** Total ≈ 13 h, which is over one day. I'll do the P0 items in order and stop the P1 items at the time box. P1-1 (playlist) and P1-4 (tests) come first among the "should" items because they carry the most score per hour.

---

## 4. Licences and attribution (B assets)

| Asset in B | Licence / status | Required credit |
|---|---|---|
| Orchestral samples, `src/public/samples/` (16 MB, 19 instruments: violins, cellos, violas, pizz, harp, bass, horns, trumpet, flute, clarinet, glock, marimba, piano, timpani, kick, snare, shaker, cymbal, triangle) | **CC0-1.0**: VS Chamber Orchestra 2 Community Edition, Versilian Studios (github.com/sgossner/VSCO-2-CE). Drums, wood and metal percussion come from the "VSCO 1 Percussion" folders inside the same CC0 repo. | Not legally required. Credit anyway: "Orchestral samples: VS Chamber Orchestra 2: Community Edition, Versilian Studios, CC0." |
| Night Lights frames (SVS 5313, EIC version; frames via SVS 5276) | NASA media, not copyrighted in the US; follow NASA Reproduction Guidelines (no logos, no endorsement). | "NASA's Scientific Visualization Studio." Visualizer Kel Elkins (USRA). Data: Black Marble / Suomi NPP VIIRS, NASA/NOAA. |
| Sea Surface Currents & Temperature (SVS 3912) | NASA media. | "NASA/Goddard Space Flight Center Scientific Visualization Studio." Greg Shirah et al. Data: ECCO2 (NASA/JPL, MIT/JPL project); GTOPO30 (USGS, public domain). |
| GEOS Aerosols (SVS 5552) | NASA media. | "NASA's Global Modeling and Assimilation Office and NASA's Scientific Visualization Studio." Data: GEOS-FP (NASA GMAO). **Fix:** B's README also cites SVS 5669, which is a *different* product (GEOS-FP 2 km replay, 19 Aug 2025). Cite only 5552. |
| ISS Lightning (SVS 5011, EIC) | NASA media; contains third-party basemap layers. | "NASA's Scientific Visualization Studio." Data: ISS LIS (GHRC DAAC; Blakeslee 2020); CPC Cloud Composite (NOAA CPC); **Natural Earth Gray Earth (public domain)**; MCD12C1 MODIS land cover (Friedl & Sulla-Menashe, LP DAAC, doi:10.5067/MODIS/MCD12C1.006). |
| Air Quality Model Runs (SVS 5533, EIC) | NASA media. | "NASA's Scientific Visualization Studio and NASA's Global Modeling and Assimilation Office." Data: GEOS-CF (NASA GMAO). Citation DOI 10.5281/zenodo.16782803. |
| Baked JPEGs + features (`assets/baked/`) | Derived from the SVS items above; same credits. | as above |
| Playlist WebM (10 files) | Our own renders of NASA-derived data with CC0 samples. Same licence as the project, or CC BY 4.0 for the audio (D5). | Credit the source visualizations per track. |
| Fonts | None. B uses system fonts only. | — |
| Icons | Unicode glyphs; inline SVG favicon. **The favicon looks like the NASA insignia (NASA blue #0b3d91, circle + swoosh). Drop it** and use A's own favicon. | — |
| Code (`webm.js`, `tiff.js`, `png.js`, server) | Original teammate code ("no dependencies"), MIT. | Keep the MIT notice for these files, or relicense (D1). |

**Submission "References" field (draft):**
NASA GIBS (ESDIS) and its 5 layer IDs (already in ATTRIBUTION.md) · NASA SVS 5313, 5276, 3912, 5552, 5011, 5533 · NASA Earth Information Center gallery (svs.gsfc.nasa.gov/gallery/earth-information-center/) · Black Marble VIIRS, ECCO2, GTOPO30, GEOS-FP, GEOS-CF, ISS LIS (GHRC DAAC), CPC Cloud Composite, MCD12C1, Natural Earth · OpenStreetMap coastlines (ODbL, via GIBS) · VSCO-2-CE (CC0) · Fontsource fonts (OFL-1.1) · React, Vite, Tailwind (MIT) · SVS 13786 (Caldwell 73 sonification, inspiration) · Disclaimer: "Unofficial prototype built for NASA Space Apps Challenge. Not a NASA product."

---

## 5. Open decisions (for you)

- **D1 Licence.** The merged repo is Apache-2.0 (A, "as required"); B's code is MIT. Option (a): your teammate agrees to relicense to Apache-2.0. Option (b): keep MIT headers on the vendored files and list them in a NOTICE. Both are legal; (a) is cleaner.
- **D2 Default sound for EIC records.** Recommended: Orchestra, with instant Scientific until samples load (P0-4). Listen to the three WAVs above first.
- **D3 Orchestra for GIBS records too?** One grammar across 10 records would be a strong Creativity story, but it would blur A's calibrated units. Recommended: not before the deadline.
- **D4 Landing record.** EIC Night Lights in Orchestra (most striking, directly EIC) or A1 Fever Pitch (most validated). Recommended: Night Lights.
- **D5 Audio licence for the playlist.** Project licence or CC BY 4.0.
- **D6 Aerosols (SVS 5552)** is not in the EIC gallery. Keep it with an honest "NASA SVS" label (recommended), or drop it.
- **D7 Live video.** Keep as a local-only feature behind the Node server (documented), or leave it out of the merged repo.
- **D8 Deploy.** The merge will produce a Pages workflow; pushing and enabling Pages need your approval. Also fill in the team name, location and members (TODOs in B's README).

### Decisions taken (2026-11-14, approved by the team lead)

- **Base: A**, plan as recommended. Work happens on branch `merge/best-of-both`. The must-do items come first, then we stop for review.
- **D1** Apache-2.0 for the whole project. The teammate's copyright notices stay on the files that came from B (the team lead is confirming this with him).
- **D2** EIC records start in **Scientific** (instant). **Orchestra** switches in once the instruments that record needs have loaded, with a visible loading state. The user's mode choice is remembered.
- **D3** (default) No orchestra for GIBS records before the deadline.
- **D4** Open on the first-listed B gallery visualization, **Night Lights 2012 → 2023 (SVS 5313)**, unless the team lead says otherwise.
- **D5** (default) Playlist audio uses the project licence (Apache-2.0); per-track source credits.
- **D6** (default) Keep Aerosols (SVS 5552), labelled "NASA SVS", not "EIC".
- **D7** (default) Live video stays local-only. It isn't shipped in the static build and is documented as such.
- **D8** `main` and `feat/earth-jukebox-mvp` were pushed to origin as a backup. **No deploy.**

---

## 6. Repo hygiene noticed

- A's `main` is 5 commits ahead of `origin/main` (the whole Tailwind redesign is unpushed).
- Untracked in A from the previous session: `_measure.mjs`, `_test-b-features.mjs`, `_test-b-gesture.mjs`. They are throwaway probes; delete them or move them to `scripts/` when we start.
- Still running from the previous session: B's server on :8000 and two old `vite preview` processes (:4322, :4333).

---

## 7. Progress: must-do items (branch `merge/best-of-both`, stopped for review)

| Item | Status | Evidence |
|---|---|---|
| Fix the 95 s orchestra load | Done (D2) | Play is instant in Scientific; only the instruments a record needs are fetched; Orchestra takes over mid-sweep; choice remembered |
| CSP for `<audio>` | Done | `media-src 'self'`; e2e checks the built meta tag |
| Playback bar covering the map at 390 px | Done | Compact phone transport + "More controls"; e2e asserts map bottom ≤ bar top on both players (failed on the old bar: 562 > 547) |
| NASA-like favicon | Done | The B favicon was not carried over; e2e guards against `#0b3d91` and checks the project icon |
| Aerosols citation | Done | SVS 5669 removed from the credit; ATTRIBUTION explains why |
| P0-1/2/3 EIC records in one interface | Done | Rail, library, URL (`eic-<id>`), keyboard, explore, narration, How-to-Listen sheet |
| P0-7 ATTRIBUTION, NOTICE, README, CONTEXT | Done | SVS credit lines and underlying data, CC0 samples, teammate code notice |

**Merged build, plain static host, 390 px, Fast 3G (same harness as section 1):**

| Metric | B (before) | Merged, opens on EIC Night Lights | Merged, GIBS Fever Pitch |
|---|---|---|---|
| Bytes before first click | 1,137 KB | 704 KB | 663 KB |
| Play usable | 10.0 s | 8.7 s | 7.7 s |
| AudioContext before click | 0 | 0 | 0 |
| **First sound after Play** | **94.7 s** | **0.38 s** (Scientific) | 0.71 s |
| Orchestra takes over | 94.7 s | 38.7 s after Play, while sound already plays | n/a |
| Total transferred | 17.2 MB | 7.9 MB (6.6 MB of it the Night Lights instruments) | 663 KB |
| Horizontal scroll / console errors | no / 0 | no / 0 | no / 0 |

Tests at the last commit: 100 unit (Vitest), 33 e2e (Playwright + axe), typecheck and lint clean.
Not done yet: should-do items (playlist, WAV export, trend chart + table, mixer, STORY.md, Pages workflow). Optional speed-up not done: Opus-encoded samples would cut the orchestra download roughly 8x, but need a WAV fallback for Safari and a check of loop points.
