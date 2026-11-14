// Track catalog. Every layer and date here was verified against NASA GIBS with real requests
// (HTTP 200, PNG, non-empty pixels, `Access-Control-Allow-Origin: *`, colormap available).
// See scripts/spike-gibs.mjs and scripts/fetch-frames.mjs; results in public/frames/manifest.json.
// Must stay free of non-erasable TS syntax: scripts/fetch-frames.mjs imports it with Node type stripping.

export interface Track {
  id: string;
  title: string;
  /** Short subtitle shown on the record label. */
  subtitle: string;
  /** Closest Earth Information Center theme (approximate, see CONTEXT.md). */
  ecTheme: string;
  layerId: string;
  layerTitle: string;
  /** Human-readable span of the dates we use. */
  timeRange: string;
  /** ISO 8601 step between frames. */
  timeStep: string;
  dates: string[];
  colormapUrl: string;
  legendUnits: string;
  /** How to display values: convert from legend units. */
  display: { unit: string; offset: number; scale: number; decimals: number };
  /** Value range mapped to pitch (legend units). */
  range: [number, number];
  /** Words for low / high values, used by the narrator and the How-to-listen legend. */
  lowWord: string;
  highWord: string;
  /** Plain statement of the pitch mapping, e.g. "Higher pitch = warmer air". */
  pitchHint: string;
  plainLanguageStory: string;
  /** What "no data" means for this layer (rests in the music). */
  noDataMeans: string;
  /** Global metric followed by the change drone: area-weighted mean, or coverage (mean x valid area). */
  droneMetric: 'mean' | 'coverage' | 'northCoverage';
  /** Change in the drone metric (legend units) that moves the drone a full fifth. Intentional exaggeration. */
  changeScale: number;
  /** Fraction at the low / high end of `range` where a pixel triggers an accent (0 = off). */
  accents: { low: number; high: number };
  /** What an accent means, for the How-to-listen legend. */
  accentMeaning: string;
  /** Record label colour (decorative only, never the sole carrier of meaning). */
  hue: number;
}

const yearly = (month: string, years: number[], day = '01') => years.map((y) => `${y}-${month}-${day}`);
const monthly = (year: number, day = '01') =>
  Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}-${day}`);

const CM = 'https://gibs.earthdata.nasa.gov/colormaps/v1.3/';

export const TRACKS: Track[] = [
  {
    id: 'air-temperature',
    title: 'Fever Pitch',
    subtitle: 'July air temperature, 1980–2024',
    ecTheme: 'Global temperature',
    layerId: 'MERRA2_2m_Air_Temperature_Monthly',
    layerTitle: '2-meter Air Temperature (Monthly, MERRA-2)',
    timeRange: 'July 1980 – July 2024, every 4 years',
    timeStep: 'P4Y',
    dates: yearly('07', [1980, 1984, 1988, 1992, 1996, 2000, 2004, 2008, 2012, 2016, 2020, 2024]),
    colormapUrl: `${CM}MERRA2_2m_Air_Temperature_Monthly.xml`,
    legendUnits: 'K',
    display: { unit: '°C', offset: -273.15, scale: 1, decimals: 1 },
    range: [214, 316],
    lowWord: 'cold',
    highWord: 'warm',
    pitchHint: 'Higher pitch = warmer air',
    plainLanguageStory:
      'Air temperature two metres above the ground, averaged over each July, from a NASA reanalysis that blends satellite and ground observations. Listen to the low drone: it follows the global average and rises as July gets warmer over 44 years.',
    noDataMeans: 'This layer has no gaps, so there are no rests.',
    droneMetric: 'mean',
    changeScale: 1,
    accents: { low: 0, high: 0.06 },
    accentMeaning: 'Bell: air at 37 °C or hotter somewhere in that band. Count the bells: there are more of them in recent Julys.',
    hue: 18,
  },
  {
    id: 'sea-ice',
    title: 'Thin Ice',
    subtitle: 'September sea ice, 2007–2025',
    ecTheme: 'Sea ice',
    layerId: 'GHRSST_L4_MUR25_Sea_Ice_Concentration',
    layerTitle: 'Sea Ice Concentration (L4, MUR25, GHRSST)',
    timeRange: 'Mid-September 2007 – 2025',
    timeStep: 'P1Y-P4Y (irregular)',
    dates: yearly('09', [2007, 2009, 2011, 2012, 2014, 2016, 2018, 2020, 2024, 2025], '15'),
    colormapUrl: `${CM}GHRSST_Sea_Ice_Concentration.xml`,
    legendUnits: '%',
    display: { unit: '%', offset: 0, scale: 1, decimals: 0 },
    range: [0, 100],
    lowWord: 'sparse ice',
    highWord: 'dense ice',
    pitchHint: 'Higher pitch = more ice cover',
    plainLanguageStory:
      'How much of the sea surface is covered by ice in mid-September, when Arctic ice is near its yearly minimum and Antarctic ice near its maximum. The northern voice is the Arctic and the drone follows Arctic ice cover. The years swing up and down; 2012, the record low, is where the drone sinks furthest.',
    noDataMeans: 'Land and ice-free ocean have no sea-ice value, so you hear rests.',
    droneMetric: 'northCoverage',
    changeScale: 1,
    accents: { low: 0, high: 0 },
    accentMeaning: 'No accents on this track: ice cover is bounded between 0 and 100%.',
    hue: 195,
  },
  {
    id: 'sea-surface-temperature',
    title: 'Ocean Fever',
    subtitle: 'August sea surface temperature, 2003–2025',
    ecTheme: 'Ocean warming',
    layerId: 'GHRSST_L4_MUR25_Sea_Surface_Temperature',
    layerTitle: 'Sea Surface Temperature (L4, MUR25, GHRSST)',
    timeRange: 'Mid-August 2003 – 2025, every 2 years',
    timeStep: 'P2Y',
    dates: yearly('08', [2003, 2005, 2007, 2009, 2011, 2013, 2015, 2017, 2019, 2021, 2023, 2025], '15'),
    colormapUrl: `${CM}GHRSST_Sea_Surface_Temperature.xml`,
    legendUnits: '°C',
    display: { unit: '°C', offset: 0, scale: 1, decimals: 1 },
    range: [-2, 34],
    lowWord: 'cool',
    highWord: 'hot',
    pitchHint: 'Higher pitch = warmer water',
    plainLanguageStory:
      'Temperature of the ocean surface on one day each August, from a multi-satellite analysis. The tropical voice sings highest. The drone tracks the global ocean average relative to 2003. A single day per year is noisy, so listen for the long-term drift rather than each step.',
    noDataMeans: 'Land and sea ice have no sea-surface value, so you hear rests over continents.',
    droneMetric: 'mean',
    changeScale: 0.3,
    accents: { low: 0, high: 0.06 },
    accentMeaning: 'Bell: water at 32 °C or hotter somewhere in that band.',
    hue: 210,
  },
  {
    id: 'vegetation',
    title: 'Green Pulse',
    subtitle: 'Vegetation through 2024, month by month',
    ecTheme: 'Vegetation & agriculture',
    layerId: 'MODIS_Terra_L3_NDVI_Monthly',
    layerTitle: 'Vegetation Index (L3, Monthly, MODIS, Terra)',
    timeRange: 'January – December 2024, monthly',
    timeStep: 'P1M',
    dates: monthly(2024),
    colormapUrl: `${CM}MODIS_L3_NDVI.xml`,
    legendUnits: 'NDVI',
    display: { unit: 'NDVI', offset: 0, scale: 1, decimals: 2 },
    range: [0, 1],
    lowWord: 'bare',
    highWord: 'lush',
    pitchHint: 'Higher pitch = greener land',
    plainLanguageStory:
      'How green the land is, measured by the Normalized Difference Vegetation Index from the MODIS instrument. Over one year you can hear the planet breathe: the northern voice blooms in summer and fades in winter, while the south does the opposite.',
    noDataMeans: 'Oceans, snow and bare ground carry no vegetation value, so you hear rests.',
    droneMetric: 'mean',
    changeScale: 0.15,
    accents: { low: 0, high: 0.06 },
    accentMeaning: 'Bell: the very greenest land (index 0.94 or more) somewhere in that band.',
    hue: 120,
  },
  {
    id: 'aerosols',
    title: 'Hazy Skies',
    subtitle: 'Aerosols through 2024, month by month',
    ecTheme: 'Air quality',
    layerId: 'MERRA2_Total_Aerosol_Optical_Thickness_550nm_Extinction_Monthly',
    layerTitle: 'Total Aerosol Optical Thickness Extinction 550nm (Monthly, MERRA-2)',
    timeRange: 'January – December 2024, monthly',
    timeStep: 'P1M',
    dates: monthly(2024),
    colormapUrl: `${CM}MERRA2_Total_Aerosol_Optical_Thickness_550nm_Extinction_Monthly.xml`,
    legendUnits: 'AOD',
    display: { unit: 'AOD', offset: 0, scale: 1, decimals: 2 },
    range: [0, 0.9],
    lowWord: 'clear',
    highWord: 'hazy',
    pitchHint: 'Higher pitch = hazier air',
    plainLanguageStory:
      'How much sunlight is blocked by particles in the air: desert dust, smoke from fires, sea salt and pollution. Listen for the tropical voice climbing during the Saharan dust and fire seasons, with bells marking the haziest skies.',
    noDataMeans: 'This layer has no gaps, so there are no rests.',
    droneMetric: 'mean',
    changeScale: 0.05,
    accents: { low: 0, high: 0.06 },
    accentMeaning: 'Bell: very hazy air (optical depth 0.85 or more), usually desert dust or smoke.',
    hue: 40,
  },
];

export function getTrack(id: string): Track {
  const t = TRACKS.find((tr) => tr.id === id);
  if (!t) throw new Error(`Unknown track: ${id}`);
  return t;
}

export function formatValue(track: Track, value: number | null): string {
  if (value === null) return 'no data';
  const v = value * track.display.scale + track.display.offset;
  return `${v.toFixed(track.display.decimals)}\u00a0${track.display.unit}`;
}

export function formatDate(track: Track, iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const month = new Date(Date.UTC(y, m - 1, d)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  return track.timeStep === 'P1M' ? `${month} ${y}` : d === 1 ? `${month} ${y}` : `${d} ${month} ${y}`;
}
