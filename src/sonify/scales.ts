import type { ScaleName } from '../types';

/** Semitone steps within one octave. */
export const SCALES: Record<ScaleName, number[]> = {
  pentatonic: [0, 2, 4, 7, 9],
  minor: [0, 2, 3, 5, 7, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const SCALE_LABELS: Record<ScaleName, string> = {
  pentatonic: 'Pentatonic (gentle)',
  minor: 'Natural minor (moody)',
  chromatic: 'Chromatic (data-true)',
};

export const KEYS = [
  { label: 'C', midi: 48 },
  { label: 'D', midi: 50 },
  { label: 'E', midi: 52 },
  { label: 'F', midi: 53 },
  { label: 'G', midi: 55 },
  { label: 'A', midi: 57 },
] as const;

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** All scale degrees (as MIDI notes) from root across `octaves`, inclusive of the top tonic. */
export function scaleNotes(scale: ScaleName, rootMidi: number, octaves: number): number[] {
  const steps = SCALES[scale];
  const out: number[] = [];
  for (let o = 0; o < octaves; o++) for (const s of steps) out.push(rootMidi + 12 * o + s);
  out.push(rootMidi + 12 * octaves);
  return out;
}

/**
 * Quantize a normalised value (0..1, clamped) to a note of the scale.
 * Monotonic: a larger value never gives a lower note.
 */
export function quantize(norm: number, scale: ScaleName, rootMidi: number, octaves: number): number {
  const notes = scaleNotes(scale, rootMidi, octaves);
  const n = Number.isFinite(norm) ? Math.min(1, Math.max(0, norm)) : 0;
  const idx = Math.min(notes.length - 1, Math.floor(n * notes.length));
  return notes[idx]!;
}
