import { useEffect, useRef } from 'react';
import { SHORTCUTS } from '../a11y/keymap';
import styles from './HelpDialog.module.css';

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby="help-h" onClose={onClose} onCancel={onClose}>
      <h2 id="help-h" className={styles.h}>
        Keyboard and Screen-Reader Help
      </h2>
      <table className={styles.table}>
        <caption className="visually-hidden">Keyboard shortcuts</caption>
        <thead>
          <tr>
            <th scope="col">Key</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {SHORTCUTS.map((s) => (
            <tr key={s.keys}>
              <td>
                <kbd>{s.keys}</kbd>
              </td>
              <td>{s.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className={styles.tips}>
        <li>Shortcuts never override a focused control: Space still presses the focused button, arrows still move a focused slider.</li>
        <li>
          With a screen reader, press <kbd>E</kbd> to move to the map; it is an application region, so arrow keys go straight to the
          explorer.
        </li>
        <li>Narration (in Sound Settings) describes what you hear every few seconds; set it to “Changes only” for fewer interruptions.</li>
        <li>You can use the jukebox by sound alone: the screen never shows anything that is not also spoken or described in text.</li>
      </ul>
      <button type="button" className={styles.close} onClick={onClose} autoFocus>
        Close Help
      </button>
    </dialog>
  );
}
