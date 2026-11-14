// Which orchestral instruments a piece needs, found by a dry run of the orchestra composer.
// The composer only talks to the engine through `sample(...)` and `layer`, so a recording stub
// sees every instrument the live performance would use. Loading only these instead of all 19
// cuts the first Orchestra load (the prototype downloaded 16 MB on Play).
import { COLS, type EicFrames } from './vendor/analyze';
import type { EicDataset } from './vendor/datasets';
import { FAMILIES, familiesUsed, ORCHESTRA_COMPOSER, type SampleSink } from './vendor/orchestra';

/** Instruments the explore cursor can play (lead of each colour family present, plus the empty-cell pizzicato). */
function probeInstruments(frames: EicFrames, ds: EicDataset): string[] {
  return [...familiesUsed(frames, ds).map((f) => FAMILIES[f]!.lead), 'pizz'];
}

export function instrumentsFor(frames: EicFrames, ds: EicDataset): string[] {
  const used = new Set<string>();
  const sink: SampleSink = {
    ctx: { currentTime: 0 },
    layer: 'main',
    sample(inst) {
      used.add(inst);
      return true;
    },
  };
  // Deterministic stand-in for the composer's seeded random: alternate low/high so both branches run.
  let flip = false;
  const rnd = () => {
    flip = !flip;
    return flip ? 0.01 : 0.99;
  };
  for (let f = 0; f < frames.length; f++) {
    ORCHESTRA_COMPOSER.frameStart(sink, frames, f, 0, 1, ds);
    for (let c = 0; c < COLS; c++) ORCHESTRA_COMPOSER.step(sink, frames, f, c, 0, rnd, 0.1, ds);
  }
  for (const i of probeInstruments(frames, ds)) used.add(i);
  return [...used].sort();
}
