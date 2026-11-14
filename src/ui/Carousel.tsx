import type { CSSProperties } from 'react';
import type { Track } from '../data/catalog';
import styles from './Carousel.module.css';

interface Props {
  tracks: Track[];
  selected: number;
  playing: boolean;
  onSelect: (i: number) => void;
}

export function Carousel({ tracks, selected, playing, onSelect }: Props) {
  return (
    <fieldset className={styles.carousel}>
      <legend className={styles.legend}>
        <span className={styles.legendTitle}>Records</span>
        <span className={styles.legendHint}>
          One Earth phenomenon per record. <span className={styles.nowrap}>Switch with <kbd>[</kbd> <kbd>]</kbd></span>
        </span>
      </legend>
      <ol className={styles.list}>
        {tracks.map((t, i) => {
          const id = `record-${t.id}`;
          const on = i === selected;
          return (
            <li key={t.id} className={styles.item} style={{ '--i': i } as CSSProperties}>
              <input
                className={styles.radio}
                type="radio"
                name="record"
                id={id}
                checked={on}
                onChange={() => onSelect(i)}
                aria-describedby={`${id}-sub`}
              />
              <label htmlFor={id} className={styles.card} data-on={on} style={{ '--hue': t.hue } as CSSProperties}>
                <span className={styles.disc} data-spin={on && playing} aria-hidden="true">
                  <span className={styles.label} />
                </span>
                <span className={styles.text}>
                  <span className={styles.no} aria-hidden="true">
                    A{i + 1}
                  </span>
                  <span className={styles.title}>{t.title}</span>
                  <span className={styles.sub} id={`${id}-sub`}>
                    {t.subtitle}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ol>
    </fieldset>
  );
}
