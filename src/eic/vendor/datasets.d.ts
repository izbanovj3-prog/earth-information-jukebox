export interface EicLayer { id: string; label: string; color: string }
export interface EicDataset {
  id: string;
  title: string;
  short: string;
  svsId: number;
  sourceUrl: string;
  credit: string;
  timeSpan: string;
  metric: { key: string; label: string; unit: string; scale: number };
  layers: EicLayer[];
  summary: string;
  hearing: string[];
  frames: { label: string; date?: string; src: string }[];
  live?: unknown;
  video?: { samples: number[] };
}
export const DATASETS: EicDataset[];
export function byId(id: string): EicDataset | undefined;
