import { expect, test, type Page } from '@playwright/test';

const SECTIONS = ['strain-gauge', 'accelerometer', 'gyroscope', 'hall', 'magnetometer', 'imu', 'tof', 'ldv', 'pitot', 'thermocouple', 'thermistor', 'soft', 'fbg', 'phone'];

async function open(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`sensors/${query}`);
  await expect(page.locator('#phone h2')).toBeVisible({ timeout: 30_000 });
  return errors;
}

test('sensors page: every section renders without errors or formula errors', async ({ page }) => {
  const errors = await open(page);
  await expect(page).toHaveTitle(/Sensors Lab/);
  for (const id of SECTIONS) await expect(page.locator(`#${id} h2`)).toBeVisible();
  await expect(page.locator('.katex-error')).toHaveCount(0);
  // standalone: nothing from the other pages
  await expect(page.locator('#diagnose')).toHaveCount(0);
  await expect(page.locator('#sampling')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('sensors page: lecture mode hides prose and the phone layout does not scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '?mode=lecture');
  await expect(page.locator('#strain-gauge .self-only').first()).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('strain-gauge bridge: temperature appears in a quarter bridge but cancels in a half bridge', async ({ page }) => {
  await open(page);
  const sec = page.locator('#strain-gauge');
  const ranges = sec.locator('input[type=range]');
  await ranges.nth(2).fill('0'); // bending
  await ranges.nth(3).fill('0'); // axial
  await ranges.nth(4).fill('20'); // ΔT
  const indicated = sec.locator('.read .stat .value').nth(1);
  await sec.getByRole('radio', { name: 'Quarter', exact: true }).click();
  await expect(indicated).toHaveText('200 µε');
  await sec.getByRole('radio', { name: 'Half', exact: true }).click();
  await expect(indicated).toHaveText('0 µε');
});

test('phone lab: synthetic motion and orientation events drive the live readout and the analysis', async ({ page }) => {
  await open(page);
  await page.locator('[data-testid=imu-start]').click();
  await page.evaluate(async () => {
    for (let i = 0; i < 90; i++) {
      const th = (Math.min(i, 60) / 60) * (Math.PI / 6); // tilt to 30° about x
      window.dispatchEvent(
        new DeviceMotionEvent('devicemotion', {
          accelerationIncludingGravity: { x: 0, y: 9.81 * Math.sin(th), z: 9.81 * Math.cos(th) },
          rotationRate: { alpha: 0, beta: i < 60 ? 30 : 0, gamma: 0 },
          interval: 16,
        }),
      );
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 90, beta: 0, gamma: 0, absolute: true }));
      await new Promise((r) => setTimeout(r, 16));
    }
  });
  await expect(page.locator('[data-testid=imu-heading]')).toHaveText('270°');
  await page.locator('[data-testid=imu-stop]').click();
  await expect(page.locator('[data-testid=imu-analysis]')).toBeVisible();
});

test('phone lab: the simulated recording produces the analysis', async ({ page }) => {
  await open(page);
  await page.locator('[data-testid=imu-sim]').click();
  await expect(page.locator('[data-testid=imu-analysis]')).toContainText('60.0 Hz');
});
