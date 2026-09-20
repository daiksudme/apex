import { expect, test } from '@playwright/test';

test('一覧からサンプル記事の本文へ移動できる', async ({ page }) => {
  const response = await page.goto('/posts');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('記事一覧 | daiksud.me');
  await expect(page.getByRole('heading', { level: 1, name: '記事一覧' })).toBeVisible();
  await page.getByRole('link', { name: 'サンプル記事：Markdownで書く' }).click();
  await expect(page).toHaveURL('/posts/markdown-sample');
  await expect(page).toHaveTitle('サンプル記事：Markdownで書く | daiksud.me');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', '記事の表示を確認するための公開サンプルです。');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByText('公開: 2026-09-20 18:00 JST')).toBeVisible();
  await expect(page.getByText('更新: 2026-09-21 09:30 JST')).toBeVisible();
  await expect(page.getByText('ノート', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '本文のサンプル' })).toBeVisible();
  await expect(page.locator('pre code')).toContainText('Hello, Markdown!');
  await expect(page.getByRole('img', { name: '青い空と緑の丘を描いたサンプル画像', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Astroのドキュメント' })).toHaveAttribute('href', 'https://docs.astro.build/');
  await expect(page.locator('a[href^="/tags"]')).toHaveCount(0);
});

test('狭い画面でも記事と画像を読める', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/posts/markdown-sample');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('navigation').getByRole('link', { name: '記事一覧' }).click();
  await expect(page).toHaveURL('/posts');
});
