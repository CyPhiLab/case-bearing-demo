import { expect, test, type Page } from '@playwright/test';

const SECTIONS = ['signal', 'classes', 'noise', 'rms', 'fourier', 'sampling', 'filters', 'convolution', 'averaging', 'mic', 'phone'];

async function open(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`signals/${query}`);
  await expect(page.locator('#phone h2')).toBeVisible({ timeout: 30_000 });
  return errors;
}

test('signals page: every section renders without errors', async ({ page }) => {
  const errors = await open(page);
  await expect(page).toHaveTitle(/Signals Lab/);
  for (const id of SECTIONS) await expect(page.locator(`#${id} h2`)).toBeVisible();
  // standalone: nothing from the bearing case study
  await expect(page.locator('#diagnose')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('aliasing: a 7.3 Hz sine sampled at 10 Hz looks like 2.7 Hz', async ({ page }) => {
  await open(page);
  await page.locator('#sampling input[type=range]').first().fill('7.3');
  await expect(page.locator('#sampling .stat .value').first()).toHaveText('2.70 Hz');
});

test('filter lab: the hum preset removes the 60 Hz line and keeps the 5 Hz signal', async ({ page }) => {
  await open(page);
  await page.locator('#filters button', { hasText: 'Remove the 60 Hz hum' }).click();
  const cells = page.locator('[data-testid=peak-table] td[data-f]');
  await expect(cells.first()).toBeVisible();
  const rows = await cells.evaluateAll((tds) => tds.map((td) => ({ f: +td.getAttribute('data-f')!, db: parseFloat(td.textContent!) })));
  const at = (f: number) => rows.reduce((a, b) => (Math.abs(b.f - f) < Math.abs(a.f - f) ? b : a));
  expect(at(60).db).toBeLessThan(-20);
  expect(Math.abs(at(5).db)).toBeLessThan(1);
});

test('mic lab: listens to a (fake) microphone and records a clip for the filter lab', async ({ page }) => {
  const errors = await open(page);
  await page.locator('[data-testid=mic-start]').click();
  await expect(page.locator('[data-testid=mic-status]')).toContainText('Listening', { timeout: 10_000 });
  await page.locator('[data-testid=mic-record]').click();
  await expect(page.locator('#mic')).toContainText('Saved as', { timeout: 10_000 });
  await expect(page.locator('[data-testid=filter-lab] select option', { hasText: 'Recording #1' })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('mic lab: the simulated clarinet is detected at 231 Hz', async ({ page }) => {
  await open(page);
  await page.locator('#mic button', { hasText: 'Use simulated sound' }).click();
  await expect(page.locator('[data-testid=mic-f0]')).toHaveText(/23[01]\.\d Hz/, { timeout: 10_000 });
});

test('phone lab: records synthetic devicemotion events and measures the sample rate', async ({ page }) => {
  await open(page);
  await page.locator('#phone button', { hasText: '5 s' }).click();
  await page.locator('[data-testid=phone-start]').click();
  await page.evaluate(() => {
    const t0 = performance.now();
    const iv = setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      if (t > 6) return clearInterval(iv);
      const z = 9.81 + Math.sin(2 * Math.PI * 4 * t);
      window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 0.1, y: 0.2, z }, interval: 10 }));
    }, 10);
  });
  await expect(page.locator('[data-testid=phone-analysis]')).toBeVisible({ timeout: 15_000 });
  const fs = parseFloat((await page.locator('[data-testid=phone-fs]').textContent())!);
  expect(fs).toBeGreaterThan(20);
  expect(fs).toBeLessThan(300);
  await expect(page.locator('#phone')).toContainText('peak 4.');
});

test('phone lab: the simulated fan shows the 60 Hz tone aliased to 40 Hz', async ({ page }) => {
  await open(page);
  await page.locator('[data-testid=phone-sim]').click();
  await expect(page.locator('#phone')).toContainText('40 Hz');
});

test('signals page: lecture mode hides prose; no horizontal scroll on a phone', async ({ page }) => {
  await open(page, '?mode=lecture');
  await expect(page.locator('#rms p.self-only').first()).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.locator('[data-testid=phone-sim]').click();
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(sw).toBeLessThanOrEqual(390);
});
