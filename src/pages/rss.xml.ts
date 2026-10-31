import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { site } from '../config/site';
import { getBlogContent } from '../lib/content';
import { sortPostsByPublishedAt } from '../lib/posts';

export async function GET(context: APIContext) {
  const { posts } = await getBlogContent();
  return rss({
    title: site.name,
    description: site.description,
    site: context.site!,
    trailingSlash: false,
    customData: '<language>ja</language>',
    items: sortPostsByPublishedAt(posts).map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      link: `/${post.id}`,
    })),
  });
}
