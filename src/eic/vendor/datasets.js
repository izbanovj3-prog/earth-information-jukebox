// Copyright (c) 2026 NASA Space Apps Team (teammate prototype, originally MIT).
// Part of this project under Apache-2.0 (see LICENSE and NOTICE). Source: branch
// feat/earth-jukebox-mvp, src/public/js/datasets.js. Vendored with minimal changes, each marked "MERGE:".
// Dataset manifest: which NASA SVS frames we load, real dates for each frame,
// where the map sits inside the frame, mixer layers, and the plain-language text
// used for screen readers and the "What you hear" panel.
//
// Dates come from the "time range" / "dates used" published on each SVS page
// (see docs/STORY.md, "Where the dates come from").

const NL_DIR = '/vis/a000000/a005200/a005276/frames/7680x4320_16x9_3p/nightlights_flat_2012-2023_only_lights/';
const OCEAN_DIR = '/vis/a000000/a003900/a003912/frames/2048x1024_1x1_30p/orig/';
const AER_DIR = '/vis/a000000/a005500/a005552/frames/2048x1024_2x1_30p/NoLabels/';
const AQ_DIR = '/vis/a000000/a005500/a005533/frames/5760x3240_16x9_30p/AirQuality_MapWithLabels/';
const LTG = '/vis/a000000/a005000/a005011/';

const DAY = 86400000;
const pad4 = (n) => String(n).padStart(4, '0');
const fmtDay = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const fmtMonth = (t) => new Date(t).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const spread = (n, a, b) => Array.from({ length: n }, (_, k) => a + ((b - a) * k) / (n - 1));

// ECCO2 frames 23000..31000 (every 4th exists) span 2007-03-25T12Z .. 2008-03-03T12Z (SVS 3912)
const OCEAN_T0 = Date.UTC(2007, 2, 25, 12), OCEAN_T1 = Date.UTC(2008, 2, 3, 12);
const oceanFrames = spread(12, 23000, 31000).map((x) => {
  const n = 23000 + 4 * Math.round((x - 23000) / 4);
  const t = OCEAN_T0 + ((n - 23000) / 8000) * (OCEAN_T1 - OCEAN_T0);
  return { label: fmtDay(t), date: iso(t), src: `${OCEAN_DIR}flat_global_ecco2_2028x1024.${n}.tif` };
});

// GEOS aerosols: 2206 frames from Aug 1 to Sep 14, 2024 (SVS 5552)
const AER_T0 = Date.UTC(2024, 7, 1), AER_T1 = Date.UTC(2024, 8, 14);
const aerosolFrames = spread(10, 0, 2205).map((x) => {
  const i = Math.round(x);
  const t = AER_T0 + (i / 2205) * (AER_T1 - AER_T0);
  return { label: fmtDay(t), date: iso(t), src: `${AER_DIR}Aerosols_NoLabels_2048x1024_30fps_${pad4(i)}.png` };
});

// GEOS-CF air quality: 1800 frames covering July–August 2024 (SVS 5533), dates approximate
const AQ_T0 = Date.UTC(2024, 6, 1), AQ_T1 = Date.UTC(2024, 7, 31);
const airFrames = spread(8, 0, 1799).map((x) => {
  const i = Math.round(x);
  const t = AQ_T0 + (i / 1799) * (AQ_T1 - AQ_T0);
  return { label: `≈ ${fmtDay(t)}`, date: iso(t), src: `${AQ_DIR}AirQuality_WithLabels_5760x3240_${pad4(i)}.png` };
});

// ISS LIS lightning video (100 s): we measured the northern-hemisphere share of flashes in 32 samples.
// It peaks 7 times (the 7 northern summers 2017–2023), giving: fraction = 0.159 + 0.1253 * years since 2017-07-25.
const LTG_REF = Date.UTC(2017, 6, 25);
const lightningMonths = Array.from({ length: 12 }, (_, m) => Date.UTC(2019, m, 15));
const lightningSamples = lightningMonths.map((t) => +(0.159 + 0.1253 * ((t - LTG_REF) / (365.25 * DAY))).toFixed(4));
const LTG_START = Date.UTC(2017, 2, 1), LTG_END = Date.UTC(2023, 6, 31);

// Live video: date of the moment being shown, from the video's play position (0..1)
const linear = (t0, t1, approx = false) => (frac) => ({ t: t0 + frac * (t1 - t0), approx });
const lightningDate = (frac) => {
  const t = LTG_REF + ((frac - 0.159) / 0.1253) * 365.25 * DAY;
  return { t: Math.max(LTG_START, Math.min(LTG_END, t)), approx: true };
};
export function liveLabel(ds, frac) {
  const { t, approx } = ds.live.dateAt(frac);
  return `${approx ? '≈ ' : ''}${ds.id === 'lightning' ? fmtMonth(t) : fmtDay(t)}`;
}

export const DATASETS = [
  {
    id: 'nightlights',
    title: 'Night Lights 2012 → 2023',
    short: 'Night Lights',
    svsId: 5313,
    sourceUrl: 'https://svs.gsfc.nasa.gov/5313/',
    credit: 'NASA SVS, VIIRS Black Marble night lights (frames from SVS 5276)', // MERGE: frame source named
    timeSpan: 'One frame per year, 2012–2023',
    frameWidth: 2048, // city lights are tiny: analyse sharper frames
    // the 8K frames are 16:9 with the 2:1 world map centred vertically
    crop: { x0: 0, y0: 32 / 576, x1: 1, y1: 544 / 576 },
    masks: [{ x0: 0.42, y0: 0.58, x1: 0.5, y1: 0.67 }], // year label in the South Atlantic
    frames: Array.from({ length: 12 }, (_, k) => 2012 + k).map((y) => ({
      label: String(y), date: `${y}-07-01`,
      src: `${NL_DIR}nightlights_flat_series_stills_8k_only_lights.${y}.tif`,
    })),
    metric: { key: 'light', label: 'Global night-light brightness', unit: 'index', scale: 1000 },
    layers: [
      { id: 'lights', label: 'City lights (plucks)', color: '#ffd36b' },
      { id: 'growth', label: 'New light (bells)', color: '#ff9e5e' },
      { id: 'glow', label: 'Planet glow (drone)', color: '#8ab4ff' },
    ],
    summary:
      'A flat map of Earth at night. Black background; cities glow warm white and yellow. Brightest clusters: eastern United States, Europe, India, eastern China, Japan, the Nile valley. Twelve frames step through every year from 2012 to 2023, and light spreads across India, the Middle East, Africa and Southeast Asia.',
    hearing: [
      'The playhead sweeps west to east. Each moment is one strip of longitude.',
      'Pitch is latitude: northern lights ring higher, southern lights lower (C major pentatonic).',
      'More light in a strip means more notes and louder notes, like a city sparkling.',
      'High bell sparkles mark places that became brighter since the previous year.',
      'A soft drone grows from a bare fifth to a full, warm chord as the whole planet gets brighter.',
    ],
  },
  {
    id: 'ocean',
    title: 'Sea Surface Currents & Temperature',
    short: 'Ocean',
    svsId: 3912,
    sourceUrl: 'https://svs.gsfc.nasa.gov/3912/',
    credit: 'NASA SVS, ECCO2 ocean model (MIT / JPL)',
    timeSpan: 'Roughly monthly, Mar 2007 – Mar 2008',
    crop: { x0: 0, y0: 0, x1: 1, y1: 1 },
    masks: [],
    frames: oceanFrames,
    live: { src: '/vis/a000000/a003900/a003912/ecco2_sst_flow.mp4', dateAt: linear(OCEAN_T0, OCEAN_T1) },
    metric: { key: 'temp', label: 'Average water warmth (colour index)', unit: '/100', scale: 100 },
    layers: [
      { id: 'warmth', label: 'Water warmth (pads)', color: '#ff8a5c' },
      { id: 'eddies', label: 'Eddies (droplets)', color: '#5cd6ff' },
      { id: 'deep', label: 'Deep ocean (drone)', color: '#7a8cff' },
    ],
    summary:
      'Swirling ocean currents drawn as thin flowing streaks, coloured by sea surface temperature: deep blue near the poles, through green and yellow, to orange and red along the equator. Continents are flat grey. Warm western boundary currents such as the Gulf Stream and Kuroshio curl poleward. Twelve frames cover a full year, so the warm band slides north in the northern summer and south in the southern summer.',
    hearing: [
      'The playhead sweeps west to east across the oceans; land is silent.',
      'Water temperature sets the harmony: warm water lifts the chord and opens the filter; cold water makes it low and muffled (D Dorian).',
      'Three pad voices follow the northern, tropical and southern ocean bands.',
      'Swirls and eddies add vibrato and droplet-like plucks: the more turbulent the water, the more motion you hear.',
    ],
  },
  {
    id: 'aerosols',
    title: 'GEOS Aerosols (Aug–Sep 2024)',
    short: 'Aerosols',
    svsId: 5552,
    sourceUrl: 'https://svs.gsfc.nasa.gov/5552/',
    // MERGE: SVS 5669 is a different product (GEOS-FP 2 km replay, 19 Aug 2025); these frames come from SVS 5552.
    credit: 'NASA GMAO and NASA SVS, GEOS-FP model aerosols',
    timeSpan: 'Every ~5 days, Aug 1 – Sep 14, 2024',
    crop: { x0: 0, y0: 0, x1: 1, y1: 1 },
    masks: [],
    frames: aerosolFrames,
    live: { src: '/vis/a000000/a005500/a005552/Aerosols_NoLabels_2048x1024_30fps.mp4', dateAt: linear(AER_T0, AER_T1) },
    metric: { key: 'load', label: 'Total aerosol load (all four types)', unit: 'index', scale: 1000 },
    layers: [
      { id: 'dust', label: 'Dust (low drone)', color: '#c39be0' },
      { id: 'smoke', label: 'Smoke / black carbon (breath)', color: '#e0664a' },
      { id: 'salt', label: 'Sea salt (bells)', color: '#9ad0d0' },
      { id: 'sulfate', label: 'Sulfate (glass arpeggio)', color: '#55dd44' },
      { id: 'harmony', label: 'Harmony bed', color: '#8ab4ff' },
    ],
    summary:
      'Particles in the air from the GEOS model. Four colours: red-orange smoke (black carbon) from fires in South America and Africa; lavender desert dust blowing west off the Sahara; pale blue-white sea salt swirling in storms over the Southern Ocean; bright green sulfate pollution over Asia, Europe and North America.',
    hearing: [
      'Each aerosol type is its own instrument, and its loudness follows how much of it is in the current strip.',
      'Dust: a low, buzzing drone. Smoke (black carbon): a breathy, hissing pad.',
      'Sea salt: soft bells, like spray. Sulfate: a high glassy arpeggio.',
      'Pitch of each instrument follows the latitude where that aerosol is concentrated.',
      'When the air gets heavily loaded, the harmony turns from major to minor.',
    ],
  },
  {
    id: 'lightning',
    title: 'Lightning seen from the ISS (2019)',
    short: 'Lightning',
    svsId: 5011,
    sourceUrl: 'https://svs.gsfc.nasa.gov/5011/',
    credit: 'NASA SVS, Lightning Imaging Sensor on the International Space Station (record 2017–2023)',
    timeSpan: 'Monthly through 2019 (10-day windows)',
    crop: { x0: 0, y0: 0, x1: 1, y1: 1 },
    masks: [],
    // frames are sampled live from the SVS video at the moments matching each month
    video: {
      src: `${LTG}iss_lightning_sos_yearly_07312023_2048p60.mp4`,
      samples: lightningSamples,
      labelFor: (i) => fmtMonth(lightningMonths[i]),
      dateFor: (i) => iso(lightningMonths[i]),
    },
    frames: [{ label: '2023 sample', date: '2023-07-01', src: `${LTG}iss_lightning_sos_yearly_debug_2023_sos_2048p60.00420_print.jpg` }],
    live: { src: `${LTG}iss_lightning_sos_yearly_07312023_2048p60.mp4`, dateAt: lightningDate },
    metric: { key: 'north', label: 'Share of lightning in the Northern Hemisphere', unit: '%', scale: 100 },
    layers: [
      { id: 'flashes', label: 'Flashes (percussion)', color: '#ffe14d' },
      { id: 'thunder', label: 'Thunder (rumble)', color: '#b0a0ff' },
      { id: 'night', label: 'Night sky (pad)', color: '#7a8cff' },
    ],
    summary:
      'A dark grey world map. Yellow dots are lightning flashes detected from the International Space Station over a 10-day window. Flashes cluster over land in the tropics: Central Africa, the Amazon, Southeast Asia, Indonesia and northern Australia. Twelve frames step month by month through 2019, so the storm belt marches north in the northern summer and back south in winter.',
    hearing: [
      'Every cluster of flashes becomes a percussive crack with a pitched ping.',
      'Pitch is latitude (north higher), loudness is how bright and dense the flashes are.',
      'Listen to the seasons: the cracks climb higher in pitch in June–August, when storms move north, and sink again by December.',
      'A low thunder rumble rises when many flashes happen at once.',
    ],
  },
  {
    id: 'airquality',
    title: 'Air Quality: fire season 2024',
    short: 'Air Quality',
    svsId: 5533,
    sourceUrl: 'https://svs.gsfc.nasa.gov/5533/',
    credit: 'NASA SVS / GMAO, GEOS-CF composition forecast',
    timeSpan: 'Every ~9 days, July – August 2024',
    crop: { x0: 0, y0: 0, x1: 1, y1: 1 },
    masks: [],
    // this map is 16:9 and wider than 360°; measured from coastlines in the frame
    geo: { lonL: -195, lonR: 138, latT: 79, latB: -92 },
    frames: airFrames,
    live: { src: '/vis/a000000/a005500/a005533/AirQuality_MapWithLabels_5760x3240.mp4', dateAt: linear(AQ_T0, AQ_T1, true) },
    metric: { key: 'smoke', label: 'Smoke pollution level (CO + PM2.5 strips)', unit: '/100', scale: 100 },
    layers: [
      { id: 'co', label: 'Carbon monoxide (brass)', color: '#ffb547' },
      { id: 'pm', label: 'Particulate matter PM2.5 (crackle)', color: '#d9772b' },
      { id: 'nox', label: 'Nitrogen oxides (pulse)', color: '#3fcf5a' },
      { id: 'o3', label: 'Ozone (glass)', color: '#8a7dff' },
      { id: 'bed', label: 'Bed (drone)', color: '#8ab4ff' },
    ],
    summary:
      'A world map cut into vertical strips; each strip shows one pollutant from the GEOS-CF model with its own colour scale: carbon monoxide in yellow to red, fine particulate matter (PM2.5) in cream to brown, nitrogen oxides in light to dark green, and ozone in grey to deep violet. The strips slide sideways over time. Summer 2024 was an active fire season: thick red carbon-monoxide and brown smoke plumes stream from Canada, Alaska, Siberia, the Amazon and Central Africa.',
    hearing: [
      'Each strip plays its pollutant\'s instrument, so you hear the map change instrument as the playhead crosses the strips.',
      'Carbon monoxide: a brassy chord. PM2.5 smoke: crackling grains, like a fire.',
      'Nitrogen oxides: a pulsing rhythm, like traffic and industry. Ozone: high glassy tones.',
      'Pitch is latitude (north higher); the dirtier the air, the louder and denser the sound.',
    ],
  },
];

export const byId = (id) => DATASETS.find((d) => d.id === id);
