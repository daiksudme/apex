import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import Home from './index.astro';

let html: string;
let text: string;

beforeAll(async () => {
  const container = await AstroContainer.create();
  html = await container.renderToString(Home, {
    request: new Request('https://example.test/'),
  });
  text = html.replace(/<[^>]*>/g, '');
});

describe('home', () => {
  it('presents the approved identity and terminal prompt', () => {
    expect(html).toContain('<title>daiksud.me</title>');
    expect(text).toContain('daiksud@kawasaki:~$');
    expect(text).toContain('Kawasaki, Japan');
    expect(text).not.toMatch(/apex|daiksud@daiksud\.me|daiksud@tokyo/);
  });

  it('renders the welcome, profile, posts, tags and repository panels', () => {
    expect(text).toContain('つくる。試す。書き残す。');
    expect(text).toContain('Build. Learn. Write. Repeat.');
    expect(text).toContain('Latest Posts');
    expect(text).toContain('Tags');
    expect(text).toContain('Recent Commits');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it('uses the actual GitHub avatar with alternative text and dimensions', () => {
    const avatar = html.match(/<img\b[^>]*>/)?.[0] ?? '';
    expect(avatar).toContain('https://avatars.githubusercontent.com/u/155234749');
    expect(avatar).toContain('alt="daiksudのGitHubアバター"');
    expect(avatar).toMatch(/width="\d+"/);
    expect(avatar).toMatch(/height="\d+"/);
  });

  it('shows an honest empty state instead of fabricated posts or activity', () => {
    expect(text).toContain('まだ記事はありません。');
    expect(html).toContain('https://github.com/daiksudme/apex/commits/main/');
    expect(text).not.toMatch(/2025-03-10|a1b2c3d|\bOnline\b/);
  });

  it('links only to existing home sections and external destinations', () => {
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
    const hrefs = [...html.matchAll(/\shref="([^"]+)"/g)].map((match) => match[1]);
    expect(hrefs).toContain('#main-content');
    expect(hrefs).toContain('#posts');
    expect(hrefs).toContain('#tags');
    expect(hrefs).toContain('#about');
    for (const href of hrefs.filter((value) => value.startsWith('#'))) {
      expect(ids.has(href.slice(1)), `Missing target: ${href}`).toBe(true);
    }
    expect(hrefs).not.toEqual(expect.arrayContaining(['/posts', '/tags', '/about', '/rss.xml']));
    expect(html).not.toContain('<button');
  });
});
