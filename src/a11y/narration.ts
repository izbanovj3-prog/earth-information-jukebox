// Pure text generation for screen readers: what is being heard, and what each frame shows.
import type { Track } from '../data/catalog';
import { formatDate, formatValue } from '../data/catalog';
import { BAND_NAMES, normalise } from '../sonify/mapping';
import type { FrameStats } from '../sonify/sample';
import type { ColumnSample, NoteEvent } from '../types';

export function formatLon(lon: number): string {
  const r = Math.round(lon);
  if (r === 0 || Math.abs(r) === 180) return `${Math.abs(r)}°`;
  return `${Math.abs(r)}°${r < 0 ? 'W' : 'E'}`;
}

export function formatLat(lat: number): string {
  const r = Math.round(lat);
  if (r === 0) return '0°';
  return `${Math.abs(r)}°${r < 0 ? 'S' : 'N'}`;
}

/** Five-step word scale built from the track's low/high words. */
export function levelWord(track: Track, value: number | null): string {
  if (value === null) return 'no data';
  const n = normalise(value, track.range);
  if (n < 0.2) return `very ${track.lowWord}`;
  if (n < 0.4) return track.lowWord;
  if (n < 0.6) return 'moderate';
  if (n < 0.8) return track.highWord;
  return `very ${track.highWord}`;
}

export function trendWord(track: Track, prev: number | null | undefined, cur: number | null): string {
  if (prev === null || prev === undefined || cur === null) return '';
  const d = normalise(cur, track.range) - normalise(prev, track.range);
  if (d > 0.03) return 'rising';
  if (d < -0.03) return 'falling';
  return 'steady';
}

/** e.g. "40°W. North: warm, rising. Tropics: very warm, steady. South: no data. Bell in the tropics." */
export function describeColumn(track: Track, sample: ColumnSample, prev?: ColumnSample, notes: NoteEvent[] = []): string {
  const parts = sample.bands.map((b, i) => {
    const name = BAND_NAMES[i] ?? `Band ${i + 1}`;
    const level = levelWord(track, b.value);
    const trend = trendWord(track, prev?.bands[i]?.value, b.value);
    return `${name}: ${level}${trend ? `, ${trend}` : ''}`;
  });
  const accentBands = notes
    .filter((n) => n.band >= 0 && n.accent === 'high')
    .map((n) => (BAND_NAMES[n.band] ?? '').toLowerCase());
  const accent = accentBands.length ? ` Bell: extreme ${track.highWord} in the ${accentBands.join(' and ')}.` : '';
  return `${formatLon(sample.lon)}. ${parts.join('. ')}.${accent}`;
}

function changePhrase(track: Track, cur: number | null, base: number | null, baseDate: string): string {
  if (cur === null || base === null) return '';
  const d = (cur - base) * track.display.scale;
  const abs = Math.abs(d).toFixed(track.display.decimals + (track.display.decimals === 0 ? 1 : 0));
  if (Number(abs) === 0) return ` About the same as ${formatDate(track, baseDate)}.`;
  return ` ${d > 0 ? 'Up' : 'Down'} ${abs}\u00a0${track.display.unit} compared with ${formatDate(track, baseDate)}.`;
}

/** Full text description of a frame, for sound-only and screen-reader use. */
export function describeFrame(
  track: Track,
  date: string,
  stats: FrameStats,
  baseline?: { date: string; stats: FrameStats },
): string {
  const when = formatDate(track, date);
  const lines: string[] = [];
  lines.push(`${track.layerTitle}, ${when}.`);
  if (stats.mean === null) {
    lines.push('This frame has no usable data.');
    return lines.join(' ');
  }
  const coverage = stats.validFraction < 0.98 ? ` Data covers ${Math.round(stats.validFraction * 100)}% of the globe; the rest is silent.` : '';
  lines.push(
    `Average over areas with data: ${formatValue(track, stats.mean)}.${
      baseline && baseline.date !== date ? changePhrase(track, stats.mean, baseline.stats.mean, baseline.date) : ''
    }${coverage}`,
  );
  if (stats.max) {
    lines.push(`Highest: ${formatValue(track, stats.max.value)} near ${formatLat(stats.max.lat)} ${formatLon(stats.max.lon)}.`);
  }
  if (stats.min) {
    lines.push(`Lowest: ${formatValue(track, stats.min.value)} near ${formatLat(stats.min.lat)} ${formatLon(stats.min.lon)}.`);
  }
  const bandText = stats.bandMeans
    .map((v, i) => `${BAND_NAMES[i] ?? `Band ${i + 1}`} ${v === null ? 'no data' : `${levelWord(track, v)} (${formatValue(track, v)})`}`)
    .join(', ');
  lines.push(`By latitude band: ${bandText}.`);
  return lines.join(' ');
}

/** "62°N 40°W: −5.2 °C, cold" for the explore cursor. */
export function describeProbe(track: Track, lat: number, lon: number, value: number | null): string {
  return `${formatLat(lat)} ${formatLon(lon)}: ${formatValue(track, value)}${value === null ? '' : `, ${levelWord(track, value)}`}`;
}

/** Spoken when the time-lapse reaches a new frame. */
export function describeFrameChange(track: Track, dateLabel: string, stats: FrameStats | null): string {
  return `${dateLabel}. Average ${stats ? formatValue(track, stats.mean) : 'unknown'}.`;
}

/** Spoken when playback starts. */
export function describePlaying(track: Track, dateLabel: string): string {
  return `Playing ${track.title}, ${dateLabel}. Scanning west to east.`;
}

/** Throttle for aria-live announcements: at most one per interval, urgent ones always pass. */
export class Throttle {
  private last = -Infinity;
  constructor(
    private readonly intervalMs: number,
    private readonly now: () => number = () => performance.now(),
  ) {}
  allow(urgent = false): boolean {
    const t = this.now();
    if (urgent || t - this.last >= this.intervalMs) {
      this.last = t;
      return true;
    }
    return false;
  }
  reset(): void {
    this.last = -Infinity;
  }
}
