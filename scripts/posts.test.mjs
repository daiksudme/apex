import assert from 'node:assert/strict';
import test from 'node:test';
import { postSchema, publicPosts, formatTimestamp } from '../src/domain/posts.ts';

const article = (slug, date = '2026-09-20T18:00:00+09:00', draft = false) => ({ id: `file-${slug}`, data: { title: '記事', slug, description: '説明', publishedAt: date, tags: ['notes'], draft } });

test('公開記事は瞬間の降順、同時刻はslug昇順。未来記事は含み下書きは除く', () => {
  assert.deepEqual(publicPosts([
    article('zulu'), article('future', '2099-01-01T00:00:00Z'), article('hidden', undefined, true),
    article('alpha', '2026-09-20T09:00:00Z'), { ...article('old', '2020-01-01T00:00:00Z'), data: { ...article('old', '2020-01-01T00:00:00Z').data, updatedAt: '2100-01-01T00:00:00Z' } },
  ]).map((post) => post.data.slug), ['future', 'alpha', 'zulu', 'old']);
  assert.deepEqual(publicPosts([]), []);
});

test('必須項目、slug、厳密な日時、定義済みタグを検証する', () => {
  const valid = article('sample').data;
  for (const key of Object.keys(valid)) {
    const input = { ...valid }; delete input[key];
    assert.equal(postSchema.safeParse(input).success, false, key);
  }
  for (const patch of [
    { slug: 'Uppercase' }, { slug: 'two--parts' }, { slug: '../path' },
    { publishedAt: '2026-02-29T00:00:00Z' }, { publishedAt: '2026-09-20' },
    { publishedAt: '2026-09-20T18:00:00' }, { publishedAt: '2026-09-20T18:00+09:00' },
    { updatedAt: 'tomorrow' }, { tags: ['unknown'] }, { draft: 'false' },
    { heroImage: { src: 'https://example.test/a.png', alt: '画像' } },
    { heroImage: { src: '/images/a.svg', alt: '' } },
  ]) assert.equal(postSchema.safeParse({ ...valid, ...patch }).success, false, JSON.stringify(patch));
  assert.equal(postSchema.safeParse(valid).success, true);
  assert.equal(postSchema.safeParse({ ...valid, updatedAt: '2026-09-21T00:00:00Z', heroImage: { src: '/images/a.svg', alt: '画像' } }).success, true);
});

test('UTCオフセットの異なる同じ瞬間を日本時間で表示する', () => {
  assert.equal(formatTimestamp('2026-09-20T18:00:00+09:00'), '2026-09-20 18:00 JST');
  assert.equal(formatTimestamp('2026-09-20T09:00:00Z'), '2026-09-20 18:00 JST');
});

test('公開記事と下書きで重複したslugも拒否する', () => {
  assert.throws(() => publicPosts([article('same'), article('same', undefined, true)]), /Duplicate slug/);
});
