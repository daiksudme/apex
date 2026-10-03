import { describe, expect, it } from 'vitest';
import { deriveUsedTags, orderTagsByConfiguration } from './tags';

describe('deriveUsedTags', () => {
  it('extracts used tags once and applies configured tones with a muted fallback', () => {
    const posts = [
      { data: { tags: ['custom', 'development', 'custom'] } },
      { data: { tags: ['essay', 'development'] } },
    ];

    expect(deriveUsedTags(posts)).toEqual([
      { slug: 'custom', tone: 'muted' },
      { slug: 'development', tone: 'pink' },
      { slug: 'essay', tone: 'purple' },
    ]);
  });

  it('does not revive configured tags when there are no posts', () => {
    expect(deriveUsedTags([])).toEqual([]);
  });
});

describe('orderTagsByConfiguration', () => {
  it('keeps configured tags in configuration order and appends extra tags alphabetically', () => {
    const usedTags = [
      { slug: 'custom-z', tone: 'muted' },
      { slug: 'essay', tone: 'purple' },
      { slug: 'custom-a', tone: 'muted' },
      { slug: 'development', tone: 'pink' },
    ];

    expect(orderTagsByConfiguration(usedTags)).toEqual([
      { slug: 'development', tone: 'pink' },
      { slug: 'essay', tone: 'purple' },
      { slug: 'custom-a', tone: 'muted' },
      { slug: 'custom-z', tone: 'muted' },
    ]);
  });
});
