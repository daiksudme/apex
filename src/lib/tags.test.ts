import { tagDefinitions } from '../../tests/fixtures/tags';
import { describe, expect, it } from 'vitest';
import { deriveUsedTags, orderTagsByDefinition } from './tags';

describe('deriveUsedTags', () => {
  it('extracts used tags once and applies the fixture definition tones', () => {
    const posts = [
      { id: 'first-post', data: { tags: ['custom', 'development', 'custom'] } },
      { id: 'second-post', data: { tags: ['essay', 'development'] } },
    ];

    expect(deriveUsedTags(posts, tagDefinitions)).toEqual([
      { slug: 'custom', tone: 'muted' },
      { slug: 'development', tone: 'pink' },
      { slug: 'essay', tone: 'purple' },
    ]);
  });

  it('does not revive configured tags when there are no posts', () => {
    expect(deriveUsedTags([], tagDefinitions)).toEqual([]);
  });
});

describe('orderTagsByDefinition', () => {
  it('orders used tags by their definitions', () => {
    const usedTags = [
      { slug: 'custom-z', tone: 'muted' },
      { slug: 'essay', tone: 'purple' },
      { slug: 'custom-a', tone: 'muted' },
      { slug: 'development', tone: 'pink' },
    ];

    expect(orderTagsByDefinition(usedTags, tagDefinitions)).toEqual([
      { slug: 'development', tone: 'pink' },
      { slug: 'essay', tone: 'purple' },
      { slug: 'custom-a', tone: 'muted' },
      { slug: 'custom-z', tone: 'muted' },
    ]);
  });
});
