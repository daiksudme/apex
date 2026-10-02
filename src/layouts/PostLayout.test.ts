import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import PostLayout from './PostLayout.astro';

describe('post layout', () => {
  it('renders article metadata and body in the shared site shell', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(PostLayout, {
      request: new Request('https://example.test/posts/example-post'),
      props: {
        title: '記事タイトル',
        description: '記事の概要です。',
        slug: 'example-post',
        publishedAt: new Date('2026-10-01T00:00:00.000Z'),
        updatedAt: new Date('2026-10-02T00:00:00.000Z'),
        tags: ['astro', 'development'],
      },
      slots: {
        default: '記事本文',
      },
    });

    expect(html).toContain('<title>記事タイトル | daiksud.me</title>');
    const article = html.match(/<article\b[^>]*>/)?.[0] ?? '';
    expect(article).toContain('class="pane post-pane"');
    expect(article).toContain('aria-labelledby="post-title"');
    expect(html).toContain('cat posts/example-post.md');
    expect(html).toMatch(/<h1 id="post-title"[^>]*>記事タイトル<\/h1>/);
    expect(html).toContain('記事の概要です。');
    expect(html).toContain('datetime="2026-10-01"');
    expect(html).toContain('datetime="2026-10-02"');
    expect(html).toContain('#astro');
    expect(html).toContain('#development');
    expect(html).toContain('記事本文');
  });

  it('opens rendered external article links in a new window and preserves rel tokens', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(PostLayout, {
      request: new Request('https://example.test/posts/example-post'),
      props: {
        title: '記事タイトル',
        description: '記事の概要です。',
        slug: 'example-post',
        publishedAt: new Date('2026-10-01T00:00:00.000Z'),
      },
      slots: {
        default: '<p><a href="https://example.com/article" rel="ugc">External</a><a href="/posts/internal">Internal</a></p>',
      },
    });

    expect(html).toContain('<a href="https://example.com/article" rel="ugc noopener noreferrer" target="_blank">External</a>');
    expect(html).toContain('<a href="/posts/internal">Internal</a>');
  });

  it('does not mark the posts index as the current article page', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(PostLayout, {
      request: new Request('https://example.test/posts/example-post'),
      props: {
        title: '記事タイトル',
        description: '記事の概要です。',
        slug: 'example-post',
        publishedAt: new Date('2026-10-01T00:00:00.000Z'),
      },
    });

    expect(html).toContain('href="/posts"');
    expect(html).toMatch(/<a\b[^>]*href="\/posts"[^>]*class="is-active"/);
    expect(html).not.toMatch(/<a\b[^>]*href="\/posts"[^>]*aria-current="page"/);
  });
});
