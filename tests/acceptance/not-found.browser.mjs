import assert from 'node:assert/strict';

export async function checkNotFound(browser, base, width) {
  const context = await browser.newContext({
    javaScriptEnabled: false, viewport: { width, height: 900 },
  });
  const page = await context.newPage();
  try {
    for (const path of ['/missing-article-for-404-test', '/missing/nested/article-for-404-test']) {
      for (const [name, target] of [['ホーム', '/'], ['記事一覧', '/posts']]) {
        const response = await page.goto(new URL(path, base).href);
        assert.equal(response.status(), 404, 'NOTFOUND-01 missing paths return HTTP 404');
        assert.equal(response.request().redirectedFrom(), null, 'NOTFOUND-01 no error-page redirect');
        assert.equal(new URL(page.url()).pathname, path, 'NOTFOUND-01 missing URL is preserved');
        assert.match(response.headers()['content-type'] ?? '', /text\/html/, 'NOTFOUND-01 HTML response');
        if (new URL(base).protocol === 'https:') {
          assert.match(response.headers()['x-robots-tag'] ?? '', /\bnoindex\b/, 'NOTFOUND-01 hosted noindex policy');
        }
        const main = page.getByRole('main');
        assert.ok(await main.getByRole('heading', { name: '404 — ページが見つかりません', level: 1, exact: true }).isVisible());
        assert.ok(await main.getByText('お探しのページは存在しないか、移動した可能性があります。', { exact: true }).isVisible());
        assert.equal(await page.title(), 'ページが見つかりません | daiksud.me');
        assert.equal(await main.getByRole('article').count(), 0, 'NOTFOUND-01 error page is not an article');
        assert.equal(await page.getByRole('navigation', { name: 'ページナビゲーション', exact: true }).getByRole('link').count(), 4,
          'NOTFOUND-01 shared navigation remains unchanged');
        assert.ok(await page.evaluate(() => [...document.styleSheets].some((sheet) => sheet.cssRules.length > 0)),
          'NOTFOUND-02 shared styles load at the missing URL');
        for (const href of await page.locator('link[rel="stylesheet"]').evaluateAll((links) => links.map((link) => link.href))) {
          assert.equal((await page.request.get(href)).status(), 200, 'NOTFOUND-02 stylesheet resolves from nested paths');
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          'NOTFOUND-02 page fits the viewport');
        const recovery = main.getByRole('navigation', { name: 'ページの移動先', exact: true });
        assert.equal(await recovery.getByRole('link').count(), 2, 'NOTFOUND-02 two recovery destinations');
        const link = recovery.getByRole('link', { name, exact: true });
        assert.equal(await link.getAttribute('href'), target, 'NOTFOUND-02 root-relative recovery');
        assert.equal(await link.getAttribute('target'), null, 'NOTFOUND-02 same-tab recovery');
        for (let step = 0; step < 40 && !await link.evaluate((node) => node === document.activeElement); step++) {
          await page.keyboard.press('Tab');
        }
        assert.ok(await link.evaluate((node) => {
          const style = getComputedStyle(node);
          return node === document.activeElement && node.matches(':focus-visible')
            && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
        }), 'NOTFOUND-02 visible keyboard focus without JavaScript');
        await Promise.all([
          page.waitForURL(new URL(target, base).href),
          page.keyboard.press('Enter'),
        ]);
        assert.equal(context.pages().length, 1, 'NOTFOUND-02 no new tab');
        assert.equal(new URL(page.url()).origin, new URL(base).origin, 'NOTFOUND-02 stays on the current host');
        assert.equal((await page.request.get(page.url(), { maxRedirects: 0 })).status(), 200,
          'NOTFOUND-02 recovery reaches an existing page');
        assert.equal(await page.getByRole('heading', { name: '404 — ページが見つかりません', exact: true }).count(), 0);
      }
    }
  } finally {
    await context.close();
  }
}
