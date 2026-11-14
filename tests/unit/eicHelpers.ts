import { readFileSync } from 'node:fs';
import { normalizeFrames, type EicFrame, type EicFrames } from '../../src/eic/vendor/analyze';
import { DATASETS } from '../../src/eic/vendor/datasets';

export const eicRoot = new URL('../../public/eic/', import.meta.url);

/** Load baked frames from disk the same way the app does over HTTP. */
export function bakedFrames(id: string): EicFrames {
  const data = JSON.parse(readFileSync(new URL(`baked/${id}.json`, eicRoot), 'utf8')) as {
    frames: { label: string; date?: string; img: string; ch: Record<string, string> }[];
  };
  const frames = data.frames.map((f) => ({
    label: f.label,
    date: f.date,
    url: f.img,
    ch: Object.fromEntries(Object.entries(f.ch).map(([k, v]) => [k, new Float32Array(new Uint8Array(Buffer.from(v, 'base64')).buffer)])),
  })) as unknown as EicFrame[];
  normalizeFrames(frames, DATASETS.find((d) => d.id === id)!);
  return frames as EicFrames;
}
