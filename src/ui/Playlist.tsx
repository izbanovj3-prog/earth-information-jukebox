import { useEffect, useState } from 'react';
import { canPlayWebm, loadPlaylist, modeLabel, playlistUrl, type PlaylistTrack } from '../eic/playlist';

interface Props {
  /** Only this record's tracks (side panel); all tracks when omitted (library). */
  dataset?: string;
  /** Called when a playlist track starts, so the live jukebox can pause instead of overlapping. */
  onPlay: () => void;
  headingId: string;
}

/** Pre-rendered soundscapes, same engine as the live jukebox, both modes. */
export function Playlist({ dataset, onPlay, headingId }: Props) {
  const [tracks, setTracks] = useState<PlaylistTrack[] | null>(null);
  const [webm] = useState(canPlayWebm);
  useEffect(() => {
    let alive = true;
    void loadPlaylist().then((t) => alive && setTracks(t));
    return () => {
      alive = false;
    };
  }, []);
  const list = (tracks ?? []).filter((t) => !dataset || t.dataset === dataset);
  if (tracks && !list.length) return null;
  return (
    <div className="flex flex-col gap-space-sm" aria-labelledby={headingId}>
      {!webm && (
        <p className="m-0 font-body-md text-body-md text-secondary">
          This browser cannot play WebM/Opus audio. Use the download links instead, or open the page in a current Chrome, Edge or Firefox.
        </p>
      )}
      {tracks === null && <p className="m-0 font-label-sm text-label-sm text-secondary">Loading the playlist…</p>}
      <ul className="list-none m-0 p-0 flex flex-col gap-space-sm">
        {list.map((t) => {
          const label = `${t.title}, ${modeLabel(t.mode)}, ${t.seconds} seconds, ${t.frames[0]} to ${t.frames[t.frames.length - 1]}`;
          return (
            <li key={t.file} className="flex flex-col gap-1 bg-surface-container p-space-sm">
              <span className="font-label-md text-label-md text-on-surface">
                {dataset ? modeLabel(t.mode) : `${t.title} · ${modeLabel(t.mode)}`}{' '}
                <span className="text-secondary">
                  · {Math.floor(t.seconds / 60)}:{String(t.seconds % 60).padStart(2, '0')} · {t.frames[0]} → {t.frames[t.frames.length - 1]}
                </span>
              </span>
              {webm && <audio className="w-full" controls preload="none" src={playlistUrl(t)} aria-label={label} onPlay={onPlay} />}
              <a className="font-label-sm text-label-sm text-primary underline w-fit" href={playlistUrl(t)} download={t.file}>
                Download<span className="sr-only"> {label}</span> (WebM)
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
