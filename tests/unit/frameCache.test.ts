import { describe, expect, it } from 'vitest';
import { LruCache, prefetchOrder } from '../../src/data/frameCache';

describe('LruCache', () => {
  it('evicts the least recently used entry', () => {
    const c = new LruCache<number>(2);
    c.set('a', 1);
    c.set('b', 2);
    expect(c.get('a')).toBe(1); // a is now most recent
    c.set('c', 3);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
    expect(c.get('c')).toBe(3);
    expect(c.size).toBe(2);
  });
  it('deletes entries', () => {
    const c = new LruCache<number>(2);
    c.set('a', 1);
    c.delete('a');
    expect(c.get('a')).toBeUndefined();
  });
});

describe('prefetchOrder', () => {
  it('loads the focus first, then the frames ahead, wrapping around', () => {
    expect(prefetchOrder(12, 0)).toEqual([0, 1, 2]);
    expect(prefetchOrder(12, 11)).toEqual([11, 0, 1]);
    expect(prefetchOrder(2, 1)).toEqual([1, 0]);
    expect(prefetchOrder(0, 0)).toEqual([]);
  });
});
