import { TRACKS } from '../../src/data/catalog';
import { audioStats, expect, expectNoSeriousA11yViolations, test, waitForFrame } from './fixtures';

test.describe('Earth Information Jukebox', () => {
  test('loads with disclaimer, records and a live (mocked) GIBS frame; no audio before a gesture', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Jukebox');
    await expect(page.getByText('Unofficial prototype built for NASA Space Apps Challenge. Not a NASA product.').first()).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(TRACKS.length + 2); // records + scan/explore
    await waitForFrame(page);
    await expect(page.getByText('Live · NASA GIBS')).toBeVisible();
    await expect(page.locator('#frame-desc')).toContainText('July 1980');
    await page.waitForTimeout(500);
    expect((await audioStats(page)).created).toBe(0);
  });

  test('Play starts the audio engine and the scan, Pause stops it', async ({ page }) => {
    await page.goto('/');
    await waitForFrame(page);
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    const s = await audioStats(page);
    expect(s.created).toBe(1);
    expect(s.state).toBe('running');
    // the scan advances on the audio clock and the "You are hearing" text follows it
    await expect(page.locator('h3:text("You Are Hearing") + p')).toContainText(/°[WE]?\. North:/, { timeout: 5000 });
    await expect(page.getByTestId('narrator')).toContainText('Playing Fever Pitch');
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
    await page.goto('/');
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
    await page.keyboard.press('Shift+ArrowUp');
    await expect(page.getByTestId('narrator')).toContainText(/\d+°[NS]? \d+°[WE]?: -?\d/);
    await expect(page.getByRole('radio', { name: 'Explore' })).toBeChecked();

    await page.keyboard.press(']');
    await expect(page.locator('#now-h')).toHaveText(TRACKS[1]!.title);
    await expect(page).toHaveURL(/record=sea-ice/);

    await page.keyboard.press('.');
    await expect(page).toHaveURL(new RegExp(`date=${TRACKS[1]!.dates[1]}`));

    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: /Keyboard and Screen-Reader Help/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.keyboard.press('m');
    await expect(page.getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('shortcuts never steal keys from focused controls', async ({ page }) => {
    await page.goto('/');
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
  });

  test('all records load and are axe-clean (serious/critical)', async ({ page }) => {
    await page.goto('/');
    await waitForFrame(page);
    for (const [i, t] of TRACKS.entries()) {
      if (i > 0) await page.getByText(t.title, { exact: true }).click();
      await expect(page.locator('#now-h')).toHaveText(t.title);
      await waitForFrame(page);
      await expectNoSeriousA11yViolations(page, `record ${t.id}`);
    }
  });

  test('axe-clean in explore mode, with sources open and with the help dialog', async ({ page }) => {
    await page.goto('/');
    await waitForFrame(page);
    await page.getByRole('radio', { name: 'Explore' }).check();
    await page.getByRole('application').click({ position: { x: 100, y: 60 } });
    await expectNoSeriousA11yViolations(page, 'explore');
    await page.getByText('Sources and Limits').click();
    await expect(page.getByText('Sound is an interpretation of the image, not a measurement.')).toBeVisible();
    await expectNoSeriousA11yViolations(page, 'sources open');
    await page.getByRole('button', { name: /Keyboard Help/ }).click();
    await expectNoSeriousA11yViolations(page, 'help dialog');
  });
});

test.describe('offline fallback', () => {
  test.use({ gibs: 'blocked' });
  test('uses bundled frames with a visible banner when GIBS is unreachable', async ({ page }) => {
    await page.goto('/');
    await waitForFrame(page);
    await expect(page.getByRole('status').filter({ hasText: 'Live NASA GIBS imagery is unavailable' })).toBeVisible();
    await expect(page.getByText('Bundled copy · NASA GIBS')).toBeVisible();
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expectNoSeriousA11yViolations(page, 'offline');
  });
});

test.describe('responsive screenshots', () => {
  for (const width of [360, 768, 1280]) {
    test(`renders without horizontal overflow at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await waitForFrame(page);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(width);
      await page.screenshot({ path: info.outputPath(`jukebox-${width}.png`), fullPage: true });
    });
  }
});

test.describe('reduced motion', () => {
  test.use({ colorScheme: 'dark', reducedMotion: 'reduce' });
  test('disables decorative animation', async ({ page }) => {
    await page.goto('/');
    await waitForFrame(page);
    const dur = await page.locator('[class*=tube]').evaluate((el) => getComputedStyle(el).animationDuration);
    expect(parseFloat(dur)).toBeLessThan(0.01);
  });
});
