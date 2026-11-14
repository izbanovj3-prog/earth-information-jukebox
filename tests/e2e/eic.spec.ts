import { DATASETS as EIC } from '../../src/eic/vendor/datasets';
import { audioStats, expect, expectNoSeriousA11yViolations, test, waitForFrame } from './fixtures';

const sampleRequests = (page: import('@playwright/test').Page) => {
  const urls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/eic/samples/') && r.url().endsWith('.wav')) urls.push(r.url().split('/eic/samples/')[1]!);
  });
  return urls;
};

test.describe('Earth Information Center records', () => {
  test('opens on Night Lights (SVS 5313), no audio and no samples before a gesture, axe-clean', async ({ page }) => {
    const samples = sampleRequests(page);
    await page.goto('/');
    await waitForFrame(page);
    await expect(page.getByRole('radio', { name: /Night Lights 2012 → 2023/ })).toBeChecked();
    await expect(page.locator('#frame-desc')).toContainText('Global night-light brightness');
    await expect(page.getByRole('link', { name: 'SVS #5313', exact: true })).toHaveAttribute('href', 'https://svs.gsfc.nasa.gov/5313/');
    await expect(page).toHaveURL(/record=eic-nightlights/);
    await page.waitForTimeout(500);
    expect((await audioStats(page)).created).toBe(0);
    expect(samples).toEqual([]);
    await expectNoSeriousA11yViolations(page, 'EIC player, idle');
  });

  test('Play sounds at once in Scientific, loads only the needed instruments, then Orchestra takes over', async ({ page }) => {
    const samples = sampleRequests(page);
    await page.goto('/');
    await waitForFrame(page);
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    expect((await audioStats(page)).state).toBe('running');
    await expect(page.getByTestId('narrator')).toContainText(/in Scientific mode while the orchestra loads|orchestra has loaded/);
    await expect(page.getByTestId('orchestra-status')).toHaveText('Orchestra playing.', { timeout: 20_000 });
    await expect(page.getByRole('region', { name: 'Console transport controls' })).toContainText('Orchestra');
    // Night Lights needs harp, piano, glockenspiel, bass and drums, never the string sections or brass.
    const instruments = new Set(samples.map((u) => u.split('/')[0]));
    expect(instruments.has('harp')).toBe(true);
    for (const unused of ['violins', 'cellos', 'violas', 'horns', 'trumpet', 'flute', 'clarinet', 'marimba']) expect(instruments.has(unused)).toBe(false);
    await expect(page.getByTestId('eic-hearing')).toContainText(/°[WE]|0°/, { timeout: 10_000 });
    await expectNoSeriousA11yViolations(page, 'EIC player, orchestra playing');
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  });

  test('the Scientific choice is remembered across reloads and then downloads no samples', async ({ page }) => {
    const samples = sampleRequests(page);
    await page.goto('/');
    await waitForFrame(page);
    await page.getByRole('radio', { name: 'Scientific' }).check({ force: true });
    await page.reload();
    await waitForFrame(page);
    await expect(page.getByRole('radio', { name: 'Scientific' })).toBeChecked();
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(samples).toEqual([]);
    await expect(page.getByTestId('orchestra-status')).toHaveText('Scientific: synthesized, nothing to download.');
  });

  test('keyboard-only: play, explore by ear, step time, describe, next record', async ({ page }) => {
    await page.goto('/');
    await waitForFrame(page);
    await page.locator('body').focus();
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await page.keyboard.press('e');
    await expect(page.getByRole('application')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible(); // exploring pauses the sweep
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('narrator')).toContainText(/°[NS]|equator/);
    await page.locator('body').focus();
    await page.keyboard.press('.');
    await expect(page).toHaveURL(/date=2013-07-01/);
    await page.keyboard.press('d');
    await expect(page.getByTestId('narrator')).toContainText('Global night-light brightness');
    await page.keyboard.press(']');
    await expect(page).toHaveURL(/record=eic-ocean/);
    await expect(page.getByRole('radio', { name: /Sea Surface Currents/ })).toBeChecked();
  });

  test('deep link to an EIC record and frame; [ from the first GIBS record goes back to the last EIC record', async ({ page }) => {
    await page.goto('/?record=eic-lightning&date=2019-07-15');
    await waitForFrame(page);
    await expect(page).toHaveURL(/record=eic-lightning&date=2019-07-15/);
    // a date between frames snaps to the nearest one
    await page.goto('/?record=eic-lightning&date=2019-07-02');
    await waitForFrame(page);
    await expect(page).toHaveURL(/record=eic-lightning&date=2019-07-15/);
    await page.goto('/?record=air-temperature');
    await waitForFrame(page);
    await page.locator('body').focus();
    await page.keyboard.press('[');
    await expect(page).toHaveURL(/record=eic-airquality/);
  });

  test('switching to a GIBS record stops the EIC sound; the plain id "aerosols" still means the GIBS record', async ({ page }) => {
    await page.goto('/');
    await waitForFrame(page);
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await page.getByRole('radio', { name: /Fever Pitch/ }).check({ force: true });
    await expect(page.locator('#now-h')).toHaveText('Fever Pitch');
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    await page.goto('/?record=aerosols');
    await waitForFrame(page);
    await expect(page.locator('#now-h')).toHaveText('Hazy Skies');
  });

  test('the track library lists the EIC records and plays one', async ({ page }) => {
    await page.goto('/');
    await waitForFrame(page);
    await page.getByRole('button', { name: 'Browse all records →' }).click();
    await expect(page.getByText(`${EIC.length + 5} records catalogued`)).toBeVisible();
    await page.getByLabel('Filter records').fill('lightning');
    await page.getByRole('button', { name: 'Play Lightning seen from the ISS (2019)' }).click();
    await expect(page).toHaveURL(/record=eic-lightning/);
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 10_000 });
    await expectNoSeriousA11yViolations(page, 'EIC lightning playing from the library');
  });

  test('the how-to-listen sheet explains the EIC sound and credits SVS and the CC0 samples', async ({ page }) => {
    await page.goto('/');
    await waitForFrame(page);
    await page.locator('body').focus();
    await page.keyboard.press('?');
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('For this record: Night Lights 2012 → 2023');
    await expect(sheet.getByRole('link', { name: /SVS #5313/ })).toHaveAttribute('href', 'https://svs.gsfc.nasa.gov/5313/');
    await expect(sheet).toContainText('VS Chamber Orchestra 2 Community Edition');
    await expect(sheet).not.toContainText('no recordings or samples');
    await expectNoSeriousA11yViolations(page, 'EIC how-to-listen sheet');
  });

  test('playlist: this record in both modes, playing a track pauses the jukebox; the library lists all ten', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('/');
    await waitForFrame(page);
    const take = page.getByRole('region', { name: 'Take it with you' }).or(page.locator('section[aria-labelledby="eic-take-h"]'));
    const audios = take.locator('audio');
    await expect(audios).toHaveCount(2);
    const srcs = await audios.evaluateAll((els) => els.map((e) => (e as HTMLAudioElement).getAttribute('src')));
    expect(srcs.sort()).toEqual(['./eic/playlist/01-nightlights-orchestra.webm', './eic/playlist/01-nightlights-science.webm']);
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    // Start the orchestra track (muted for the test): the live jukebox pauses instead of overlapping.
    const t = await audios.first().evaluate(async (a: HTMLAudioElement) => {
      a.muted = true;
      await a.play();
      await new Promise((r) => setTimeout(r, 1200));
      return a.currentTime;
    });
    expect(t).toBeGreaterThan(0.3);
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    expect(errors.filter((e) => /Content Security Policy|media/i.test(e))).toEqual([]);

    await page.getByRole('button', { name: 'Browse all records →' }).click();
    await expect(page.locator('section[aria-labelledby="playlist-h"] audio')).toHaveCount(10);
    await expectNoSeriousA11yViolations(page, 'library with playlist');
  });

  test('instant download: the ready-made file for this record and the chosen mode', async ({ page }) => {
    await page.goto('/');
    await waitForFrame(page);
    const dl = page.getByRole('link', { name: 'Download this soundscape' });
    await expect(dl).toBeVisible();
    let t0 = Date.now();
    let d = await Promise.all([page.waitForEvent('download'), dl.click()]).then(([x]) => x);
    expect(d.suggestedFilename()).toBe('01-nightlights-orchestra.webm');
    expect(Date.now() - t0).toBeLessThan(5000);
    expect((await d.createReadStream()) && (await import('node:fs')).statSync((await d.path())!).size).toBeGreaterThan(500_000);
    await page.getByRole('radio', { name: 'Scientific' }).check({ force: true });
    t0 = Date.now();
    d = await Promise.all([page.waitForEvent('download'), dl.click()]).then(([x]) => x);
    expect(d.suggestedFilename()).toBe('01-nightlights-science.webm');
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  test('render with my mixer settings: progress bar moves, Cancel stops it, the button comes back', async ({ page }) => {
    await page.goto('/?record=eic-airquality');
    await waitForFrame(page);
    await page.getByRole('radio', { name: 'Scientific' }).check({ force: true });
    await page.getByRole('group', { name: 'Mixer' }).getByRole('button').first().click();
    await expect(page.getByText('WAV, 1 mixer layer off. Takes a minute or two.')).toBeVisible();
    const render = page.getByRole('button', { name: 'Render with my mixer settings' });
    await render.click();
    const bar = page.getByRole('progressbar', { name: 'Rendering progress' });
    await expect(bar).toBeVisible();
    await expect.poll(async () => Number(await bar.getAttribute('aria-valuenow')), { timeout: 60_000 }).toBeGreaterThan(0);
    await expect(render).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('wav-status')).toHaveText('Rendering cancelled.');
    await expect(bar).toBeHidden();
    await expect(render).toBeEnabled();
    await expectNoSeriousA11yViolations(page, 'export controls after cancel');
  });

  test('render with my mixer settings: a failure shows a clear error and keeps the ready-made download', async ({ page }) => {
    await page.addInitScript(() => {
      OfflineAudioContext.prototype.startRendering = () => Promise.reject(new Error('the browser ran out of memory'));
    });
    await page.goto('/?record=eic-lightning');
    await waitForFrame(page);
    await page.getByRole('radio', { name: 'Scientific' }).check({ force: true });
    await page.getByRole('button', { name: 'Render with my mixer settings' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Rendering failed' })).toHaveText(
      'Rendering failed: the browser ran out of memory. The ready-made download above still works.',
    );
    await expect(page.getByRole('link', { name: 'Download this soundscape' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Render with my mixer settings' })).toBeEnabled();
  });

  test('render with my mixer settings: runs to the end and the WAV has sound', async ({ page }) => {
    test.setTimeout(360_000); // a full offline render takes 1-2 minutes, more on a loaded machine
    await page.goto('/?record=eic-airquality');
    await waitForFrame(page);
    await page.getByRole('radio', { name: 'Scientific' }).check({ force: true });
    await page.getByRole('button', { name: 'Render with my mixer settings' }).click();
    const link = page.getByRole('link', { name: /Download earth-jukebox-airquality-science-my-mix\.wav/ });
    await expect(link).toBeVisible({ timeout: 330_000 });
    const d = await Promise.all([page.waitForEvent('download'), link.click()]).then(([x]) => x);
    const buf = (await import('node:fs')).readFileSync((await d.path())!);
    expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
    const sr = buf.readUInt32LE(24);
    const seconds = (buf.length - 44) / (sr * 4);
    expect(seconds).toBeGreaterThan(60);
    let sum = 0;
    for (let i = 44; i < buf.length; i += 2 * 97) sum += (buf.readInt16LE(i) / 32768) ** 2; // sparse sample
    expect(Math.sqrt(sum / ((buf.length - 44) / (2 * 97)))).toBeGreaterThan(0.01);
  });

  test('trend chart: summary for screen readers, a data table, and clicking a point jumps to that frame', async ({ page }) => {
    await page.goto('/');
    await waitForFrame(page);
    const chart = page.getByRole('img', { name: /^Global night-light brightness \(index\): [\d.]+ in 2012, [\d.]+ in 2023; highest/ });
    await expect(chart).toBeVisible();
    await page.getByText('Show as a table').click();
    const rows = page.getByRole('table', { name: /one value per frame/ }).locator('tbody tr');
    await expect(rows).toHaveCount(12);
    await expect(rows.first()).toHaveAttribute('aria-current', 'true');
    // the hit target for 2016 (5th of 12 columns)
    const box = (await chart.boundingBox())!;
    const plotLeft = box.x + (44 / 640) * box.width;
    const plotW = ((640 - 44 - 12) / 640) * box.width;
    await page.mouse.click(plotLeft + (4 / 11) * plotW, box.y + box.height / 2);
    await expect(page).toHaveURL(/date=2016-07-01/);
    await expect(rows.nth(4)).toHaveAttribute('aria-current', 'true');
    await expectNoSeriousA11yViolations(page, 'trend chart with table open');
  });

  test('mixer: layers switch off and on, activity lights move while playing; Orchestra shows colour sections', async ({ page }) => {
    await page.goto('/');
    await waitForFrame(page);
    const mixer = page.getByRole('group', { name: 'Mixer' });
    await expect(mixer.getByRole('button')).toHaveCount(3);
    const lights = mixer.getByRole('button', { name: /City lights/ });
    await expect(lights).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('radio', { name: 'Scientific' }).check({ force: true });
    await page.getByRole('button', { name: 'Play' }).click();
    await expect
      .poll(async () => mixer.locator('span.bg-primary').evaluateAll((els) => els.some((e) => parseFloat((e as HTMLElement).style.width) > 0)), { timeout: 8000 })
      .toBe(true);
    await lights.click();
    await expect(lights).toHaveAttribute('aria-pressed', 'false');
    await expect(lights).toContainText('Off');
    await lights.click();
    await expect(lights).toHaveAttribute('aria-pressed', 'true');
    await expectNoSeriousA11yViolations(page, 'mixer while playing');
    await page.getByRole('radio', { name: 'Orchestra' }).check({ force: true });
    await expect(page.getByTestId('orchestra-status')).toHaveText('Orchestra playing.', { timeout: 20_000 });
    await expect(mixer.getByRole('button', { name: /Yellow → harp/ })).toBeVisible();
    await expect(mixer.getByRole('button', { name: /Double bass/ })).toBeVisible();
  });

  test('every EIC record loads and is axe-clean', async ({ page }) => {
    for (const ds of EIC) {
      await page.goto(`/?record=eic-${ds.id}`);
      await waitForFrame(page);
      await expect(page.locator('#frame-desc')).toContainText(ds.metric.label);
      await expectNoSeriousA11yViolations(page, `EIC ${ds.id}`);
    }
  });

  test('at 390 px the map stays above the fixed transport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await waitForFrame(page);
    const map = await page.getByRole('application').boundingBox();
    const bar = await page.getByRole('region', { name: 'Console transport controls' }).boundingBox();
    expect(map!.y + map!.height).toBeLessThanOrEqual(bar!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expectNoSeriousA11yViolations(page, 'EIC 390 px');
  });
});
