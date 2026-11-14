// The curated playlist: every EIC record rendered offline by the same engine in both modes
// (Opus in WebM, made by the teammate prototype's render.html). Files live in public/eic/playlist/.
import { ASSET_BASE } from './vendor/env';

export interface PlaylistTrack {
  file: string;
  dataset: string;
  mode: 'orchestra' | 'science';
  title: string;
  seconds: number;
  frames: string[];
}

let cached: Promise<PlaylistTrack[]> | null = null;

/** Fetch playlist.json once per session; an empty list when it is missing. */
export function loadPlaylist(fetcher: typeof fetch = fetch): Promise<PlaylistTrack[]> {
  if (!cached) {
    cached = fetcher(`${ASSET_BASE}playlist/playlist.json`)
      .then((r) => (r.ok ? (r.json() as Promise<PlaylistTrack[]>) : []))
      .catch(() => []);
  }
  return cached;
}

export const playlistUrl = (t: PlaylistTrack) => `${ASSET_BASE}playlist/${encodeURIComponent(t.file)}`;

/** True when this browser can decode the WebM/Opus playlist files. */
export function canPlayWebm(): boolean {
  try {
    return typeof document !== 'undefined' && document.createElement('audio').canPlayType('audio/webm; codecs=opus') !== '';
  } catch {
    return false;
  }
}

export const modeLabel = (m: PlaylistTrack['mode']) => (m === 'orchestra' ? 'Orchestra' : 'Scientific');
