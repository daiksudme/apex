import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import Home from './Home.astro';

let html: string;
let text: string;

beforeAll(async () => {
  const container = await AstroContainer.create();
  html = await container.renderToString(Home, {
    request: new Request('https://example.test/'),
  });
  // Collect text runs for assertions only. This is not an HTML sanitizer.
  text = [...html.matchAll(/>([^<]+)</g)].map((match) => match[1]).join('');
});

describe('home', () => {
  it('presents the approved identity and terminal prompt', () => {
    expect(html).toContain('<title>daiksud.me</title>');
    expect(text).toContain('daiksud@kawasaki:~$');
    expect(text).toContain('Kawasaki, Japan');
    expect(text).not.toMatch(/apex|daiksud@daiksud\.me|daiksud@tokyo/);
  });

  it('renders the welcome, profile, posts, tags and repository panes', () => {
    expect(text).toContain('つくる。試す。書き残す。');
    expect(text).toContain('Build. Learn. Write. Repeat.');
    expect(text).toContain('Latest Posts');
    expect(text).toContain('Tags');
    expect(text).toContain('Recent Commits');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it('uses pane terminology for all seven pane regions', () => {
    const sectionClasses = [...html.matchAll(/<section\b[^>]*\sclass="([^"]+)"/g)]
      .map((match) => match[1].split(/\s+/));
    const paneNames = ['welcome', 'profile', 'posts', 'tags', 'commits'];
    expect(sectionClasses).toHaveLength(paneNames.length);
    for (const name of paneNames) {
      expect(sectionClasses).toContainEqual(expect.arrayContaining(['pane', `${name}-pane`]));
    }
    expect(html).toContain('<aside class="pane sidebar-pane"');
    expect(html).toContain('<footer class="pane footer-pane"');
    expect(html).toContain('<header class="site-header">');
    expect(html).not.toContain('<header class="pane ');

    const classNames = [...html.matchAll(/\sclass="([^"]+)"/g)]
      .flatMap((match) => match[1].split(/\s+/));
    expect(classNames.filter((name) => name === 'pane')).toHaveLength(7);
    expect(classNames).not.toContain('metadata-panes');
    expect(classNames).not.toContain('site-frame');
    expect(classNames).not.toContain('main-column');
    expect(classNames.some((name) => name.includes('panel'))).toBe(false);
  });

  it('keeps the site shell and panes as direct layout regions', () => {
    expect(html).toMatch(/<body>.*<header class="site-header">.*<aside class="pane sidebar-pane".*<main id="main-content".*<footer class="pane footer-pane">.*<\/body>/s);
    expect(html).toMatch(/<div class="dashboard">\s*<section class="pane welcome-pane"/);
    expect(html).toMatch(/<\/section>\s*<section id="about" class="pane profile-pane"/);
    expect(html).toMatch(/<\/section>\s*<section id="posts" class="pane posts-pane"/);
    expect(html).toMatch(/<\/section>\s*<section id="tags" class="pane tags-pane"/);
    expect(html).toMatch(/<\/section>\s*<section class="pane commits-pane"/);
  });

  it('marks English passages for pronunciation in the Japanese document', () => {
    expect(html).toContain('<html lang="ja">');
    for (const className of ['tagline', 'profile-role', 'profile-note', 'pane-footnote', 'footer-command']) {
      expect(html).toContain(`<p class="${className}" lang="en">`);
    }
    expect(html).toContain('<p class="eyebrow" lang="en">About me</p>');
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
    for (const href of ['/posts', '/tags', '/about', '/rss.xml']) {
      expect(hrefs).not.toContain(href);
    }
    expect(html).not.toContain('<button');
  });
});
