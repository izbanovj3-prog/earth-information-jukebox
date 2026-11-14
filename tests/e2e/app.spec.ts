import { TRACKS } from '../../src/data/catalog';
import { audioStats, expect, expectNoSeriousA11yViolations, gibsLog, test, waitForFrame } from './fixtures';
import { DATASETS as EIC_DATASETS } from '../../src/eic/vendor/datasets';

/** The GIBS player: the app opens on the first EIC record (Night Lights), so GIBS tests name their record. */
const GIBS_HOME = '/?record=air-temperature';
const EIC_COUNT = EIC_DATASETS.length;

/** The track rail (left column) is the scoped place to select records by title; the side panel
 * and track library repeat the same title text, so unscoped text queries would be ambiguous. */
const trackRail = (page: import('@playwright/test').Page) => page.getByRole('complementary', { name: 'Dataset track selector' });

test.describe('Earth Information Jukebox', () => {
  test('loads with disclaimer, records and a live (mocked) GIBS frame; no audio before a gesture', async ({ page }) => {
    await page.goto(GIBS_HOME);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Jukebox');
    // The same disclaimer also appears (hidden) inside the closed how-to-listen dialog; the footer is the always-visible copy.
    await expect(page.getByRole('contentinfo').getByText('Unofficial prototype built for NASA Space Apps Challenge. Not a NASA product.')).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(EIC_COUNT + TRACKS.length + 2); // EIC + GIBS records + scan/explore
    await waitForFrame(page);
    await expect(page.getByText('Live · NASA GIBS')).toBeVisible();
    await expect(page.locator('#frame-desc')).toContainText('July 1980');
    await page.waitForTimeout(500);
    expect((await audioStats(page)).created).toBe(0);
  });

  test('Play starts the audio engine and the scan, Pause stops it', async ({ page }) => {
    await page.goto(GIBS_HOME);
    await waitForFrame(page);
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    const s = await audioStats(page);
    expect(s.created).toBe(1);
    expect(s.state).toBe('running');
    // the scan advances on the audio clock and the "You are hearing" text follows it
    await expect(page.locator('h3:text("You Are Hearing") + p')).toContainText(/°[WE]?\. North:/, { timeout: 5000 });
    await expect(page.getByTestId('narrator')).toContainText('Playing Fever Pitch');
    await expectNoSeriousA11yViolations(page, 'while playing');
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect.poll(async () => (await audioStats(page)).state).toBe('suspended');
    // Play again reuses the same context (resume, not a new one)
    await page.getByRole('button', { name: 'Play' }).click();
    await expect.poll(async () => (await audioStats(page)).state).toBe('running');
    const again = await audioStats(page);
    expect(again.created).toBe(1);
    expect(again.resumed).toBeGreaterThanOrEqual(1);
  });

  test('keyboard-only: play, explore, switch record, time step, help', async ({ page }) => {
    await page.goto(GIBS_HOME);
    await waitForFrame(page);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to the player' })).toBeFocused();
    await page.keyboard.press('Escape');
    await page.locator('body').focus();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

    await page.keyboard.press('e');
    await expect(page.getByRole('application')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    const readout = page.locator('[class*=readout]');
    await expect(readout).toContainText('2°W'); // one step = 2°
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(readout).toContainText('22°W'); // Shift = 10 steps = 20°
    await page.keyboard.press('Shift+ArrowUp');
    await expect(page.getByTestId('narrator')).toContainText(/\d+°[NS]? \d+°[WE]?: -?\d/);
    await expect(page.getByRole('radio', { name: 'Explore' })).toBeChecked();

    await page.keyboard.press(']');
    await expect(page.locator('#now-h')).toHaveText(TRACKS[1]!.title);
    await expect(page).toHaveURL(/record=sea-ice/);

    await page.keyboard.press('.');
    await expect(page).toHaveURL(new RegExp(`date=${TRACKS[1]!.dates[1]}`));

    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'How to listen' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.getByText('Sound settings', { exact: true }).click();
    await page.keyboard.press('m');
    await expect(page.getByRole('button', { name: 'Mute [M]' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('shortcuts never steal keys from focused controls', async ({ page }) => {
    await page.goto(GIBS_HOME);
    await waitForFrame(page);
    const time = page.getByRole('slider', { name: /Time/ });
    await time.focus();
    await page.keyboard.press('ArrowRight');
    await expect(time).toHaveValue('1');
    expect((await audioStats(page)).created).toBe(0); // arrows moved the slider, not the explorer
  });

  test('deep link opens the requested record and date', async ({ page }) => {
    await page.goto('/?record=vegetation&date=2024-07-01');
    await waitForFrame(page);
    await expect(page.locator('#now-h')).toHaveText('Green Pulse');
    await expect(page.locator('#frame-desc')).toContainText('July 2024');
    // the first frame (baseline) is loaded too, so the change is described
    await expect(page.locator('#frame-desc')).toContainText(/(Up|Down) [\d.]+\u00a0NDVI compared with January 2024/);
  });

  test('an unknown record or date in the URL is reported, not silently replaced', async ({ page }) => {
    await page.goto('/?record=sea-ice&date=2014-10-01');
    await waitForFrame(page);
    await expect(page.getByRole('status').filter({ hasText: 'has no frame for “2014-10-01”' })).toContainText('showing 15 September 2014');
    await expect(page).toHaveURL(/date=2014-09-15/);
    await page.goto('/?record=nope');
    await waitForFrame(page);
    await expect(page.getByRole('status').filter({ hasText: 'There is no record called “nope”' })).toBeVisible();
  });

  test('loads lazily (focus, two ahead, baseline) and reuses frames across record switches', async ({ page }) => {
    await page.goto(GIBS_HOME);
    await waitForFrame(page);
    await page.waitForTimeout(500);
    const log = gibsLog.get(page)!;
    expect(new Set(log).size).toBe(3);
    const before = log.filter((x) => x.startsWith('MERRA2_2m')).length;
    await page.keyboard.press(']');
    await waitForFrame(page);
    await page.keyboard.press('[');
    await waitForFrame(page);
    await page.waitForTimeout(300);
    expect(log.filter((x) => x.startsWith('MERRA2_2m')).length).toBe(before);
  });

  test('time-lapse advances to the next date after a sweep', async ({ page }) => {
    await page.goto(GIBS_HOME);
    await waitForFrame(page);
    await page.getByRole('slider', { name: /Tempo/ }).fill('10');
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page).toHaveURL(/date=1984-07-01/, { timeout: 12_000 });
    await expect(page.getByTestId('narrator')).toContainText(/July 1984\. Average/);
  });

  test('pauses all audio when the tab is hidden, also in explore mode', async ({ page }) => {
    await page.goto(GIBS_HOME);
    await waitForFrame(page);
    await page.getByRole('button', { name: 'Play' }).click();
    await page.keyboard.press('e');
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await audioStats(page)).state).toBe('running');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(async () => (await audioStats(page)).state).toBe('suspended');
    await expect(page.getByTestId('narrator')).toContainText('Paused because the tab was hidden.');
  });

  test('narration Off keeps the live region quiet; menus keep their letter keys', async ({ page }) => {
    await page.goto(GIBS_HOME);
    await waitForFrame(page);
    await page.getByText('Sound settings', { exact: true }).click();
    await page.getByRole('combobox', { name: 'Spoken narration' }).selectOption('off');
    const key = page.getByRole('combobox', { name: 'Key' });
    await key.focus();
    await page.keyboard.press('d');
    await expect(key).toHaveValue('50'); // D, not the "describe" shortcut
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('narrator')).not.toContainText('Playing');
  });

  test('shows an error with Try Again when a frame cannot be loaded, and recovers', async ({ page }) => {
    await page.route('**/frames/air-temperature/**', (r) => r.fulfill({ status: 404, body: 'gone' }));
    await page.unroute('https://gibs.earthdata.nasa.gov/**');
    await page.route('https://gibs.earthdata.nasa.gov/**', (r) => r.abort('internetdisconnected'));
    await page.goto(GIBS_HOME);
    await expect(page.getByRole('alert')).toContainText('could not be loaded');
    await expectNoSeriousA11yViolations(page, 'frame error');
    await page.unroute('**/frames/air-temperature/**');
    await page.getByRole('button', { name: 'Try Again' }).click();
    await waitForFrame(page);
    await expect(page.getByText('Bundled copy · NASA GIBS')).toBeVisible();
  });

  test('all records load and are axe-clean (serious/critical)', async ({ page }) => {
    await page.goto(GIBS_HOME);
    await waitForFrame(page);
    for (const [i, t] of TRACKS.entries()) {
      if (i > 0) await trackRail(page).getByText(t.title, { exact: true }).click();
      await expect(page.locator('#now-h')).toHaveText(t.title);
      await waitForFrame(page);
      await expectNoSeriousA11yViolations(page, `record ${t.id}`);
    }
  });

  test('axe-clean in explore mode and with the how-to-listen sheet open', async ({ page }) => {
    await page.goto(GIBS_HOME);
    await waitForFrame(page);
    await page.locator('label', { has: page.getByRole('radio', { name: 'Explore' }) }).click();
    await page.getByRole('application').click({ position: { x: 100, y: 60 } });
    await expectNoSeriousA11yViolations(page, 'explore');
    const trigger = page.getByRole('button', { name: /How to listen/ }).first();
    await trigger.click();
    const sheet = page.getByRole('dialog', { name: 'How to listen' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Sound is an interpretation of the image, not a measurement.')).toBeVisible();
    await expectNoSeriousA11yViolations(page, 'how-to-listen sheet open');
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused(); // focus returns to the trigger
  });

  test('track library: browse, filter and play a record from the catalog', async ({ page }) => {
    await page.goto(GIBS_HOME);
    await waitForFrame(page);
    await page.getByRole('button', { name: /Browse all records/ }).click();
    await expect(page.getByRole('heading', { name: 'Choose a record' })).toBeVisible();
    await expectNoSeriousA11yViolations(page, 'track library');

    await page.getByLabel('Filter records').fill('vegetation');
    await expect(page.getByRole('button', { name: 'Green Pulse' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fever Pitch' })).toHaveCount(0);
    await page.getByLabel('Filter records').fill('');

    await page.getByRole('button', { name: 'Play', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Choose a record' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  });
});

test.describe('demo tour', () => {
  test('starts from a button press, narrates, and any shortcut hands control back', async ({ page }) => {
    await page.goto('/?record=vegetation');
    await waitForFrame(page);
    const tour = page.getByRole('button', { name: /Demo Tour/ });
    await tour.click();
    await expect(tour).toHaveAttribute('aria-pressed', 'true');
    // The tour opens on the first Earth Information Center record.
    await expect(page).toHaveURL(/record=eic-nightlights/);
    await expect(page.getByTestId('narrator')).toContainText(/Demo tour|Playing Night Lights/);
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 10_000 });
    // Both engines were unlocked inside the click (EIC now, GIBS for later steps).
    expect((await audioStats(page)).created).toBe(2);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press(' ');
    await expect(tour).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  });
});

test.describe('demo tour script', () => {
  test('visits each scripted step on time and ends', async ({ page }) => {
    test.setTimeout(60_000);
    await page.clock.install();
    await page.goto('/');
    await waitForFrame(page);
    await page.getByRole('button', { name: /Demo Tour/ }).click();
    // Freeze page time so only fastForward() moves the tour (assertions take real time).
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 50);
    await expect(page).toHaveURL(/record=eic-nightlights&date=2012-07-01/);
    await page.clock.fastForward(12_500);
    await expect(page).toHaveURL(/record=eic-nightlights&date=2023-07-01/);
    await page.clock.fastForward(10_000); // 22.5 s
    await expect(page).toHaveURL(/record=eic-lightning&date=2019-07-15/);
    await page.clock.fastForward(12_000); // 34.5 s
    await expect(page.locator('#now-h')).toHaveText('Fever Pitch');
    await waitForFrame(page);
    await page.clock.fastForward(12_000); // 46.5 s
    await expect(page).toHaveURL(/record=air-temperature&date=2024-07-01/);
    await page.clock.fastForward(10_000); // 56.5 s
    await expect(page.locator('#now-h')).toHaveText('Thin Ice');
    await expect(page).toHaveURL(/date=2012-09-15/);
    await waitForFrame(page);
    await page.clock.fastForward(8_000); // 64.5 s
    await expect(page.getByRole('radio', { name: 'Explore' })).toBeChecked();
    await expect(page.locator('[class*=readout]')).toContainText('82°N 150°W');
    await page.clock.fastForward(10_000); // 74.5 s
    await expect(page.locator('#now-h')).toHaveText('Green Pulse');
    await page.clock.fastForward(24_000); // 98.5 s
    await expect(page.getByRole('button', { name: /Demo Tour/ })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('narrator')).toContainText('Demo tour finished.');
  });
});

test.describe('offline fallback', () => {
  test.use({ gibs: 'blocked' });
  test('uses bundled frames with a visible banner when GIBS is unreachable', async ({ page }) => {
    await page.goto(GIBS_HOME);
    await waitForFrame(page);
    await expect(page.getByRole('status').filter({ hasText: 'Live NASA GIBS imagery is unavailable' })).toBeVisible();
    await expect(page.getByText('Bundled copy · NASA GIBS')).toBeVisible();
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expectNoSeriousA11yViolations(page, 'offline');
    // the banner stays on the next record, after the session stopped asking GIBS
    await page.keyboard.press(']');
    await waitForFrame(page);
    await expect(page.getByRole('status').filter({ hasText: 'Live NASA GIBS imagery is unavailable' })).toBeVisible();
    await expectNoSeriousA11yViolations(page, 'offline, second record');
  });
});

test.describe('responsive screenshots', () => {
  for (const width of [360, 768, 1280]) {
    test(`renders without horizontal overflow at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(GIBS_HOME);
      await waitForFrame(page);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(width);
      await page.screenshot({ path: info.outputPath(`jukebox-${width}.png`), fullPage: true });
    });
  }
});

test.describe('phone layout', () => {
  test('at 390 px the fixed transport leaves the whole map visible; secondary controls open on demand', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?record=air-temperature');
    await waitForFrame(page);
    const map = await page.getByRole('application').boundingBox();
    const bar = await page.getByRole('region', { name: 'Console transport controls' }).boundingBox();
    expect(map && bar).toBeTruthy();
    expect(map!.y + map!.height).toBeLessThanOrEqual(bar!.y);
    expect(bar!.height).toBeLessThan(140);
    const volume = page.getByRole('slider', { name: /Volume/ });
    await expect(volume).toBeHidden();
    await page.getByRole('button', { name: 'More controls ▾' }).click();
    await expect(volume).toBeVisible();
    await expectNoSeriousA11yViolations(page, '390 px, more controls open');
  });
});

test.describe('build hardening', () => {
  test('CSP allows same-origin media (playlist) and the favicon is the project record icon', async ({ page }) => {
    await page.goto(GIBS_HOME);
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("media-src 'self'");
    const icon = (await page.locator('link[rel="icon"]').getAttribute('href')) ?? '';
    // No NASA-insignia lookalike (NASA blue #0b3d91 disc) from the teammate prototype.
    expect(decodeURIComponent(icon).toLowerCase()).not.toContain('0b3d91');
    expect(decodeURIComponent(icon).toLowerCase()).toContain('ffb547');
  });
});

test.describe('reduced motion', () => {
  test.use({ colorScheme: 'dark', reducedMotion: 'reduce' });
  test('disables decorative animation', async ({ page }) => {
    await page.goto(GIBS_HOME);
    await waitForFrame(page);
    const dur = await page.locator('[class*=tube]').first().evaluate((el) => getComputedStyle(el).animationDuration);
    expect(parseFloat(dur)).toBeLessThan(0.01);
  });
});
