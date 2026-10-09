import type { CollectionEntry } from 'astro:content';
import { describe, expect, it } from 'vitest';
import { sortPostsByPublishedAt } from './posts';

describe('post publication order', () => {
  it('returns the newest posts first from unordered content', () => {
    const posts = [
      { id: 'oldest', data: { publishedAt: new Date('2026-01-01') } },
      { id: 'newest', data: { publishedAt: new Date('2026-01-03') } },
      { id: 'middle', data: { publishedAt: new Date('2026-01-02') } },
    ] as CollectionEntry<'posts'>[];
    expect(sortPostsByPublishedAt(posts).map((post) => post.id)).toEqual(['newest', 'middle', 'oldest']);
  });
});
