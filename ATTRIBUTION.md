# Attribution

The app shows the same credits in its How to Listen sheet (open it from the header or press `?`), under "Sources and limits".

## Data: Earth Information Center records (NASA SVS)

The five "Earth Information Center" records play visualizations by NASA's Scientific Visualization Studio (SVS). Four of them are in the Earth Information Center gallery (https://svs.gsfc.nasa.gov/gallery/earth-information-center/); GEOS Aerosols (SVS 5552) is a NASA SVS visualization outside that gallery and is labelled "NASA SVS" only. Frames were downloaded from SVS by the teammate prototype's local server, analysed into a 64 x 32 grid, and committed as JPEG + features JSON in `public/eic/baked/`. NASA imagery is not subject to copyright in the United States; we follow NASA's media usage guidelines (credit, no logos, no endorsement).

| Record | SVS page | Credit line (as the SVS page asks) | Underlying data named on the SVS page |
|---|---|---|---|
| Night Lights 2012 → 2023 | [SVS 5313](https://svs.gsfc.nasa.gov/5313/) (EIC version; frames from [SVS 5276](https://svs.gsfc.nasa.gov/5276/)) | NASA's Scientific Visualization Studio. Visualizer: Kel Elkins (USRA). | Black Marble (VIIRS, Suomi NPP), NASA/NOAA; "NASA Earth Observatory images by Joshua Stevens, using Suomi NPP VIIRS data from Miguel Román, NASA GSFC." |
| Sea Surface Currents and Temperature | [SVS 3912](https://svs.gsfc.nasa.gov/3912/) | NASA/Goddard Space Flight Center Scientific Visualization Studio. Visualizations by Greg Shirah. | ECCO2 ocean model (NASA/JPL, MIT/JPL project; Hong Zhang, Dimitris Menemenlis); GTOPO30 (USGS). |
| GEOS Aerosols (Aug–Sep 2024) | [SVS 5552](https://svs.gsfc.nasa.gov/5552/) | NASA's Global Modeling and Assimilation Office and NASA's Scientific Visualization Studio. Visualizers: Joseph V. Ardizzone, Helen-Nicole Kostis. | GEOS-FP (NASA GMAO). The prototype also cited SVS 5669; that page is a different product (GEOS-FP 2 km replay, 19 Aug 2025) and is not used. |
| Lightning seen from the ISS (2019) | [SVS 5011](https://svs.gsfc.nasa.gov/5011/) | NASA's Scientific Visualization Studio. Visualizers: Michala Garrison, Greg Shirah, Kel Elkins, Alex Kekesi. | ISS Lightning Imaging Sensor (Blakeslee 2020, NASA GHRC DAAC); CPC cloud composite (NOAA CPC); Natural Earth Gray Earth (public domain); MCD12C1 MODIS land cover (Friedl & Sulla-Menashe, LP DAAC, doi:10.5067/MODIS/MCD12C1.006). |
| Air Quality, fire season 2024 | [SVS 5533](https://svs.gsfc.nasa.gov/5533/) | NASA's Scientific Visualization Studio and NASA's Global Modeling and Assimilation Office. Visualizers: Helen-Nicole Kostis, Joseph V. Ardizzone. | GEOS-CF (NASA GMAO); citation doi:10.5281/zenodo.16782803. |

Sonification grammar inspiration: NASA SVS 13786, "Data Sonification: Caldwell 73".

## Data: NASA GIBS records

All imagery for the five GIBS records comes from NASA's Global Imagery Browse Services (GIBS) through its public, keyless WMS endpoint (`https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi`). The bundled copies in `public/frames/` are unmodified PNG responses from that endpoint; `public/frames/manifest.json` lists the exact request URL and download date for each one.

> We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).

| Record | GIBS layer ID | GIBS layer title | Colormap |
|---|---|---|---|
| Fever Pitch | `MERRA2_2m_Air_Temperature_Monthly` | 2-meter Air Temperature (Monthly, MERRA2) | `colormaps/v1.3/MERRA2_2m_Air_Temperature_Monthly.xml` |
| Thin Ice | `GHRSST_L4_MUR25_Sea_Ice_Concentration` | Sea Ice Concentration (L4, MUR25, GHRSST) | `colormaps/v1.3/GHRSST_Sea_Ice_Concentration.xml` |
| Ocean Fever | `GHRSST_L4_MUR25_Sea_Surface_Temperature` | Sea Surface Temperature (L4, MUR25, GHRSST) | `colormaps/v1.3/GHRSST_Sea_Surface_Temperature.xml` |
| Green Pulse | `MODIS_Terra_L3_NDVI_Monthly` | Vegetation Index (L3, Monthly, MODIS, Terra) | `colormaps/v1.3/MODIS_L3_NDVI.xml` |
| Hazy Skies | `MERRA2_Total_Aerosol_Optical_Thickness_550nm_Extinction_Monthly` | Total Aerosol Optical Thickness Extinction 550nm (Monthly, MERRA2) | `colormaps/v1.3/MERRA2_Total_Aerosol_Optical_Thickness_550nm_Extinction_Monthly.xml` |

Colormap URLs are relative to `https://gibs.earthdata.nasa.gov/`. Copies live in `public/frames/colormaps/`.

### Map outlines

The coastline overlay comes from the GIBS layer `Coastlines_15m` (title "Coastlines (15m, OSM)").
Coastline data © OpenStreetMap contributors, available under the Open Database License (ODbL), https://www.openstreetmap.org/copyright. The app draws it for orientation only and never turns it into sound.

## Fonts

All four fonts ship with the app through Fontsource packages (`@fontsource/*`, version 5.3.0) and use the SIL Open Font License 1.1.

| Font | Copyright | Use |
|---|---|---|
| Libre Caslon Text | Copyright 2015 The Libre Caslon Text Project Authors | Headlines (record titles, sheet heading) |
| Hanken Grotesk | Copyright 2022 The Hanken Grotesk Project Authors | UI chrome: labels, buttons, chips, nav |
| Atkinson Hyperlegible | Copyright 2020 Braille Institute of America, Inc. | Long-form body text (accessibility override — see `.stitch/DESIGN.md`) |
| Atkinson Hyperlegible Mono | Copyright 2020-2024 The Atkinson Hyperlegible Mono Project Authors | Readouts and numbers |

Dropped: Bungee (previous display face, superseded by Libre Caslon Text in the 2026-11-14 UI redesign; see CONTEXT.md).

## Sounds

- **GIBS records** and the **Scientific** mode of the EIC records: no recordings. The Web Audio API synthesizes every sound in the browser (oscillators, filtered noise, FM bells, and reverb impulses generated by the code).
- **Orchestra** mode of the EIC records: recorded instruments from **VS Chamber Orchestra 2: Community Edition** by Versilian Studios (https://github.com/sgossner/VSCO-2-CE), released under **CC0-1.0** (public domain dedication). A 16 MB subset of 19 instruments (violins, cellos, violas, pizzicato, harp, double bass, horns, trumpet, flute, clarinet, glockenspiel, marimba, piano, timpani, kick, snare, shaker, cymbal, triangle; the percussion comes from the repository's "VSCO 1 Percussion" folders) was converted to mono 32 kHz WAV by the teammate prototype's `tools/build-samples.js`; `public/eic/samples/manifest.json` lists the source file of every note. No credit is legally required; we credit it anyway.
- The teammate prototype's rendered playlist (Opus/WebM, branch `feat/earth-jukebox-mvp`) is our own work, under this project's licence.

## Images and icons

The app contains no third-party images or icons besides the NASA GIBS and SVS imagery above. We drew the inline SVG icons (`src/ui/icons.tsx` and earlier transport controls), the vinyl records and the favicon ourselves for this project. The icon set intentionally does not use Google's Material Symbols font that appears in the Stitch reference designs (`design/reference/`); see `.stitch/DESIGN.md`.

## UI reference designs

Five AI-generated Stitch screens in `design/reference/` (Console Deck, Main Player, Mobile Telemetry Player, Track Library, How to Listen side sheet) were used as an untrusted layout/token/copy reference for the 2026-11-14 redesign — read, never executed, never copied verbatim into `src/`. Their embedded Tailwind config (colors, spacing, radii, type scale) is carried into `src/ui/theme.css`; see `.stitch/DESIGN.md`.

## Software

Runtime (shipped to the browser; React, React DOM and Scheduler are © Facebook, Inc. and its affiliates):

| Package | Version | License |
|---|---|---|
| react | 18.3.1 | MIT |
| react-dom | 18.3.1 | MIT |
| scheduler (dependency of react-dom) | 0.23.2 | MIT |
| @fontsource/libre-caslon-text, @fontsource/hanken-grotesk, @fontsource/atkinson-hyperlegible, @fontsource/atkinson-hyperlegible-mono | 5.3.0 | OFL-1.1 (fonts) |

Build and test tools (not shipped; Tailwind compiles to a plain CSS file at build time):

| Package | Version | License |
|---|---|---|
| tailwindcss, @tailwindcss/vite | 4.3.5 | MIT |
| vite | 8.3.8 | MIT |
| @vitejs/plugin-react | 6.3.0 | MIT |
| typescript | 6.0.3 | Apache-2.0 |
| vitest | 5.1.0 | MIT |
| @playwright/test, playwright-core | 1.63.0 | Apache-2.0 |
| @axe-core/playwright, axe-core | 4.14.0 | MPL-2.0 |
| eslint | 10.15.0 | MIT |
| @eslint/js | 10.0.1 | MIT |
| typescript-eslint | 8.72.2 | MIT |
| eslint-plugin-react-hooks | 7.1.1 | MIT |
| globals | 17.14.0 | MIT |
| pngjs | 7.0.0 | MIT |
| @types/node | 26.6.6 | MIT |
| @types/pngjs | 6.0.5 | MIT |
| @types/react | 18.3.31 | MIT |
| @types/react-dom | 18.3.7 | MIT |

## Code from the teammate prototype

`src/eic/vendor/` comes from the team's second prototype (branch `feat/earth-jukebox-mvp`), Copyright (c) 2026 NASA Space Apps Team, originally MIT and contributed to this project under Apache-2.0; see [`NOTICE`](NOTICE). The prototype has no third-party code dependencies.

## Disclaimer

Unofficial prototype built for NASA Space Apps Challenge. Not a NASA product. NASA does not endorse this project. The app uses no NASA logos or insignia.
