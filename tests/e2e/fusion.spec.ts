import { expect, test, type Page } from '@playwright/test';

const SECTIONS = ['sensors', 'tilt', 'gyro', 'complementary', 'kalman', 'orientation', 'dead-reckoning'];

async function open(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`fusion/${query}`);
  await expect(page.locator('#dead-reckoning h2')).toBeVisible({ timeout: 30_000 });
  return errors;
}

/** feed a physically consistent motion in real time: tilt about x to 30°, a 1 °/s gyro bias, compass heading 40° */
async function feed(page: Page, seconds: number) {
  await page.evaluate(
    (seconds) =>
      new Promise<void>((resolve) => {
        const D = Math.PI / 180, g = 9.81;
        const t0 = performance.now();
        const iv = setInterval(() => {
          const t = (performance.now() - t0) / 1000;
          if (t > seconds) {
            clearInterval(iv);
            resolve();
            return;
          }
          const beta = 30 * Math.min(1, t / 2);
          const rate = t < 2 ? 15 : 0;
          window.dispatchEvent(
            new DeviceMotionEvent('devicemotion', {
              accelerationIncludingGravity: { x: 0, y: g * Math.sin(beta * D), z: g * Math.cos(beta * D) },
              acceleration: { x: 0, y: 0, z: 0 },
              rotationRate: { alpha: 0, beta: rate + 1, gamma: 0 },
              interval: 10,
            }),
          );
          window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 40, beta, gamma: 0, absolute: true }));
        }, 10);
      }),
    seconds,
  );
}

test('fusion page: every section renders without errors or formula errors', async ({ page }) => {
  const errors = await open(page);
  await expect(page).toHaveTitle(/Sensor Fusion Lab/);
  for (const id of SECTIONS) await expect(page.locator(`#${id} h2`)).toBeVisible();
  await expect(page.locator('.katex-error')).toHaveCount(0);
  // standalone: nothing from the other pages
  await expect(page.locator('#diagnose')).toHaveCount(0);
  await expect(page.locator('#sampling')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('fusion page: lecture mode hides prose and the phone layout does not scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '?mode=lecture');
  await expect(page.locator('#complementary p.self-only').first()).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('fusion page: synthetic phone sensors drive the live tilt, the Kalman bias estimate and the 3D view', async ({ page }) => {
  const errors = await open(page);
  await page.locator('#tilt [data-testid=live-start]').click();
  await expect(page.locator('#tilt [data-testid=live-status]')).toBeVisible();
  await feed(page, 12);
  // accelerometer tilt
  await expect(page.locator('[data-testid=tilt-beta]')).toHaveText(/^(29|30|31)\.\d°$/);
  // the Kalman filter learns the 1 °/s bias
  const text = (await page.locator('#kalman .card').last().textContent())!;
  const bias = parseFloat(text.match(/Estimated gyro bias (-?[\d.]+)/)![1]);
  expect(bias).toBeGreaterThan(0.6);
  expect(bias).toBeLessThan(1.4);
  // the compass-corrected estimate agrees with the phone's own orientation; gyro only has drifted
  const rows = page.locator('#orientation tbody tr');
  const diff = async (i: number) => parseFloat((await rows.nth(i).locator('td').last().textContent())!);
  expect(await diff(2)).toBeLessThan(3);
  expect(await diff(0)).toBeGreaterThan(5);
  await expect(page.locator('[data-testid=phone-madc] polygon').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('fusion page: a blocked site shows how to re-enable motion sensors', async ({ page }) => {
  await page.addInitScript(`Object.defineProperty(DeviceMotionEvent, 'requestPermission', { configurable: true, value: async () => 'denied' });`);
  await open(page);
  await page.locator('#sensors [data-testid=live-start]').click();
  await expect(page.locator('#sensors [role=alert]')).toContainText('Motion sensors');
});
