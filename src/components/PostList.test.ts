import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { CollectionEntry } from 'astro:content';
import { describe, expect, it } from 'vitest';
import PostList from './PostList.astro';

const tagDefinitions = [
  { slug: 'devops', tone: 'pink' },
  { slug: 'ai', tone: 'purple' },
];

const posts = [
  {
    id: 'newer-post',
    data: {
      title: '新しい記事',
      description: '新しい記事の概要です。',
      publishedAt: new Date('2026-10-02T00:00:00.000Z'),
      tags: ['devops', 'ai'],
    },
  },
  {
    id: 'older-post',
    data: {
      title: '古い記事',
      description: '古い記事の概要です。',
      publishedAt: new Date('2026-10-01T00:00:00.000Z'),
      tags: [],
    },
  },
] as CollectionEntry<'posts'>[];

describe('post list', () => {
  it('renders post metadata and links with h2 headings by default', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(PostList, { props: { posts, tagDefinitions } });

    expect(html).toContain('href="/posts/newer-post"');
    expect(html).toContain('href="/posts/older-post"');
    expect(html).toContain('datetime="2026-10-02"');
    expect(html).toContain('新しい記事の概要です。');
    expect(html).toContain('#devops');
    expect(html).toContain('#ai');
    expect(html).toMatch(/href="\/tags#tag-devops"[^>]*data-tone="pink"/);
    expect(html).toMatch(/href="\/tags#tag-ai"[^>]*data-tone="purple"/);
    expect(html.match(/<h1\b/g)).toBeNull();
    expect(html.match(/<h2\b/g)).toHaveLength(2);
  });

  it('can render post headings as h3 for embedded lists', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(PostList, {
      props: { posts, tagDefinitions, headingLevel: 'h3' },
    });

    expect(html.match(/<h2\b/g)).toBeNull();
    expect(html.match(/<h3\b/g)).toHaveLength(2);
  });

  it('uses the requested heading level for the empty state', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(PostList, {
      props: { posts: [], tagDefinitions, headingLevel: 'h3' },
    });

    expect(html).toMatch(/<h3 class="empty-state-title"[^>]*>まだ記事はありません。<\/h3>/);
    expect(html).toContain('ls posts/');
    expect(html).not.toContain('class="post-list"');
  });
});
