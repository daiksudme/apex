import { z } from 'astro/zod';

// Shared by content validation and display; tag pages are introduced separately.
export const tags = { notes: 'ノート' } as const;
const timestamp = z.iso.datetime({ offset: true, precision: 0 });
export const postSchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(1),
  publishedAt: timestamp,
  updatedAt: timestamp.optional(),
  tags: z.array(z.enum(Object.keys(tags) as [keyof typeof tags])),
  draft: z.boolean(),
  heroImage: z.object({
    src: z.string().regex(/^\/images\/[a-zA-Z0-9/_-]+\.(?:svg|png|jpe?g|webp|avif|gif)$/),
    alt: z.string().trim().min(1),
  }).optional(),
});

type Article = { data: { draft: boolean; publishedAt: string; slug: string } };
export function publicPosts<T extends Article>(posts: T[]): T[] {
  const slugs = new Set<string>();
  for (const { data } of posts) {
    if (slugs.has(data.slug)) throw new Error(`Duplicate slug: ${data.slug}`);
    slugs.add(data.slug);
  }
  return posts.filter(({ data }) => !data.draft).sort((a, b) =>
    Date.parse(b.data.publishedAt) - Date.parse(a.data.publishedAt) ||
    (a.data.slug < b.data.slug ? -1 : a.data.slug > b.data.slug ? 1 : 0));
}

export function formatTimestamp(value: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value)).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} JST`;
}
