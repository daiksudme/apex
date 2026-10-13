import assert from 'node:assert/strict';

export async function checkFixtureFeed(page, base) {
  const response = await page.request.get(new URL('/rss.xml', base).href);
  assert.equal(response.status(), 200, 'RSS-01 feed is available');
  const feed = await parseFeed(page, await response.text());
  assert.equal(feed.title, 'daiksud.me', 'RSS-01 channel title');
  assert.equal(feed.description, 'A blog about experiments with technology, personal projects, and what I learn and think along the way.', 'RSS-01 channel description');
  assert.equal(feed.link, 'https://daiksud.me', 'RSS-01 production channel link');
  assert.deepEqual(feed.items, [
    { title: 'フィクスチャーの記事', description: '生成HTMLを検証するための記事。', date: '2026-01-04T00:00:00.000Z', link: 'https://daiksud.me/fixture-post', guid: 'https://daiksud.me/fixture-post' },
    { title: 'second-post', description: '公開記事とは独立したフィクスチャー。', date: '2026-01-03T00:00:00.000Z', link: 'https://daiksud.me/second-post', guid: 'https://daiksud.me/second-post' },
    { title: 'third-post', description: '公開記事とは独立したフィクスチャー。', date: '2026-01-02T00:00:00.000Z', link: 'https://daiksud.me/third-post', guid: 'https://daiksud.me/third-post' },
    { title: 'フィクスチャーのプロフィール', description: '共通記事表示を確認するプロフィール。', date: '2026-01-01T00:00:00.000Z', link: 'https://daiksud.me/profile', guid: 'https://daiksud.me/profile' },
  ], 'RSS-01 all listed posts, summaries, original dates and stable URLs in publication order');
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
