import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

interface Manifest {
  tracks: Record<string, { layerId: string; frames: { date: string; file: string }[] }>;
}
const manifest = JSON.parse(readFileSync(new URL('../../public/frames/manifest.json', import.meta.url), 'utf8')) as Manifest;
const byLayerDate = new Map<string, string>();
for (const t of Object.values(manifest.tracks)) for (const f of t.frames) byLayerDate.set(`${t.layerId}|${f.date}`, f.file);

export type GibsMode = 'mock' | 'blocked';

/** GIBS requests seen by the mock, for request-count assertions. */
export const gibsLog = new WeakMap<Page, string[]>();

/** Serve GIBS WMS from the bundled copies (deterministic, no network) or block it entirely. */
export async function routeGibs(page: Page, mode: GibsMode) {
  const log: string[] = [];
  gibsLog.set(page, log);
  await page.route('https://gibs.earthdata.nasa.gov/**', async (route) => {
    const u = new URL(route.request().url());
    log.push(`${u.searchParams.get('LAYERS')}|${u.searchParams.get('TIME')}`);
    if (mode === 'blocked') return route.abort('internetdisconnected');
    const file = byLayerDate.get(`${u.searchParams.get('LAYERS')}|${u.searchParams.get('TIME')}`);
    if (!file) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' },
      body: readFileSync(new URL(`../../public/${file}`, import.meta.url)),
    });
  });
}

/** Count AudioContext creation and resume calls (no audio should exist before a user gesture). */
export async function spyAudio(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __audio: { created: number; resumed: number; last: AudioContext | null };
      AudioContext: typeof AudioContext;
    };
    w.__audio = { created: 0, resumed: 0, last: null };
    const Real = w.AudioContext;
    class Spy extends Real {
      constructor(opts?: AudioContextOptions) {
        super(opts);
        w.__audio.created++;
        w.__audio.last = this;
      }
      override resume() {
        w.__audio.resumed++;
        return super.resume();
      }
    }
    w.AudioContext = Spy;
  });
}

export const audioStats = (page: Page) =>
  page.evaluate(() => {
    const a = (window as unknown as { __audio: { created: number; resumed: number; last: AudioContext | null } }).__audio;
    return { created: a.created, resumed: a.resumed, state: a.last?.state ?? 'none' };
  });

export async function expectNoSeriousA11yViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    `axe serious/critical violations on ${label}`,
  ).toEqual([]);
}

/** Wait until the frame in focus is on screen (works whether the player is playing or paused). */
export async function waitForFrame(page: Page) {
  await expect(page.locator('button[aria-keyshortcuts="Space"]')).toBeEnabled({ timeout: 20_000 });
  await expect(page.locator('#frame-desc')).not.toContainText(/^Loading/, { timeout: 20_000 });
}

export const test = base.extend<{ gibs: GibsMode }>({
  gibs: ['mock', { option: true }],
  page: async ({ page, gibs }, use) => {
    await routeGibs(page, gibs);
    await spyAudio(page);
    await use(page);
  },
});
export { expect };
