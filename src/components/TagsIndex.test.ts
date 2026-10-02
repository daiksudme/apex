import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { CollectionEntry } from 'astro:content';
import { beforeAll, describe, expect, it } from 'vitest';
import TagsIndex from './TagsIndex.astro';

const posts = [
  {
    id: 'oldest-astro',
    data: {
      title: '一番古いAstro記事',
      description: '一番古いAstro記事の概要です。',
      publishedAt: new Date('2026-09-27T00:00:00.000Z'),
      tags: ['astro'],
    },
  },
  {
    id: 'cloudflare-post',
    data: {
      title: 'Cloudflareの記事',
      description: 'Cloudflare記事の概要です。',
      publishedAt: new Date('2026-09-28T00:00:00.000Z'),
      tags: ['cloudflare'],
    },
  },
  {
    id: 'third-astro',
    data: {
      title: '3番目のAstro記事',
      description: '3番目のAstro記事の概要です。',
      publishedAt: new Date('2026-09-29T00:00:00.000Z'),
      tags: ['astro'],
    },
  },
  {
    id: 'second-astro',
    data: {
      title: '2番目のAstro記事',
      description: '2番目のAstro記事の概要です。',
      publishedAt: new Date('2026-09-30T00:00:00.000Z'),
      tags: ['astro'],
    },
  },
  {
    id: 'newest-astro',
    data: {
      title: '最新のAstro記事',
      description: '最新のAstro記事の概要です。',
      publishedAt: new Date('2026-10-01T00:00:00.000Z'),
      tags: ['astro', 'testing'],
    },
  },
] as CollectionEntry<'posts'>[];

let html: string;
let text: string;

beforeAll(async () => {
  const container = await AstroContainer.create();
  html = await container.renderToString(TagsIndex, {
    request: new Request('https://example.test/tags'),
    props: { posts },
  });
  text = [...html.matchAll(/>([^<]+)</g)].map((match) => match[1]).join('');
});

describe('tags index', () => {
  it('renders the canonical tags page with the terminal command sequence', () => {
    expect(html).toContain('<title>Tags | daiksud.me</title>');
    expect(text).toContain('daiksud@kawasaki:~$');
    expect(text).toContain('cd tags/');
    expect(text).toContain('daiksud@kawasaki:~/tags$');
    expect(text).toContain('ls');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it('shows only tags used by posts and keeps content-only tags', () => {
    expect(html).toContain('3 tags');
    expect(html).toContain('id="tag-astro"');
    expect(html).toContain('id="tag-cloudflare"');
    expect(html).toContain('id="tag-testing"');
    expect(html).not.toContain('id="tag-terminal"');
    expect(html).not.toContain('id="tag-others"');
  });

  it('shows the latest three posts for each tag in descending publish-date order', () => {
    const astroStart = html.indexOf('id="tag-astro"');
    const cloudflareStart = html.indexOf('id="tag-cloudflare"');
    const astroHtml = html.slice(astroStart, cloudflareStart);

    expect(astroHtml).toContain('4 posts');
    expect(astroHtml).not.toContain('一番古いAstro記事');

    const newest = astroHtml.indexOf('href="/posts/newest-astro"');
    const second = astroHtml.indexOf('href="/posts/second-astro"');
    const third = astroHtml.indexOf('href="/posts/third-astro"');
    expect(newest).toBeGreaterThan(-1);
    expect(newest).toBeLessThan(second);
    expect(second).toBeLessThan(third);
  });

  it('does not render empty tag groups', () => {
    expect(html).not.toContain('0 posts');
    expect(html).not.toContain('No posts yet.');
  });

  it('marks Tags as the current navigation destination', () => {
    expect(html.match(/href="\/tags"[^>]*aria-current="page"/g)).toHaveLength(2);
  });
});
