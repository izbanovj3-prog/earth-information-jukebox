import { useId } from 'react';
import type { Preset } from '../sonify/mapping';
import { KEYS, SCALE_LABELS } from '../sonify/scales';
import type { ScaleName } from '../types';
import styles from './Transport.module.css';

export type NarrationMode = 'off' | 'changes' | 'detailed';

interface Props {
  playing: boolean;
  canPlay: boolean;
  onToggle: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  mode: 'scan' | 'explore';
  onMode: (m: 'scan' | 'explore') => void;
  frameIndex: number;
  frameCount: number;
  loadedCount: number;
  dateLabels: string[];
  onSeek: (i: number) => void;
  timelapse: boolean;
  onTimelapse: (v: boolean) => void;
  tempo: number;
  onTempo: (v: number) => void;
  preset: Preset['id'];
  onPreset: (p: Preset['id']) => void;
  scale: ScaleName;
  onScale: (s: ScaleName) => void;
  rootMidi: number;
  onRoot: (m: number) => void;
  volume: number;
  onVolume: (v: number) => void;
  muted: boolean;
  onMute: () => void;
  narration: NarrationMode;
  onNarration: (n: NarrationMode) => void;
}

export function Transport(p: Props) {
  const id = useId();
  return (
    <section className={styles.deck} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="visually-hidden">
        Player Controls
      </h2>
      <div className={styles.row}>
        <button type="button" className={styles.round} onClick={p.onPrevTrack} aria-label="Previous record" aria-keyshortcuts="[">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 5h2v14H6zM20 5v14L9 12z" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.play}
          onClick={p.onToggle}
          disabled={!p.canPlay}
          aria-keyshortcuts="Space"
          aria-label={p.playing ? 'Pause' : 'Play'}
        >
          {p.playing ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 4v16l13-8z" />
            </svg>
          )}
          <span className={styles.playText}>{p.playing ? 'Pause' : 'Play'}</span>
        </button>
        <button type="button" className={styles.round} onClick={p.onNextTrack} aria-label="Next record" aria-keyshortcuts="]">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M16 5h2v14h-2zM4 5v14l11-7z" />
          </svg>
        </button>

        <fieldset className={styles.segment}>
          <legend className="visually-hidden">Listening mode</legend>
          {(['scan', 'explore'] as const).map((m) => (
            <label key={m} className={styles.segItem} data-on={p.mode === m}>
              <input type="radio" name={`${id}-mode`} value={m} checked={p.mode === m} onChange={() => p.onMode(m)} />
              <span>{m === 'scan' ? 'Scan' : 'Explore'}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className={styles.time}>
        <label htmlFor={`${id}-time`} className={styles.label}>
          Time <span className={styles.value}>{p.dateLabels[p.frameIndex] ?? '—'}</span>
        </label>
        <input
          id={`${id}-time`}
          type="range"
          className={styles.slider}
          min={0}
          max={Math.max(0, p.frameCount - 1)}
          step={1}
          value={p.frameIndex}
          aria-valuetext={`${p.dateLabels[p.frameIndex] ?? ''}, frame ${p.frameIndex + 1} of ${p.frameCount}`}
          onChange={(e) => p.onSeek(Number(e.target.value))}
          disabled={p.frameCount < 2}
        />
        <div className={styles.ends} aria-hidden="true">
          <span>{p.dateLabels[0]}</span>
          <span>
            {p.loadedCount < p.frameCount ? `${p.loadedCount}/${p.frameCount} loaded · ` : ''}
            {p.dateLabels[p.frameCount - 1]}
          </span>
        </div>
        <label className={styles.check}>
          <input type="checkbox" checked={p.timelapse} onChange={(e) => p.onTimelapse(e.target.checked)} />
          Advance through time after each sweep
        </label>
      </div>

      <details className={styles.mixer} open>
        <summary>Sound Settings</summary>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label htmlFor={`${id}-preset`}>Mood</label>
            <select id={`${id}-preset`} value={p.preset} onChange={(e) => p.onPreset(e.target.value as Preset['id'])}>
              <option value="calm">Calm</option>
              <option value="dramatic">Dramatic</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor={`${id}-scale`}>Scale</label>
            <select id={`${id}-scale`} value={p.scale} onChange={(e) => p.onScale(e.target.value as ScaleName)}>
              {(Object.keys(SCALE_LABELS) as ScaleName[]).map((s) => (
                <option key={s} value={s}>
                  {SCALE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor={`${id}-key`}>Key</label>
            <select id={`${id}-key`} value={p.rootMidi} onChange={(e) => p.onRoot(Number(e.target.value))}>
              {KEYS.map((k) => (
                <option key={k.label} value={k.midi}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor={`${id}-tempo`}>
              Tempo <span className={styles.value}>{p.tempo} steps/s</span>
            </label>
            <input
              id={`${id}-tempo`}
              type="range"
              className={styles.slider}
              min={2}
              max={10}
              step={1}
              value={p.tempo}
              aria-valuetext={`${p.tempo} steps per second`}
              onChange={(e) => p.onTempo(Number(e.target.value))}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={`${id}-vol`}>
              Volume <span className={styles.value}>{Math.round(p.volume * 100)}%</span>
            </label>
            <input
              id={`${id}-vol`}
              type="range"
              className={styles.slider}
              min={0}
              max={1}
              step={0.05}
              value={p.volume}
              aria-valuetext={`${Math.round(p.volume * 100)} percent`}
              onChange={(e) => p.onVolume(Number(e.target.value))}
            />
          </div>
          <div className={styles.field}>
            <span id={`${id}-mute-l`}>Sound</span>
            <button type="button" className={styles.toggle} aria-pressed={p.muted} onClick={p.onMute} aria-keyshortcuts="M" aria-describedby={`${id}-mute-l`}>
              Mute
            </button>
          </div>
          <div className={styles.field}>
            <label htmlFor={`${id}-narr`}>Spoken narration</label>
            <select id={`${id}-narr`} aria-describedby={`${id}-narr-hint`} value={p.narration} onChange={(e) => p.onNarration(e.target.value as NarrationMode)}>
              <option value="detailed">Detailed</option>
              <option value="changes">Changes only</option>
              <option value="off">Off</option>
            </select>
            <span className={styles.hint} id={`${id}-narr-hint`}>
              {p.narration === 'detailed'
                ? 'Describes what you hear every few seconds.'
                : p.narration === 'changes'
                  ? 'Speaks only on a new frame or record.'
                  : 'No spoken updates.'}
            </span>
          </div>
        </div>
      </details>
    </section>
  );
}
