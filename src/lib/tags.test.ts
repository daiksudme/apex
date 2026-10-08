import { tagDefinitions } from '../../tests/fixtures/tags';
import { describe, expect, it } from 'vitest';
import { deriveUsedTags, orderTagsByPostCount } from './tags';

describe('deriveUsedTags', () => {
  it('extracts used tags once and applies the fixture definition tones', () => {
    const posts = [
      { id: 'first-post', data: { tags: ['custom', 'development', 'custom'] } },
      { id: 'second-post', data: { tags: ['essay', 'development'] } },
    ];

    const usedTags = deriveUsedTags(posts, tagDefinitions);
    expect(usedTags).toHaveLength(3);
    expect(usedTags).toEqual(expect.arrayContaining([
      { slug: 'custom', tone: 'muted' },
      { slug: 'development', tone: 'pink' },
      { slug: 'essay', tone: 'purple' },
    ]));
  });

  it('does not revive configured tags when there are no posts', () => {
    expect(deriveUsedTags([], tagDefinitions)).toEqual([]);
  });
});

describe('orderTagsByPostCount', () => {
  it('orders used tags by post count and uses slug order for ties', () => {
    const posts = [
      { id: 'first-post', data: { tags: ['custom-z', 'essay', 'development'] } },
      { id: 'second-post', data: { tags: ['development', 'custom-a'] } },
      { id: 'third-post', data: { tags: ['development', 'custom-a'] } },
    ];
    const usedTags = deriveUsedTags(posts, tagDefinitions);

    expect(orderTagsByPostCount(usedTags, posts)).toEqual([
      { slug: 'development', tone: 'pink' },
      { slug: 'custom-a', tone: 'muted' },
      { slug: 'custom-z', tone: 'muted' },
      { slug: 'essay', tone: 'purple' },
    ]);
  });
});
