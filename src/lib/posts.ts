import type { CollectionEntry } from 'astro:content';

export const sortPostsByPublishedAt = (posts: CollectionEntry<'posts'>[]) =>
  [...posts].sort(
    (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
  );
