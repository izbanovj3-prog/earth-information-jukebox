// Shared HTTP helper for the Node scripts: one timeout for request + body, a hard size cap,
// and proxy support that works on every OS.
import { spawnSync } from 'node:child_process';

/**
 * Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY=1 is set at startup. If a proxy is
 * configured and the flag is missing, re-run this script with it (no shell syntax, so it also
 * works on Windows).
 */
export function ensureProxyEnv() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxy || process.env.NODE_USE_ENV_PROXY === '1') return;
  const r = spawnSync(process.execPath, ['--no-warnings', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  });
  process.exit(r.status ?? 1);
}

/** GET with a timeout covering headers AND body, and a byte cap enforced while streaming. */
export async function get(url, { timeoutMs = 45000, maxBytes = 5_000_000, origin = 'http://localhost:5173' } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { Origin: origin } });
    const chunks = [];
    let total = 0;
    if (res.body) {
      for await (const chunk of res.body) {
        total += chunk.length;
        if (total > maxBytes) {
          ac.abort();
          throw new Error(`Response over ${maxBytes} bytes: ${url}`);
        }
        chunks.push(chunk);
      }
    }
    return {
      status: res.status,
      ok: res.ok,
      type: res.headers.get('content-type') ?? '',
      cors: res.headers.get('access-control-allow-origin'),
      body: Buffer.concat(chunks),
    };
  } catch (e) {
    if (ac.signal.aborted) throw new Error(`Timed out or aborted: ${url}`, { cause: e });
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
