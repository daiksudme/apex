import { getCollection, getEntry } from 'astro:content';

export async function getBlogContent() {
  const [posts, catalog] = await Promise.all([
    getCollection('posts'),
    getEntry('tags', 'catalog'),
  ]);
  if (!catalog) {
    throw new Error('Missing tag catalog in src/content/tags.yaml');
  }
  const tagDefinitions = catalog.data.tags;

  return { posts, tagDefinitions };
}
