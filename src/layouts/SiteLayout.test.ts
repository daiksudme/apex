import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import SiteLayout from './SiteLayout.astro';

describe('site layout navigation', () => {
  it('marks the posts index as the current page', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteLayout, {
      request: new Request('https://example.test/posts'),
      slots: { default: '<h1>記事</h1>' },
    });

    expect(html).toMatch(/<a href="\/posts"[^>]*aria-current="page"[^>]*>.*Posts.*<\/a>/s);
  });
});
