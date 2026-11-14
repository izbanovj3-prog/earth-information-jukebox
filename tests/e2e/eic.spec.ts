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
