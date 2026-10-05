import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import SiteLayout from './SiteLayout.astro';

describe('site layout navigation', () => {
  it('separates four global routes from footer social links and the brand header', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteLayout, {
      request: new Request('https://example.test/'),
      slots: { default: '<h1>ホーム</h1>' },
    });
    const nav = html.match(/<nav\b[^>]*aria-label="ページナビゲーション"[^>]*>(.*?)<\/nav>/s)?.[1] ?? '';
    expect([...nav.matchAll(/href="([^"]+)"/g)].map((match) => match[1]))
      .toEqual(['/', '/posts', '/tags', '/profile']);
    const header = html.match(/<header\b[^>]*class="site-header"[^>]*>(.*?)<\/header>/s)?.[1] ?? '';
    expect(header).not.toContain('<nav');
    expect(header).toContain('daiksud.me');
    const footer = html.match(/<footer\b[^>]*>(.*?)<\/footer>/s)?.[1] ?? '';
    for (const href of ['https://github.com/daiksud', 'https://x.com/daiksud', 'https://zenn.dev/daiksud']) {
      expect(html.match(new RegExp(`href="${href}"`, 'g'))).toHaveLength(1);
      expect(footer).toContain(`href="${href}"`);
    }
  });

  it('marks the posts index as current and active in the page navigation', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteLayout, {
      request: new Request('https://example.test/posts'),
      slots: { default: '<h1>記事</h1>' },
    });

    const postsLinks = [...html.matchAll(/<a\b[^>]*href="\/posts"[^>]*>/g)].map((match) => match[0]);
    expect(postsLinks).toHaveLength(1);
    for (const link of postsLinks) {
      expect(link).toContain('class="is-active"');
      expect(link).toContain('aria-current="page"');
    }
  });

  it('opens footer links in a new window with shared logos', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteLayout, {
      request: new Request('https://example.test/'),
      slots: { default: '<h1>ホーム</h1>' },
    });

    const anchors = [...html.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]);
    for (const href of ['https://github.com/daiksud', 'https://x.com/daiksud', 'https://zenn.dev/daiksud']) {
      const links = anchors.filter((link) => link.includes(`href="${href}"`));
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link).toContain('target="_blank"');
        expect(link).toContain('rel="noopener"');
      }
    }

    for (const brand of ['github', 'x', 'zenn']) {
      expect(html.match(new RegExp(`data-brand="${brand}"`, 'g'))).toHaveLength(1);
    }
    expect(html.match(/data-logo-style="original"/g)).toHaveLength(3);
  });

  it('keeps the posts section active on article pages without claiming the index is current', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteLayout, {
      request: new Request('https://example.test/example-post'),
      props: { activeSection: 'posts' },
      slots: { default: '<h1>記事タイトル</h1>' },
    });

    const postsLinks = [...html.matchAll(/<a\b[^>]*href="\/posts"[^>]*>/g)].map((match) => match[0]);
    expect(postsLinks).toHaveLength(1);
    for (const link of postsLinks) {
      expect(link).toContain('class="is-active"');
      expect(link).not.toContain('aria-current="page"');
    }
  });
});
