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

// test accuracy is the first stat of each training panel; training accuracy the second
const stat = async (page: Page, section: string, panel: number, which = 0) =>
  parseFloat((await page.locator(`#${section} .panel`).nth(panel).locator('.stat .value').nth(which).textContent())!);
const accuracy = (page: Page, section: string, panel: number) => stat(page, section, panel, 0);

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
  expect(await accuracy(page, 'logistic', 1)).toBeGreaterThan(95);
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

test('the overfitting preset overfits, and L2 fixes it', async ({ page }) => {
  await open(page);
  const card = page.locator('#mlp .card', { hasText: 'Neural-network playground' });
  await card.getByRole('button', { name: 'Make it overfit' }).click();
  await trainAndWait(page, 'mlp', 1);
  expect(await stat(page, 'mlp', 1, 1)).toBeGreaterThan(95); // memorized the training labels...
  expect(await accuracy(page, 'mlp', 1)).toBeLessThan(90); // ...but doesn't generalize
  await card.getByRole('button', { name: 'Fix: add L2' }).click();
  await trainAndWait(page, 'mlp', 1);
  expect(await accuracy(page, 'mlp', 1)).toBeGreaterThan(90);
});

test('the convolution animation reproduces the network output', async ({ page }) => {
  await open(page);
  const card = page.locator('#cnn .card', { hasText: 'How a convolution works' });
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole('button', { name: /Play/ }).click();
  await page.waitForTimeout(1500);
  await expect(card.locator('.num', { hasText: 'position' })).not.toHaveText('position 1 / 2017');
});

test('run-to-failure data: life slider, early warning and cross-machine test', async ({ page }) => {
  const errors = await open(page);
  const life = page.locator('#signal .card', { hasText: 'failed on its own' });
  await expect(life.getByText('Waveform')).toBeVisible({ timeout: 30_000 });
  await life.locator('input[type=range]').fill('12');
  await expect(life.getByText(/day 6\.\d/).first()).toBeVisible();
  const ew = page.locator('#diagnose .card', { hasText: 'early-warning alarm' });
  await expect(ew.locator('tr.failed td').nth(2)).toHaveText(/day 3\.\d/, { timeout: 30_000 });
  await expect(page.locator('#diagnose .card', { hasText: 'a different machine' }).getByText(/"Outer Race" for \d+%/)).toBeVisible();
  await page.locator('#rig button', { hasText: 'NASA/IMS' }).click();
  await expect(page.locator('#rig').getByText('wore out on its own')).toBeVisible();
  expect(errors).toEqual([]);
});
