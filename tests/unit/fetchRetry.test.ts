import { describe, expect, it } from 'vitest';
import { fetchWithRetry } from '../../src/eic/vendor/orchestra';

const res = (status: number) => ({ ok: status >= 200 && status < 300, status }) as Response;

/** A fetcher that answers from a script of statuses ('hang' never resolves until aborted). */
function scripted(script: (number | 'hang')[]) {
  const calls: number[] = [];
  const fetcher = (_url: string, init: RequestInit) => {
    const step = script[calls.length] ?? 200;
    calls.push(calls.length);
    if (step === 'hang')
      return new Promise<Response>((_, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    return Promise.resolve(res(step));
  };
  return { fetcher, calls };
}

describe('fetchWithRetry (orchestra samples on a static host)', () => {
  it('retries a transient 503 and succeeds', async () => {
    const s = scripted([503, 200]);
    const r = await fetchWithRetry('x.wav', { fetcher: s.fetcher, backoffMs: 1 });
    expect(r.status).toBe(200);
    expect(s.calls).toHaveLength(2);
  });

  it('does not retry a 404', async () => {
    const s = scripted([404, 200]);
    await expect(fetchWithRetry('x.wav', { fetcher: s.fetcher, backoffMs: 1 })).rejects.toThrow('x.wav: 404');
    expect(s.calls).toHaveLength(1);
  });

  it('times out a hung request and retries it', async () => {
    const s = scripted(['hang', 200]);
    const r = await fetchWithRetry('x.wav', { fetcher: s.fetcher, backoffMs: 1, timeoutMs: 20 });
    expect(r.status).toBe(200);
    expect(s.calls).toHaveLength(2);
  });

  it('gives up after the last try so Scientific keeps playing', async () => {
    const s = scripted([503, 503, 503, 200]);
    await expect(fetchWithRetry('x.wav', { fetcher: s.fetcher, backoffMs: 1, tries: 3 })).rejects.toThrow('x.wav: 503');
    expect(s.calls).toHaveLength(3);
  });
});
