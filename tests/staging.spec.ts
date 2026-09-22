import process from 'node:process';
import { expect, test } from '@playwright/test';

test.skip(!process.env.PLAYWRIGHT_BASE_URL, 'Live preview checks run against a deployed version.');

test('配信されたホーム・記事・画像を狭い画面で確認する', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['x-robots-tag']).toContain('noindex');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByRole('heading', { level: 1, name: 'daiksud.me' })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 640 });
  const posts = await page.goto('/posts/');
  expect(posts?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: '記事一覧' })).toBeVisible();
  const article = page.locator('main a[href^="/posts/"]').first();
  if (await article.count()) {
    await article.click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    for (const image of await page.locator('main img').all()) {
      await expect(image).toBeVisible();
      await expect(image).toHaveJSProperty('complete', true);
      expect(await image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
