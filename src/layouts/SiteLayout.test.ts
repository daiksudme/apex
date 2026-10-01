import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import SiteLayout from './SiteLayout.astro';

describe('site layout navigation', () => {
  it('marks the posts index as current in both navigation landmarks', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteLayout, {
      request: new Request('https://example.test/posts'),
      slots: { default: '<h1>記事</h1>' },
    });

    const postsLinks = [...html.matchAll(/<a\b[^>]*href="\/posts"[^>]*>/g)].map((match) => match[0]);
    expect(postsLinks).toHaveLength(2);
    for (const link of postsLinks) {
      expect(link).toContain('aria-current="page"');
    }
  });
});
