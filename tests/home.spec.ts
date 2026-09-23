import { expect, test } from '@playwright/test';

test('ホームにサイト名と説明を表示する', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('daiksud.me');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByRole('heading', { level: 1, name: 'daiksud.me' })).toBeVisible();
  await expect(page.getByText('サイトを準備しています。')).toBeVisible();
  const home = page.getByRole('link', { name: 'daiksud.me ホーム' });
  await expect(home).toHaveAttribute('href', '/');
  await home.click();
  await expect(page).toHaveURL('/');
});

test('幅320pxでも内容を読める', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'daiksud.me' })).toBeVisible();
  await expect(page.getByText('サイトを準備しています。')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('ホームは記事一覧へ案内しない', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '記事一覧' })).toHaveCount(0);
});

for (const path of ['/posts', '/posts/markdown-sample', '/missing']) {
  test(`${path} は存在せず404を返す`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  });
}
