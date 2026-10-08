import assert from 'node:assert/strict';

export async function checkFixtureContent(page, base) {
  const main = page.getByRole('main');
  const navigation = page.getByRole('navigation', { name: 'Page navigation', exact: true });
  const latest = page.getByRole('region', { name: 'Latest Posts', exact: true });
  assert.deepEqual(await latest.getByRole('heading', { level: 3 }).allTextContents(),
    ['フィクスチャーの記事', 'second-post', 'third-post'], 'Home shows the latest three posts');
  assert.ok(await latest.getByText('生成HTMLを検証するための記事。', { exact: true }).isVisible(), 'Post summary is readable');
  await navigation.getByRole('link', { name: 'Tags', exact: true }).click();
  assert.deepEqual(await main.getByRole('heading', { level: 2 }).allTextContents(),
    ['#fixture-tag', '#development', '#essay'], 'Used tags ordered by usage and identifier');
  assert.equal(await main.getByRole('link', { name: '#unused-tag', exact: true }).count(), 0, 'Unused tag omitted');
  const group = main.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '#fixture-tag', exact: true }) });
  assert.ok(await group.getByText('4 posts', { exact: true }).isVisible(), 'Tag counts all posts');
  assert.deepEqual(await group.getByRole('list').getByRole('link').allTextContents(),
    ['フィクスチャーの記事', 'second-post', 'third-post'], 'Tag lists only its newest three posts');
  await group.getByRole('link', { name: 'フィクスチャーの記事', exact: true }).click();
  const article = main.getByRole('article', { name: 'フィクスチャーの記事', exact: true });
  assert.ok(await article.getByRole('heading', { name: 'フィクスチャー本文', exact: true }).isVisible());
  assert.ok(await article.getByText('公開記事とは独立した検証用データです。', { exact: true }).isVisible());
  assert.ok(await article.getByRole('code').getByText('const fixture = 42;', { exact: true }).isVisible(), 'Code is readable');
  const table = article.getByRole('table');
  assert.deepEqual(await table.getByRole('columnheader').allTextContents(), ['Feature', 'Result']);
  assert.deepEqual(await table.getByRole('cell').allTextContents(), ['Markdown', 'Generated HTML']);
  assert.ok(await article.getByRole('img', { name: 'Fixture diagram', exact: true }).isVisible(), 'Image has an accessible alternative');
  const external = article.getByRole('link', { name: 'Fixture reference', exact: true });
  assert.equal(await external.getAttribute('href'), 'https://example.com/fixture-reference');
  assert.equal(await external.getAttribute('target'), '_blank', 'External link opens a new window');
  const relations = (await external.getAttribute('rel')).split(/\s+/);
  assert.ok(relations.includes('noopener'), 'External link protects its opener');
  assert.ok(!relations.includes('noreferrer'), 'External link preserves referral');
  await article.getByRole('link', { name: 'Second fixture article', exact: true }).click();
  assert.equal(new URL(page.url()).pathname, '/second-post', 'Internal Markdown navigation');
  assert.ok(await main.getByRole('heading', { level: 1, name: 'second-post', exact: true }).isVisible());
  await navigation.getByRole('link', { name: 'Profile', exact: true }).click();
  const profile = main.getByRole('article', { name: 'フィクスチャーのプロフィール', exact: true });
  assert.ok(await profile.getByText('cat profile.md', { exact: true }).isVisible());
  assert.ok(await profile.getByText('January 1, 2026', { exact: true }).isVisible(), 'Profile publication date');
  assert.ok(await profile.getByText('January 5, 2026', { exact: true }).isVisible(), 'Profile update date');
  assert.ok(await profile.getByRole('link', { name: '#development', exact: true }).isVisible(), 'Profile follows tag rules');
  for (const slug of ['fixture-post', 'second-post', 'third-post']) {
    assert.equal((await page.request.get(new URL(`/posts/${slug}`, base).href, { maxRedirects: 0 })).status(), 404,
      'Old nested article route is absent');
  }
}
