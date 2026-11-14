// Pure mapping from samples to note events. No audio here.
import type { ColumnSample, DroneParams, MappingConfig, NoteEvent, ScaleName, Timbre } from '../types';
import { midiToFreq, quantize } from './scales';

/** Distinct timbre per latitude band (north, tropics, south). */
export const BAND_TIMBRES: Timbre[] = ['glass', 'reed', 'pluck'];
export const BAND_NAMES = ['North', 'Tropics', 'South'] as const;

export interface Preset {
  id: 'calm' | 'dramatic';
  label: string;
  scale: ScaleName;
  octaves: number;
  noteDuration: number;
  velocity: number;
  panWidth: number;
  /** Scan steps per second. */
  tempo: number;
}

export const PRESETS: Record<Preset['id'], Preset> = {
  calm: { id: 'calm', label: 'Calm', scale: 'pentatonic', octaves: 2, noteDuration: 0.42, velocity: 0.32, panWidth: 0.8, tempo: 4 },
  dramatic: { id: 'dramatic', label: 'Dramatic', scale: 'minor', octaves: 3, noteDuration: 0.22, velocity: 0.5, panWidth: 1, tempo: 7 },
};

export function normalise(value: number, range: [number, number]): number {
  const [lo, hi] = range;
  return hi === lo ? 0.5 : (value - lo) / (hi - lo);
}

export function extremeOf(norm: number, outliers: { low: number; high: number }): 'high' | 'low' | undefined {
  if (outliers.high > 0 && norm >= 1 - outliers.high) return 'high';
  if (outliers.low > 0 && norm <= outliers.low) return 'low';
  return undefined;
}

/**
 * Map one column sample to note events.
 * - value -> pitch (quantized to the scale; same mapping for every band, so "higher = more" always holds)
 * - band -> timbre, plus a small stagger so the three voices are heard as separate streams
 * - longitude -> stereo pan (west = left)
 * - null value -> rest (no event)
 * - a pixel in the outer `outliers` fraction of the range -> extra accent (bell high / soft noise low)
 */
export function mapToNotes(sample: ColumnSample, mapping: MappingConfig): NoteEvent[] {
  const notes: NoteEvent[] = [];
  const pan = Math.max(-1, Math.min(1, (sample.lon / 180) * mapping.panWidth));
  const stagger = mapping.noteDuration / Math.max(3, sample.bands.length);
  let strongest: { strength: number; kind: 'high' | 'low' } | null = null;

  sample.bands.forEach((band, i) => {
    if (band.value === null || !Number.isFinite(band.value)) return;
    const norm = normalise(band.value, mapping.range);
    const midi = quantize(norm, mapping.scale, mapping.rootMidi, mapping.octaves);
    // Accents come from the most extreme *pixel* in the band, not the band mean.
    const hiNorm = normalise(band.max ?? band.value, mapping.range);
    const loNorm = normalise(band.min ?? band.value, mapping.range);
    const accent = extremeOf(hiNorm, mapping.outliers) === 'high'
      ? 'high'
      : extremeOf(loNorm, mapping.outliers) === 'low'
        ? 'low'
        : undefined;
    notes.push({
      band: i,
      timbre: BAND_TIMBRES[i % BAND_TIMBRES.length]!,
      midi,
      freq: midiToFreq(midi),
      offset: i * stagger,
      duration: mapping.noteDuration,
      velocity: mapping.velocity,
      pan,
      ...(accent ? { accent } : {}),
    });
    if (accent) {
      const strength = accent === 'high' ? hiNorm : 1 - loNorm;
      if (!strongest || strength > strongest.strength) strongest = { strength, kind: accent };
    }
  });

  const s = strongest as { strength: number; kind: 'high' | 'low' } | null;
  if (s) {
    const midi = s.kind === 'high' ? mapping.rootMidi + 12 * (mapping.octaves + 1) : mapping.rootMidi - 12;
    notes.push({
      band: -1,
      timbre: s.kind === 'high' ? 'bell' : 'noise',
      midi,
      freq: midiToFreq(midi),
      offset: 0,
      duration: mapping.noteDuration * 2.5,
      velocity: mapping.velocity * 0.8,
      pan,
      accent: s.kind,
    });
  }
  return notes;
}

/** Explore mode: one note for the value under the cursor (plus accent if extreme). */
export function mapProbe(value: number | null, lon: number, mapping: MappingConfig): NoteEvent[] {
  return mapToNotes({ x: 0, lon, bands: [{ lat: [0, 0], value }], meanValue: value }, mapping).map((n) =>
    n.band === 0 ? { ...n, timbre: 'probe', duration: Math.max(0.25, n.duration) } : n,
  );
}

/** Root of the change drone (A1). */
export const DRONE_BASE_HZ = 55;

/**
 * Drone follows the global metric relative to the first frame of the track.
 * `changeScale` is the change (in legend units) that moves the drone a full fifth and
 * doubles/halves its brightness. Documented as an intentional exaggeration.
 */
export function droneParams(metric: number | null, baseline: number | null, changeScale: number): DroneParams {
  const raw = metric === null || baseline === null || changeScale <= 0 ? 0 : (metric - baseline) / changeScale;
  const delta = Math.max(-1, Math.min(1, raw));
  return {
    delta,
    freq: DRONE_BASE_HZ * 2 ** ((delta * 7) / 12),
    cutoff: 320 * 2 ** (delta * 1.5),
  };
}

export function buildMapping(
  preset: Preset,
  range: [number, number],
  overrides: Partial<Pick<MappingConfig, 'scale' | 'rootMidi' | 'outliers'>> = {},
): MappingConfig {
  return {
    scale: overrides.scale ?? preset.scale,
    rootMidi: overrides.rootMidi ?? 48,
    octaves: preset.octaves,
    range,
    outliers: overrides.outliers ?? { low: 0.06, high: 0.06 },
    noteDuration: preset.noteDuration,
    velocity: preset.velocity,
    panWidth: preset.panWidth,
  };
}
