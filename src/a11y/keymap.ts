// Keyboard shortcuts as a pure function, so conflicts with native controls are testable.

export type Action =
  | { type: 'togglePlay' }
  | { type: 'prevTrack' }
  | { type: 'nextTrack' }
  | { type: 'prevFrame' }
  | { type: 'nextFrame' }
  | { type: 'toggleMute' }
  | { type: 'help' }
  | { type: 'focusMap' }
  | { type: 'describe' }
  | { type: 'move'; dx: number; dy: number };

export interface KeyInput {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** Lower-case tag name of the focused element. */
  tag?: string;
  /** type attribute (for inputs). */
  inputType?: string;
  role?: string | null;
  /** True when focus is on the explore map surface. */
  onMap?: boolean;
  /** True while a modal dialog is open. */
  dialogOpen?: boolean;
}

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Space', action: 'Play or pause the scan' },
  { keys: 'Arrow keys', action: 'Explore: move the cursor on the map and hear the value under it' },
  { keys: 'Shift + Arrow keys', action: 'Explore: jump 10 times further' },
  { keys: 'E', action: 'Jump to the map to explore it' },
  { keys: '[ and ]', action: 'Previous / next record (track)' },
  { keys: ', and .', action: 'Step back / forward in time' },
  { keys: 'D', action: 'Read the description of the current frame' },
  { keys: 'M', action: 'Mute or unmute' },
  { keys: '?', action: 'Show this help' },
  { keys: 'Escape', action: 'Close dialogs' },
];

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Map a key event to an app action, or null to let the browser handle it. */
export function resolveShortcut(e: KeyInput): Action | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.dialogOpen) return null; // the dialog handles its own keys
  const tag = (e.tag ?? '').toLowerCase();
  const isTextEntry = tag === 'textarea' || (tag === 'input' && !['range', 'checkbox', 'radio', 'button'].includes(e.inputType ?? 'text'));
  // Text entry and <select> (type-ahead uses letters) keep every key.
  if (isTextEntry || tag === 'select') return null;
  const isNativeArrowControl =
    tag === 'select' || (tag === 'input' && ['range', 'radio'].includes(e.inputType ?? '')) || e.role === 'radio' || e.role === 'slider';
  const isNativeSpaceControl =
    tag === 'button' || tag === 'summary' || tag === 'a' || tag === 'select' || (tag === 'input' && e.inputType !== undefined);

  const arrow = ARROWS[e.key];
  if (arrow) {
    if (isNativeArrowControl) return null;
    if (!e.onMap && tag !== 'body' && tag !== '') return null;
    const k = e.shiftKey ? 10 : 1;
    return { type: 'move', dx: arrow[0] * k, dy: arrow[1] * k };
  }
  switch (e.key) {
    case ' ':
    case 'Spacebar':
      return isNativeSpaceControl ? null : { type: 'togglePlay' };
    case '[':
      return { type: 'prevTrack' };
    case ']':
      return { type: 'nextTrack' };
    case ',':
    case '<':
      return { type: 'prevFrame' };
    case '.':
    case '>':
      return { type: 'nextFrame' };
    case 'm':
    case 'M':
      return { type: 'toggleMute' };
    case 'e':
    case 'E':
      return { type: 'focusMap' };
    case 'd':
    case 'D':
      return { type: 'describe' };
    case '?':
      return { type: 'help' };
    default:
      return null;
  }
}

export function keyInputFromEvent(ev: KeyboardEvent, onMap: boolean, dialogOpen: boolean): KeyInput {
  const t = ev.target instanceof Element ? ev.target : null;
  return {
    key: ev.key,
    shiftKey: ev.shiftKey,
    ctrlKey: ev.ctrlKey,
    metaKey: ev.metaKey,
    altKey: ev.altKey,
    tag: t?.tagName.toLowerCase() ?? 'body',
    inputType: t instanceof HTMLInputElement ? t.type : undefined,
    role: t?.getAttribute('role') ?? null,
    onMap,
    dialogOpen,
  };
}
