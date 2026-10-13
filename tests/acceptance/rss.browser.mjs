import assert from 'node:assert/strict';

export async function checkFooterFeed(page, base) {
  const link = page.getByRole('contentinfo').getByRole('link', { name: 'RSS', exact: true });
  assert.ok(await link.isVisible(), 'RSS-06 visible footer RSS link');
  assert.equal(await link.getAttribute('href'), '/rss.xml', 'RSS-06 current host feed path');
  await page.mouse.move(0, 0);
  await link.scrollIntoViewIfNeeded();
  const box = await link.boundingBox();
  const clip = { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 };
  const unfocused = await page.screenshot({ clip, animations: 'disabled' });
  await page.getByRole('contentinfo').getByRole('link', { name: 'daiksud on Zenn', exact: true }).focus();
  await page.keyboard.press('Tab');
  const focused = await page.screenshot({ clip, animations: 'disabled' });
  assert.ok(await link.evaluate((node) => node === document.activeElement), 'RSS-06 keyboard focus reaches RSS');
  assert.notDeepEqual(focused, unfocused, 'RSS-06 focus is visibly indicated');
  const [response] = await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
  assert.equal(new URL(page.url()).pathname, '/rss.xml', 'RSS-06 feed destination');
  assert.equal(response.status(), 200, 'RSS-06 keyboard activation opens feed');
  assert.match(response.headers()['content-type'], /^(application\/(rss\+xml|xml)|text\/xml)(;|$)/i, 'RSS-06 XML media type');
  const feed = await parseFeed(page, await response.text());
  assert.equal(feed.link, 'https://daiksud.me', 'RSS-06 feed keeps production origin');
  await page.goto(base);
}

export async function checkFeedDiscovery(page) {
  const discovery = page.locator('head link[rel="alternate"][type="application/rss+xml"]');
  assert.equal(await discovery.count(), 1, 'RSS-05 one RSS discovery link');
  assert.equal(await discovery.getAttribute('href'), 'https://daiksud.me/rss.xml', 'RSS-05 production discovery URL');
  assert.equal(await discovery.getAttribute('title'), 'daiksud.me', 'RSS-05 feed title');
}

export async function checkFixtureFeed(page, base, { empty = false } = {}) {
  const response = await page.request.get(new URL('/rss.xml', base).href);
  assert.equal(response.status(), 200, 'RSS-01 feed is available');
  const feed = await parseFeed(page, await response.text());
  assert.equal(feed.title, 'daiksud.me', 'RSS-01 channel title');
  assert.equal(feed.description, 'A blog about experiments with technology, personal projects, and what I learn and think along the way.', 'RSS-01 channel description');
  assert.equal(feed.link, 'https://daiksud.me', 'RSS-01 production channel link');
  assert.deepEqual(feed.items, empty ? [] : [
    { title: 'フィクスチャーの記事', description: '生成HTMLを検証するための記事。', date: '2026-01-04T00:00:00.000Z', link: 'https://daiksud.me/fixture-post', guid: 'https://daiksud.me/fixture-post' },
    { title: 'second-post', description: '公開記事とは独立したフィクスチャー。', date: '2026-01-03T00:00:00.000Z', link: 'https://daiksud.me/second-post', guid: 'https://daiksud.me/second-post' },
    { title: 'third-post', description: '公開記事とは独立したフィクスチャー。', date: '2026-01-02T00:00:00.000Z', link: 'https://daiksud.me/third-post', guid: 'https://daiksud.me/third-post' },
    { title: 'フィクスチャーのプロフィール', description: '共通記事表示を確認するプロフィール。', date: '2026-01-01T00:00:00.000Z', link: 'https://daiksud.me/profile', guid: 'https://daiksud.me/profile' },
  ], empty ? 'RSS-04 empty collection has no feed items' : 'RSS-01 all listed posts, summaries, original dates and stable URLs in publication order');
  assert.equal(feed.fullContentCount, 0, 'RSS-01 summary-only feed');
}

export async function parseFeed(page, xml) {
  return page.evaluate((xml) => {
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    if (document.querySelector('parsererror')) throw new Error('RSS-01 invalid XML');
    const channel = document.querySelector('rss > channel');
    if (!channel) throw new Error('RSS-01 missing RSS channel');
    const text = (node, name) => node.querySelector(name)?.textContent;
    return {
      title: text(channel, ':scope > title'),
      description: text(channel, ':scope > description'),
      link: text(channel, ':scope > link'),
      items: [...channel.querySelectorAll('item')].map((item) => ({
        title: text(item, 'title'), description: text(item, 'description'),
        date: new Date(text(item, 'pubDate')).toISOString(),
        link: text(item, 'link'), guid: text(item, 'guid'),
      })),
      fullContentCount: document.getElementsByTagNameNS('http://purl.org/rss/1.0/modules/content/', 'encoded').length,
    };
  }, xml);
}
