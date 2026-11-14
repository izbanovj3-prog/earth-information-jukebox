import styles from './Marquee.module.css';

export const DISCLAIMER = 'Unofficial prototype built for NASA Space Apps Challenge. Not a NASA product.';

export function Marquee({ onHelp, onTour, touring = false }: { onHelp: () => void; onTour?: () => void; touring?: boolean }) {
  return (
    <header className={styles.marquee}>
      <div className={styles.arch} aria-hidden="true">
        <span className={styles.tube} />
      </div>
      <p className={styles.kicker}>NASA Space Apps Challenge 2026 · The Earth Information Jukebox</p>
      <h1 className={styles.title}>
        <span className={styles.line1}>Earth Information</span>
        <span className={styles.line2}>Jukebox</span>
      </h1>
      <p className={styles.tagline}>Satellite views of our changing planet, played live as sound you can explore by ear.</p>
      <div className={styles.actions}>
        {onTour && (
          <button type="button" className={styles.ghost} onClick={onTour} aria-pressed={touring}>
            Demo Tour <span className={styles.dim}>90 s</span>
          </button>
        )}
        <button type="button" className={styles.ghost} onClick={onHelp} aria-keyshortcuts="?">
          Keyboard Help <kbd>?</kbd>
        </button>
        <p className={styles.disclaimer}>{DISCLAIMER}</p>
      </div>
    </header>
  );
}
