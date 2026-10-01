import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { CollectionEntry } from 'astro:content';
import { beforeAll, describe, expect, it } from 'vitest';
import Home from './Home.astro';

const posts = [
  {
    id: 'oldest-post',
    data: {
      title: '一番古い記事',
      description: '一番古い記事の概要です。',
      publishedAt: new Date('2026-09-28T00:00:00.000Z'),
      tags: ['oldest'],
    },
  },
  {
    id: 'newest-post',
    data: {
      title: '最新の記事',
      description: '最新の記事の概要です。',
      publishedAt: new Date('2026-10-01T00:00:00.000Z'),
      tags: ['latest'],
    },
  },
  {
    id: 'third-post',
    data: {
      title: '3番目の記事',
      description: '3番目の記事の概要です。',
      publishedAt: new Date('2026-09-29T00:00:00.000Z'),
      tags: ['third'],
    },
  },
  {
    id: 'second-post',
    data: {
      title: '2番目の記事',
      description: '2番目の記事の概要です。',
      publishedAt: new Date('2026-09-30T00:00:00.000Z'),
      tags: ['second'],
    },
  },
] as CollectionEntry<'posts'>[];

let html: string;
let text: string;

beforeAll(async () => {
  const container = await AstroContainer.create();
  html = await container.renderToString(Home, {
    request: new Request('https://example.test/'),
    props: { posts },
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
    expect(html).toMatch(/つくる。<wbr\b[^>]*>試す。<wbr\b[^>]*>書き残す。/);
    expect(text).toContain('Build. Learn. Write. Repeat.');
    for (const heading of ['Welcome', 'Profile', 'Latest Posts', 'Tags', 'Recent Commits']) {
      expect(text).toContain(heading);
    }
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html.indexOf('<h1')).toBeLessThan(html.indexOf('<h2'));
  });

  it('uses tag terminology consistently', () => {
    expect(html).toContain('class="sidebar-tags"');
    expect(html).toContain('aria-label="タグ"');
    expect(html).toContain('id="tag-astro"');
    expect(html).toContain('class="tag-dot"');
    expect(text).not.toContain('Topics');
    expect(html).not.toContain('sidebar-topics');
    expect(html).not.toContain('topic-');
  });

  it('uses the shared pane header for every main content pane', () => {
    expect(html.match(/class="pane-heading"/g)).toHaveLength(5);
    for (const id of ['welcome-heading', 'profile-heading', 'posts-heading', 'tags-heading', 'commits-heading']) {
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`aria-labelledby="${id}"`);
    }
  });

  it('uses pane terminology for all seven pane regions', () => {
    const sectionClasses = [...html.matchAll(/<section\b[^>]*\sclass="([^"]+)"/g)]
      .map((match) => match[1].split(/\s+/));
    const paneNames = ['welcome', 'profile', 'posts', 'tags', 'commits'];
    expect(sectionClasses).toHaveLength(paneNames.length);
    for (const name of paneNames) {
      expect(sectionClasses).toContainEqual(expect.arrayContaining(['pane', `${name}-pane`]));
    }
    expect(html).toMatch(/<aside\b[^>]*class="pane sidebar-pane"/);
    expect(html).toMatch(/<footer\b[^>]*class="pane footer-pane"/);
    expect(html).toMatch(/<header\b[^>]*class="site-header"[^>]*>/);
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
    expect(html).toMatch(/<body\b[^>]*>.*<header\b[^>]*class="site-header"[^>]*>.*<aside\b[^>]*class="pane sidebar-pane".*<main id="main-content".*<footer\b[^>]*class="pane footer-pane".*<\/body>/s);
    expect(html).toMatch(/<div\b[^>]*class="dashboard"[^>]*>\s*<section\b[^>]*class="pane welcome-pane"/);
    expect(html).toMatch(/<\/section>\s*<section\b[^>]*class="pane profile-pane"/);
    expect(html).toMatch(/<\/section>\s*<section\b[^>]*class="pane posts-pane"/);
    expect(html).toMatch(/<\/section>\s*<section\b[^>]*class="pane tags-pane"/);
    expect(html).toMatch(/<\/section>\s*<section\b[^>]*class="pane commits-pane"/);
  });

  it('marks English passages for pronunciation in the Japanese document', () => {
    expect(html).toMatch(/<html\b(?=[^>]*lang="ja")[^>]*>/);
    for (const className of ['tagline', 'profile-role', 'profile-note', 'pane-footnote', 'footer-command']) {
      expect(html).toMatch(new RegExp(`<p\\b(?=[^>]*class="${className}")(?=[^>]*lang="en")[^>]*>`));
    }
    expect(html).toMatch(/<p\b(?=[^>]*class="eyebrow")(?=[^>]*lang="en")[^>]*>About me<\/p>/);
  });

  it('uses the actual GitHub avatar with alternative text and dimensions', () => {
    const avatar = html.match(/<img\b[^>]*>/)?.[0] ?? '';
    expect(avatar).toContain('https://avatars.githubusercontent.com/u/155234749');
    expect(avatar).toContain('alt="daiksudのGitHubアバター"');
    expect(avatar).toMatch(/width="\d+"/);
    expect(avatar).toMatch(/height="\d+"/);
  });

  it('shows the latest three posts in descending publish-date order', () => {
    expect(text).toContain('4 posts');
    expect(text).toContain('最新の記事');
    expect(text).toContain('2番目の記事');
    expect(text).toContain('3番目の記事');
    expect(text).not.toContain('一番古い記事');

    const newest = html.indexOf('href="/posts/newest-post"');
    const second = html.indexOf('href="/posts/second-post"');
    const third = html.indexOf('href="/posts/third-post"');
    expect(newest).toBeGreaterThan(-1);
    expect(newest).toBeLessThan(second);
    expect(second).toBeLessThan(third);

    const postsPane = html.match(/<section\b[^>]*class="pane posts-pane"[^>]*>.*?<\/section>/s)?.[0] ?? '';
    expect(postsPane.match(/<h3\b/g)).toHaveLength(3);
    expect(postsPane).not.toMatch(/<h2\b[^>]*class="post-summary-title"/);
  });

  it('keeps the empty state when no posts exist', async () => {
    const container = await AstroContainer.create();
    const emptyHtml = await container.renderToString(Home, {
      request: new Request('https://example.test/'),
      props: { posts: [] },
    });

    expect(emptyHtml).toContain('0 posts');
    expect(emptyHtml).toMatch(/<h3 class="empty-state-title"[^>]*>まだ記事はありません。<\/h3>/);
    expect(emptyHtml).toContain('ls posts/');
  });

  it('links only to existing home sections and external destinations', () => {
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
    const hrefs = [...html.matchAll(/\shref="([^"]+)"/g)].map((match) => match[1]);
    expect(hrefs).toContain('#main-content');
    expect(hrefs).toContain('/posts');
    expect(hrefs).toContain('/#tags');
    expect(hrefs).toContain('/#about');
    for (const href of hrefs.filter((value) => value.startsWith('/#'))) {
      expect(ids.has(href.slice(2)), `Missing target: ${href}`).toBe(true);
    }
    for (const href of ['/tags', '/about', '/rss.xml']) {
      expect(hrefs).not.toContain(href);
    }
    expect(html).not.toContain('<button');
  });
});
