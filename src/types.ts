// Shared contract between data, sonify + audio, and ui. Keep this file dependency-free.

/** Where a frame came from. Shown in the UI "Sources and limits" panel. */
export interface Provenance {
  provider: string; // e.g. "NASA GIBS"
  layerId: string;
  layerTitle: string;
  date: string; // ISO date of the data
  url: string; // exact request URL (live) or original source URL (bundled)
  mode: 'live' | 'bundled';
}

/** One colour -> value entry recovered from a GIBS colormap. */
export interface LegendEntry {
  rgb: [number, number, number];
  /** Representative value (interval midpoint, or finite bound for open intervals). null = no data. */
  value: number | null;
}

export interface Legend {
  title: string;
  units: string | null;
  entries: LegendEntry[];
  /** Finite value range covered by the legend. */
  min: number;
  max: number;
  /** false when values are relative luminance, not physical values. */
  calibrated: boolean;
}

export interface Frame {
  trackId: string;
  date: string;
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  legend?: Legend;
  source: Provenance;
}

export interface Band {
  /** [southern edge, northern edge] in degrees latitude. */
  lat: [number, number];
  /** Physical value (legend units) or null if no data. */
  value: number | null;
  /** Most extreme pixel values in the band (used for accents). */
  min?: number | null;
  max?: number | null;
}

export interface ColumnSample {
  x: number;
  /** Longitude of the column centre, degrees east (-180..180). */
  lon: number;
  /** Ordered north -> south. */
  bands: Band[];
  meanValue: number | null;
}

export type ScaleName = 'pentatonic' | 'minor' | 'chromatic';
/** Global metric followed by the change drone: area-weighted mean, coverage (mean x valid area), or Arctic-band coverage. */
export type DroneMetric = 'mean' | 'coverage' | 'northCoverage';
export type Timbre = 'glass' | 'reed' | 'pluck' | 'bell' | 'noise' | 'probe';

export interface MappingConfig {
  scale: ScaleName;
  /** MIDI note of the tonic for the lowest value. */
  rootMidi: number;
  /** Pitch range in octaves across the value range. */
  octaves: number;
  /** Value range mapped to the pitch range (legend units). */
  range: [number, number];
  /** Fraction at the low / high end of the range where a pixel triggers an accent (0 = off). */
  outliers: { low: number; high: number };
  /** Seconds per note. */
  noteDuration: number;
  /** 0..1 */
  velocity: number;
  /** Stereo width 0..1. */
  panWidth: number;
}

export interface NoteEvent {
  /** Band index (0 = north) or -1 for accents/probe. */
  band: number;
  timbre: Timbre;
  midi: number;
  freq: number;
  /** Offset in seconds relative to the schedule time. */
  offset: number;
  duration: number;
  velocity: number;
  /** -1 (west/left) .. 1 (east/right) */
  pan: number;
  accent?: 'high' | 'low';
}

export interface DroneParams {
  freq: number;
  /** Low-pass cutoff in Hz: brighter = higher mean. */
  cutoff: number;
  /** Normalised change vs baseline, -1..1. */
  delta: number;
}
