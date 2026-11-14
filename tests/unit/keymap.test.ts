import { describe, expect, it } from 'vitest';
import { resolveShortcut } from '../../src/a11y/keymap';

describe('resolveShortcut', () => {
  it('maps the documented keys from the page body', () => {
    const body = { tag: 'body' };
    expect(resolveShortcut({ ...body, key: ' ' })).toEqual({ type: 'togglePlay' });
    expect(resolveShortcut({ ...body, key: '[' })).toEqual({ type: 'prevTrack' });
    expect(resolveShortcut({ ...body, key: ']' })).toEqual({ type: 'nextTrack' });
    expect(resolveShortcut({ ...body, key: 'm' })).toEqual({ type: 'toggleMute' });
    expect(resolveShortcut({ ...body, key: '?' })).toEqual({ type: 'help' });
    expect(resolveShortcut({ ...body, key: 'e' })).toEqual({ type: 'focusMap' });
    expect(resolveShortcut({ ...body, key: '.' })).toEqual({ type: 'nextFrame' });
    expect(resolveShortcut({ ...body, key: ',' })).toEqual({ type: 'prevFrame' });
  });

  it('arrows explore on the map; Shift jumps 10x', () => {
    expect(resolveShortcut({ key: 'ArrowRight', tag: 'div', onMap: true })).toEqual({ type: 'move', dx: 1, dy: 0 });
    expect(resolveShortcut({ key: 'ArrowUp', tag: 'div', onMap: true, shiftKey: true })).toEqual({ type: 'move', dx: 0, dy: -10 });
    expect(resolveShortcut({ key: 'ArrowDown', tag: 'body' })).toEqual({ type: 'move', dx: 0, dy: 1 });
  });

  it('never steals keys from native controls', () => {
    expect(resolveShortcut({ key: ' ', tag: 'button' })).toBeNull();
    expect(resolveShortcut({ key: ' ', tag: 'summary' })).toBeNull();
    expect(resolveShortcut({ key: 'ArrowLeft', tag: 'input', inputType: 'range' })).toBeNull();
    expect(resolveShortcut({ key: 'ArrowDown', tag: 'input', inputType: 'radio' })).toBeNull();
    expect(resolveShortcut({ key: 'ArrowDown', tag: 'select' })).toBeNull();
    expect(resolveShortcut({ key: 'ArrowRight', tag: 'button' })).toBeNull();
    expect(resolveShortcut({ key: 'm', tag: 'input', inputType: 'text' })).toBeNull();
    // menus use letters for type-ahead (e.g. Key = D/E, Mood = Dramatic)
    for (const key of ['d', 'e', 'm', '[', ']', '.', ',', '?', ' ']) expect(resolveShortcut({ key, tag: 'select' })).toBeNull();
  });

  it('still allows letter shortcuts while a slider or button is focused', () => {
    expect(resolveShortcut({ key: 'm', tag: 'input', inputType: 'range' })).toEqual({ type: 'toggleMute' });
    expect(resolveShortcut({ key: ']', tag: 'button' })).toEqual({ type: 'nextTrack' });
  });

  it('ignores modified keys and keys while a dialog is open', () => {
    expect(resolveShortcut({ key: 'm', tag: 'body', ctrlKey: true })).toBeNull();
    expect(resolveShortcut({ key: '[', tag: 'body', metaKey: true })).toBeNull();
    expect(resolveShortcut({ key: ' ', tag: 'body', dialogOpen: true })).toBeNull();
  });
});
