import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import SiteLayout from './SiteLayout.astro';

describe('site layout navigation', () => {
  it('marks the posts index as current and active in both navigation landmarks', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteLayout, {
      request: new Request('https://example.test/posts'),
      slots: { default: '<h1>記事</h1>' },
    });

    const postsLinks = [...html.matchAll(/<a\b[^>]*href="\/posts"[^>]*>/g)].map((match) => match[0]);
    expect(postsLinks).toHaveLength(2);
    for (const link of postsLinks) {
      expect(link).toContain('class="is-active"');
      expect(link).toContain('aria-current="page"');
    }
  });

  it('keeps the posts section active on article pages without claiming the index is current', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteLayout, {
      request: new Request('https://example.test/posts/example-post'),
      slots: { default: '<h1>記事タイトル</h1>' },
    });

    const postsLinks = [...html.matchAll(/<a\b[^>]*href="\/posts"[^>]*>/g)].map((match) => match[0]);
    expect(postsLinks).toHaveLength(2);
    for (const link of postsLinks) {
      expect(link).toContain('class="is-active"');
      expect(link).not.toContain('aria-current="page"');
    }
  });
});
