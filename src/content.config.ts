import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { postSchema } from './domain/posts';

const posts = defineCollection({
  // File identity preserves both entries so duplicate frontmatter slugs can fail the build.
  loader: glob({ pattern: '**/*.md', base: './src/content/posts', generateId: ({ entry }) => entry }),
  schema: postSchema,
});
export const collections = { posts };
