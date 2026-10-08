import assert from 'node:assert/strict';

async function tagColors(scope, reference) {
  const colors = new Map();
  for (const [slug, hue] of [
    ['fixture-tag', (r, g, b) => b > r && r > g],
    ['development', (r, g, b) => r > g && g > b],
    ['essay', (r, g, b) => b > g && g > r],
  ]) {
    const link = scope.getByRole('link', { name: `#${slug}`, exact: true });
    assert.ok(await link.isVisible(), `${slug} color is visible`);
    const color = await link.evaluate((node) => getComputedStyle(node).color);
    assert.ok(hue(...color.match(/\d+/g).map(Number)), `${slug} uses its catalog hue`);
    if (reference) assert.equal(color, reference.get(slug), `${slug} color is consistent across pages`);
    colors.set(slug, color);
  }
  return colors;
}

export async function checkFixtureContent(page, base) {
  await page.setViewportSize({ width: 1440, height: 900 });
  const main = page.getByRole('main');
  const navigation = page.getByRole('navigation', { name: 'Page navigation', exact: true });
  const colors = await tagColors(page.getByRole('region', { name: 'Tags', exact: true }));
  const sidebarTags = page.getByRole('navigation', { name: 'Tags', exact: true });
  for (const [slug, color] of colors) {
    const link = sidebarTags.getByRole('link', { name: `#${slug}`, exact: true });
    assert.ok(await link.isVisible());
    assert.ok(await link.evaluate((node, expected) => [node, ...node.querySelectorAll('*')].some((paint) => {
      const rect = paint.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(paint).backgroundColor === expected;
    }), color), `${slug} sidebar marker uses the same visible color`);
  }
  await page.getByRole('region', { name: 'Tags', exact: true }).getByRole('link', { name: '#fixture-tag', exact: true }).click();
  assert.equal(new URL(page.url()).pathname + new URL(page.url()).hash, '/tags#tag-fixture-tag', 'Home tag opens its group');
  assert.ok(await main.getByRole('heading', { name: '#fixture-tag', exact: true }).isVisible());
  await navigation.getByRole('link', { name: 'Home', exact: true }).click();
  const latest = page.getByRole('region', { name: 'Latest Posts', exact: true });
  assert.deepEqual(await latest.getByRole('heading', { level: 3 }).allTextContents(),
    ['フィクスチャーの記事', 'second-post', 'third-post'], 'Home shows the latest three posts');
  assert.ok(await latest.getByText('生成HTMLを検証するための記事。', { exact: true }).isVisible(), 'Post summary is readable');
  await latest.getByRole('link', { name: 'フィクスチャーの記事', exact: true }).click();
  assert.equal(new URL(page.url()).pathname, '/fixture-post', 'Home opens the root-level article');
  assert.ok(await main.getByRole('article', { name: 'フィクスチャーの記事', exact: true }).isVisible());
  await navigation.getByRole('link', { name: 'Posts', exact: true }).click();
  await main.getByRole('link', { name: 'フィクスチャーのプロフィール', exact: true }).click();
  assert.equal(new URL(page.url()).pathname, '/profile', 'Profile participates in the post listing');
  assert.ok(await main.getByRole('article', { name: 'フィクスチャーのプロフィール', exact: true }).isVisible());
  await navigation.getByRole('link', { name: 'Tags', exact: true }).click();
  const development = main.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '#development', exact: true }) });
  await development.getByRole('link', { name: 'フィクスチャーのプロフィール', exact: true }).click();
  assert.equal(new URL(page.url()).pathname, '/profile', 'Profile participates in its tag listing');
  assert.ok(await main.getByRole('article', { name: 'フィクスチャーのプロフィール', exact: true }).isVisible());
  await navigation.getByRole('link', { name: 'Tags', exact: true }).click();
  assert.deepEqual(await main.getByRole('heading', { level: 2 }).allTextContents(),
    ['#fixture-tag', '#development', '#essay'], 'Used tags ordered by usage and identifier');
  await tagColors(main, colors);
  assert.equal(await main.getByRole('link', { name: '#unused-tag', exact: true }).count(), 0, 'Unused tag omitted');
  const group = main.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '#fixture-tag', exact: true }) });
  assert.ok(await group.getByText('4 posts', { exact: true }).isVisible(), 'Tag counts all posts');
  assert.deepEqual(await group.getByRole('list').getByRole('link').allTextContents(),
    ['フィクスチャーの記事', 'second-post', 'third-post'], 'Tag lists only its newest three posts');
  await page.setViewportSize({ width: 390, height: 900 });
  await group.getByRole('link', { name: 'フィクスチャーの記事', exact: true }).click();
  const article = main.getByRole('article', { name: 'フィクスチャーの記事', exact: true });
  await tagColors(article.getByRole('list', { name: 'Tags', exact: true }), colors);
  assert.ok(await article.getByRole('heading', { name: 'フィクスチャー本文', exact: true }).isVisible());
  assert.ok(await article.getByText('公開記事とは独立した検証用データです。', { exact: true }).isVisible());
  assert.ok(await article.getByRole('code').getByText('const fixture = 42;', { exact: true }).isVisible(), 'Code is readable');
  const table = article.getByRole('table');
  assert.deepEqual(await table.getByRole('columnheader').allTextContents(), ['Feature', 'Result']);
  assert.deepEqual(await table.getByRole('cell').allTextContents(), ['Markdown', 'Generated HTML']);
  const image = article.getByRole('img', { name: 'Fixture diagram', exact: true });
  assert.ok(await image.isVisible(), 'Image has an accessible alternative');
  assert.ok(await image.evaluate(async (element) => {
    await element.decode();
    return element.naturalWidth > 0 && element.naturalHeight > 0;
  }), 'Fixture image loads and can be decoded');
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
