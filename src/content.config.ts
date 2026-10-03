import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '*.md' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

const tags = defineCollection({
  loader: file('src/content/tags.yaml'),
  schema: z.object({
    tags: z.array(z.object({
      slug: z.string(),
      tone: z.enum(['blue', 'purple', 'green', 'pink', 'yellow', 'orange', 'cyan', 'muted']),
    })),
  }),
});

export const collections = { posts, tags };
