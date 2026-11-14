// In-memory LRU of decoded frames for this session. GIBS WMS answers with `Cache-Control: no-store`,
// so the browser HTTP cache never helps; this avoids re-downloading frames when you switch records.

export class LruCache<V> {
  private map = new Map<string, V>();
  constructor(readonly capacity: number) {}

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }

  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value as string;
      this.map.delete(oldest);
    }
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  get size(): number {
    return this.map.size;
  }
}

/** Frames to load first: the focus, then the next `ahead` frames (wrapping), for time-lapse. */
export function prefetchOrder(count: number, focus: number, ahead = 2): number[] {
  if (count <= 0) return [];
  const out: number[] = [];
  for (let k = 0; k <= Math.min(ahead, count - 1); k++) out.push((((focus + k) % count) + count) % count);
  return out;
}
