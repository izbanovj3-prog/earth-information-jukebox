# Attribution

The app shows the same credits in its "Sources and Limits" panel.

## Data

All imagery comes from NASA's Global Imagery Browse Services (GIBS) through its public, keyless WMS endpoint (`https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi`). The bundled copies in `public/frames/` are unmodified PNG responses from that endpoint; `public/frames/manifest.json` lists the exact request URL and download date for each one.

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

All three fonts ship with the app through Fontsource packages (`@fontsource/*`, version 5.3.0) and use the SIL Open Font License 1.1.

| Font | Copyright | Use |
|---|---|---|
| Bungee | Copyright 2023 The Bungee Project Authors (https://github.com/djrrb/Bungee) | Display headings |
| Atkinson Hyperlegible | Copyright 2020 Braille Institute of America, Inc. | Body text |
| Atkinson Hyperlegible Mono | Copyright 2020-2024 The Atkinson Hyperlegible Mono Project Authors | Readouts and numbers |

## Sounds

The app uses no recordings or samples. The Web Audio API synthesizes every sound in the browser: oscillators, filtered noise, and a reverb impulse that the code generates at start-up.

## Images and icons

The app contains no third-party images or icons besides the NASA GIBS imagery above. We drew the inline SVG icons, the vinyl records and the favicon ourselves for this project.

## Software

Runtime (shipped to the browser):

| Package | Version | License |
|---|---|---|
| react | 18.3.1 | MIT |
| react-dom | 18.3.1 | MIT |
| @fontsource/bungee, @fontsource/atkinson-hyperlegible, @fontsource/atkinson-hyperlegible-mono | 5.3.0 | OFL-1.1 (fonts) |

Build and test tools (not shipped):

| Package | Version | License |
|---|---|---|
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

## Disclaimer

Unofficial prototype built for NASA Space Apps Challenge. Not a NASA product. NASA does not endorse this project. The app uses no NASA logos or insignia.
