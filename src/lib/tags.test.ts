import { describe, expect, it } from 'vitest';
import { deriveUsedTags, orderTagsByConfiguration } from './tags';

const configuredTags = [
  { slug: 'astro', tone: 'blue' },
  { slug: 'cloudflare', tone: 'purple' },
  { slug: 'unused', tone: 'green' },
] as const;

describe('deriveUsedTags', () => {
  it('extracts used tags once and applies configured tones with a muted fallback', () => {
    const posts = [
      { data: { tags: ['custom', 'astro', 'custom'] } },
      { data: { tags: ['cloudflare', 'astro'] } },
    ];

    expect(deriveUsedTags(posts, configuredTags)).toEqual([
      { slug: 'custom', tone: 'muted' },
      { slug: 'astro', tone: 'blue' },
      { slug: 'cloudflare', tone: 'purple' },
    ]);
  });

  it('does not revive configured tags when there are no posts', () => {
    expect(deriveUsedTags([], configuredTags)).toEqual([]);
  });
});

describe('orderTagsByConfiguration', () => {
  it('keeps configured tags in configuration order and appends extra tags alphabetically', () => {
    const usedTags = [
      { slug: 'custom-z', tone: 'muted' },
      { slug: 'cloudflare', tone: 'purple' },
      { slug: 'custom-a', tone: 'muted' },
      { slug: 'astro', tone: 'blue' },
    ];

    expect(orderTagsByConfiguration(usedTags, configuredTags)).toEqual([
      { slug: 'astro', tone: 'blue' },
      { slug: 'cloudflare', tone: 'purple' },
      { slug: 'custom-a', tone: 'muted' },
      { slug: 'custom-z', tone: 'muted' },
    ]);
  });
});
