# Earth Information Jukebox

> Hear the planet change: an interactive jukebox that pairs NASA Earth Information Center visualizations with real-time sonifications, so Earth science can be seen *and* heard.

Project for the [NASA International Space Apps Challenge](https://www.spaceappschallenge.org/).

## Challenge

- **Challenge title:** Earth Information Jukebox
- **Challenge link:** [The Earth Information Jukebox (2026)](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/)
- **Full challenge text:** [`docs/CHALLENGE.md`](docs/CHALLENGE.md)
- **Team name:** _TODO_
- **Location / Virtual:** _TODO_

## Problem

NASA's Earth Information Center (EIC) visualizations show how our planet is changing, but they are almost purely visual. That excludes blind and low-vision users and limits how the public can explore complex Earth science. Sonification (turning data into non-speech sound) can make it accessible, multi-sensory and emotionally engaging.

## Our Solution

**Earth Jukebox** is a web app. You pick an EIC visualization; the app fetches its frames live from NASA's Scientific Visualization Studio (SVS), analyses every frame with simple computer vision, and **plays it in real time** while a playhead sweeps the map. There are two ways to listen:

- **Orchestra mode** (default): every colour on the map has its own section of a real sampled chamber orchestra (blue → strings, green → woodwinds, yellow → harp, orange → horns, red → trumpets, violet → violas, white → piano and glockenspiel). It plays at a steady tempo, with chord progressions chosen by the data's mood, a melody that follows the strongest colour, a double-bass line and a groove that gets busier where the data is busier.
- **Scientific mode**: a direct synth mapping per dataset, where every value is audible.
- **Live video**: the real NASA animation plays, and the music follows it frame by frame.

- **One sound grammar for every map:** west → east is time (a sweep of 5, 8 or 12 seconds per frame) and stereo position (left → right). Latitude is pitch (north = high). Amount is loudness and note density. Each frame gets its own sweep, so you hear change over time.
- **Five datasets, 54 dated frames, each with its own set of instruments:**

  | Visualization | Frames | What it sounds like |
  |---|---|---|
  | **Night Lights 2012 → 2023** | every year, 2012–2023 | plucked city lights, bells where light grew, a chord that fills in as the planet brightens |
  | **Sea Surface Currents & Temperature** | ~monthly, Mar 2007 – Mar 2008 | warm and cold water as rising and falling pads; turbulence as vibrato and droplets |
  | **GEOS Aerosols** | every ~5 days, Aug 1 – Sep 14, 2024 | dust, smoke, sea salt and sulfate each get an instrument; heavy air turns the harmony minor |
  | **ISS Lightning** | every month of 2019 | flashes become percussion and thunder; frames are sampled live from the SVS video |
  | **Air Quality, fire season 2024** | every ~9 days, Jul – Aug 2024 | CO brass, PM2.5 crackle, NOx pulse, ozone glass; the instrument changes with each pollutant strip |

- **Real dates on every frame**, taken from each SVS page's published time range. For the lightning video, the dates were *measured*: the share of flashes in the Northern Hemisphere peaks seven times, once for each summer from 2017 to 2023. See [`docs/STORY.md`](docs/STORY.md#where-the-dates-come-from).
- **Timeline and trend chart:** a date timeline you can scrub (also a keyboard slider), plus a chart of one key number per frame, with a data table.
- **Mixer:** each visual layer is a separate instrument with an activity light. Mute layers to hear, say, only the dust.
- **Accessibility first:** full keyboard control, live spoken narration of what you hear (ARIA live region), an **explore-by-ear map** (arrow keys play and announce any place), generated alt text and long descriptions for every frame, reduced-motion and light/dark support.
- **Curated playlist:** the same engine renders every soundscape offline, in both modes, as Opus/WebM ([`assets/playlist/`](assets/playlist/)), identical to the live version. The page can also export any visualization to WAV.

The reasoning behind every mapping is in **[`docs/STORY.md`](docs/STORY.md)**.

## NASA Data & Resources Used

| Dataset | Source | How we use it |
|---|---|---|
| Change in Night Lights 2012–2023 (EIC) | [SVS 5313](https://svs.gsfc.nasa.gov/5313/) / [SVS 5276](https://svs.gsfc.nasa.gov/5276/) frames | all 12 yearly 8K "only lights" frames, 2012–2023 |
| Global Sea Surface Currents and Temperature (ECCO2) | [SVS 3912](https://svs.gsfc.nasa.gov/3912/) | 12 frames of the 2048×1024 flat animation, Mar 2007 – Mar 2008 |
| GEOS Aerosols | [SVS 5669](https://svs.gsfc.nasa.gov/5669/), frames from [SVS 5552](https://svs.gsfc.nasa.gov/5552/) | 10 frames, Aug 1 – Sep 14, 2024; four aerosol types separated by colour |
| Lightning Events Detected from the ISS 2017–2023 | [SVS 5011](https://svs.gsfc.nasa.gov/5011/) | 12 monthly frames of 2019, sampled live from the Science On a Sphere MP4 |
| Air Quality Model Runs (GEOS-CF) | [SVS 5533](https://svs.gsfc.nasa.gov/5533/) | 8 frames of the 5760×3240 labelled map, July–August 2024 |
| Data Sonification: Caldwell 73 | [SVS 13786](https://svs.gsfc.nasa.gov/13786/) | Inspiration for the "latitude = pitch, brightness = volume" grammar |

All imagery is by the NASA Scientific Visualization Studio. NASA does not endorse this project.

## Tech Stack

- **Zero dependencies.** Plain HTML, CSS and JavaScript (ES modules), and Node.js ≥ 18 built-ins only.
- **Web Audio API** for synthesis (oscillators, FM bells, filtered noise, convolution reverb) and a sample player, plus **OfflineAudioContext** for rendering tracks.
- **Orchestral samples**: a 16 MB subset of [VS Chamber Orchestra 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) (CC0, public domain), with 19 instruments. `tools/build-samples.js` downloads the notes, detects their real pitch (VSCO folders use different octave conventions), and writes mono 32 kHz WAVs to `src/public/samples/`.
- **WebCodecs** (`AudioEncoder`, Opus) plus a tiny WebM muxer (`js/webm.js`) for the compact playlist files.
- **Canvas** for frame analysis (64 × 32 grid per frame).
- **Node server** (`src/server.js`) that:
  - proxies NASA SVS, because SVS only allows cross-origin pixel access for one partner site, so a browser can't read the pixels directly;
  - decodes SVS **TIFF** frames (8/16-bit, LZW/Deflate) and huge **PNG** frames (e.g. 5760×3240) and downsizes them to 1024 px with its own small decoders;
  - streams SVS **MP4s** with HTTP Range support;
  - caches everything in `data/raw/svs-cache/`.

## Getting Started

You need [Node.js](https://nodejs.org/) 18 or newer. There is nothing to install.

```bash
git clone https://github.com/izbanovj3-prog/earth-information-jukebox.git
cd earth-information-jukebox
npm start
```

Open **http://localhost:8000**. The first load of a dataset downloads its full-resolution frames from NASA SVS (Night Lights ≈ 110 MB of 8K TIFFs, Air Quality ≈ 100 MB of PNGs, so allow a minute or two, four frames in parallel). After that everything comes from the local cache and also works offline. Tip: open each visualization once before a demo.

### Hosted version (GitHub Pages)

Judges and listeners don't need Node: the static build at **https://izbanovj3-prog.github.io/earth-information-jukebox/** has every dataset, both sound modes, the map explorer, WAV export and the playlist. Its frames were downloaded from NASA SVS and analysed in advance, so it sounds exactly like the local version (verified: identical per-frame values). Only **Live video** needs the local server, because NASA SVS lets just one partner site read video pixels in the browser.

To update it:

1. With `npm start` running, open **http://localhost:8000/bake.html** and click **Bake all datasets**. It writes display JPEGs and the analysed features to `assets/baked/` (~7 MB, committed).
2. `npm run build` packs `src/public` + `assets/baked` + `assets/playlist` into `dist/` (not committed); `npm run preview` serves it at http://localhost:8001/earth-information-jukebox/ like GitHub Pages does.
3. Push to `main`. The workflow in `.github/workflows/pages.yml` builds and publishes `dist/`. One-time setup: repository **Settings → Pages → Source: GitHub Actions**.

### Playlist and samples

To re-render the playlist, keep the server running, open **http://localhost:8000/render.html** in Chrome or Edge (Opus encoding needs WebCodecs) and click **Render all tracks**. The tracks are written to `assets/playlist/`. To rebuild the orchestral samples, run `node tools/build-samples.js` (it downloads ~100 MB from GitHub once and caches it in `data/raw/vsco-cache/`).

### Keyboard

| Key | Action |
|---|---|
| Space / K | Play / pause |
| N / P | Next / previous frame |
| D | Describe what is playing now |
| 1–5 | Switch visualization |
| E | Explore the map by ear (arrows move, Shift = bigger steps, Esc leaves) |
| T | Jump to the timeline (arrows step through dated frames; in live video they skip 5%) |

## Repository Structure

```
src/server.js         local server: static files, SVS proxy + cache, TIFF->PNG, video range proxy, playlist save
src/lib/tiff.js       minimal TIFF decoder with box-filter downscaling
src/lib/png.js        minimal PNG decoder/encoder + downscaler
src/public/           the web app
  index.html          jukebox UI
  render.html         offline playlist renderer
  bake.html           pre-analyses all frames for the static site
  js/env.js           local server vs static (GitHub Pages) mode
  js/datasets.js      dataset manifest: SVS frame URLs, crops, descriptions
  js/analyze.js       frame loading + computer vision (colour keys -> data grids)
  js/engine.js        synths + sampler, Scientific-mode mapping per dataset, live player, WAV export
  js/orchestra.js     Orchestra mode: colour -> section, chords, melody, bass, groove
  js/webm.js          Opus/WebM encoder for the playlist (WebCodecs)
  js/ui.js            UI, live video, timeline, trend chart, mixer, narration, map explorer
  samples/            CC0 orchestral samples (VSCO 2 CE subset) + manifest.json
tools/build-samples.js  rebuilds src/public/samples from VSCO-2-CE
tools/build-static.js   builds dist/ for GitHub Pages; tools/preview-static.js serves it locally
.github/workflows/pages.yml  publishes dist/ on every push to main
assets/baked/         pre-analysed frames (JPEG + features JSON) for the static site
assets/playlist/      rendered soundscapes, both modes (.webm) + playlist.json
data/raw/svs-cache/   cached frames (not committed)
docs/                 challenge text, project plan, STORY.md (method and artistic choices)
```

## Demo

- Live demo: https://izbanovj3-prog.github.io/earth-information-jukebox/ (after the first deploy; live video: run locally)
- Video: _TODO_
- Presentation: see [`docs/`](docs/)

## Team

| Name | Role | Contact |
|---|---|---|
| _TODO_ | _TODO_ | _TODO_ |

## Acknowledgements

Built with open data and visualizations from the NASA Scientific Visualization Studio and NASA's Earth Information Center. Sonification approach inspired by NASA's data sonification work. Orchestral samples: VS Chamber Orchestra 2: Community Edition by Versilian Studios (CC0).

## License

[MIT](LICENSE)
