import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(query);
  await expect(page.locator('#diagnose')).toBeVisible({ timeout: 30_000 });
  return errors;
}

async function trainAndWait(page: Page, section: string, index: number) {
  const button = page.locator(`#${section} button.primary`).nth(index);
  await button.click();
  await expect(button).toHaveText(/Retrain/, { timeout: 60_000 });
}

const accuracy = async (page: Page, section: string, index: number) =>
  parseFloat((await page.locator(`#${section} .panel .stat .value`).nth(index).textContent())!);

test('every section renders without errors', async ({ page }) => {
  const errors = await open(page);
  for (const id of ['rig', 'signal', 'windows', 'features', 'pca', 'logistic', 'mlp', 'cnn', 'diagnose'])
    await expect(page.locator(`#${id} h2`)).toBeVisible();
  await expect(page.locator('#cnn .prow')).toHaveCount(4, { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('logistic regression and MLP train in the browser and reach the expected accuracy', async ({ page }) => {
  await open(page);
  await trainAndWait(page, 'logistic', 0); // PCA plane: straight lines can't do it
  const lr2d = await accuracy(page, 'logistic', 0);
  expect(lr2d).toBeGreaterThan(60);
  expect(lr2d).toBeLessThan(90);
  await trainAndWait(page, 'logistic', 1); // all 18 features
  expect(await accuracy(page, 'logistic', 2)).toBeGreaterThan(95);
  await trainAndWait(page, 'mlp', 0); // PCA plane with hidden layers
  expect(await accuracy(page, 'mlp', 0)).toBeGreaterThan(95);
});

test('pretrained CNN classifies a test window correctly', async ({ page }) => {
  await open(page);
  await expect(page.locator('#cnn .verdict')).toHaveText(/Correct/, { timeout: 30_000 });
});

test('no horizontal scrolling on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('lecture mode hides self-paced material', async ({ page }) => {
  await open(page, '?mode=lecture');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'lecture');
  await expect(page.locator('.predict').first()).toBeHidden();
});
