import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { CollectionEntry } from 'astro:content';
import { tagDefinitions } from '../../tests/fixtures/tags';
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
    props: { posts, tagDefinitions },
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
    expect(html).toContain('href="/tags"');
    expect(html).toContain('class="tag-dot"');
    expect(text).not.toContain('Topics');
    expect(html).not.toContain('sidebar-topics');
    expect(html).not.toContain('topic-');
  });

  it('shows only tags used by posts in the home tags pane', () => {
    const tagsPaneStart = html.indexOf('class="pane tags-pane"');
    const tagsPaneEnd = html.indexOf('</section>', tagsPaneStart);
    const tagsPane = html.slice(tagsPaneStart, tagsPaneEnd);

    expect(tagsPane).toContain('4 tags');
    for (const tag of ['latest', 'second', 'third', 'oldest']) {
      expect(tagsPane).toContain(`href="/tags#tag-${tag}"`);
      expect(tagsPane).toContain(`#${tag}`);
    }
    expect(tagsPane).not.toContain('#astro');
    expect(tagsPane).not.toContain('#essay');
    expect(tagsPane).toContain('記事で使っているタグ。');
  });

  it('applies configured and fallback tones to shared home and sidebar tags', async () => {
    const container = await AstroContainer.create();
    const tagHtml = await container.renderToString(Home, {
      request: new Request('https://example.test/'),
      props: {
        tagDefinitions,
        posts: [
          {
            id: 'tag-source',
            data: {
              title: 'タグ確認',
              description: 'タグ表示確認用の記事です。',
              publishedAt: new Date('2026-10-01T00:00:00.000Z'),
              tags: ['custom', 'development'],
            },
          },
        ] as CollectionEntry<'posts'>[],
      },
    });

    const tagsPane = tagHtml.match(
      /<section\b[^>]*class="pane tags-pane"[^>]*>.*?<\/section>/s,
    )?.[0] ?? '';
    const sidebarTags = tagHtml.match(
      /<nav\b[^>]*class="sidebar-tags"[^>]*>.*?<\/nav>/s,
    )?.[0] ?? '';

    expect(tagsPane).toMatch(/href="\/tags#tag-custom"[^>]*data-tone="muted"/);
    expect(tagsPane).toMatch(/href="\/tags#tag-development"[^>]*data-tone="pink"/);
    expect(sidebarTags).toMatch(/href="\/tags#tag-development"[^>]*data-tone="pink"/);
    expect(sidebarTags).toMatch(/href="\/tags#tag-custom"[^>]*data-tone="muted"/);
    expect(sidebarTags.indexOf('#development')).toBeLessThan(sidebarTags.indexOf('#custom'));
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
    expect(html).toMatch(/<p\b(?=[^>]*class="eyebrow")(?=[^>]*lang="en")[^>]*>Profile<\/p>/);
  });

  it('uses the shared original logos for GitHub, X and Zenn everywhere', () => {
    for (const brand of ['github', 'x', 'zenn']) {
      expect(html.match(new RegExp(`data-brand="${brand}"`, 'g'))).toHaveLength(3);
    }
    expect(html.match(/data-logo-style="original"/g)).toHaveLength(9);
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
      props: { posts: [], tagDefinitions },
    });

    expect(emptyHtml).toContain('0 posts');
    expect(emptyHtml).toMatch(/<h3 class="empty-state-title"[^>]*>まだ記事はありません。<\/h3>/);
    expect(emptyHtml).toContain('ls posts/');

    const sidebarTags = emptyHtml.match(
      /<nav\b[^>]*class="sidebar-tags"[^>]*>.*?<\/nav>/s,
    )?.[0] ?? '';
    expect(sidebarTags).not.toContain('<li');
    expect(sidebarTags).not.toContain('#astro');
  });

  it('links to dedicated pages, existing home sections and external destinations', () => {
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
    const hrefs = [...html.matchAll(/\shref="([^"]+)"/g)].map((match) => match[1]);
    expect(hrefs).toContain('#main-content');
    expect(hrefs).toContain('/posts');
    expect(hrefs).toContain('/tags');
    expect(hrefs).toContain('/#profile');
    expect(hrefs).toContain('https://github.com/daiksud');
    expect(hrefs).toContain('https://x.com/daiksud');
    expect(hrefs).toContain('https://zenn.dev/daiksud');
    for (const href of hrefs.filter((value) => value.startsWith('/#'))) {
      expect(ids.has(href.slice(2)), `Missing target: ${href}`).toBe(true);
    }
    for (const href of ['/profile', '/rss.xml']) {
      expect(hrefs).not.toContain(href);
    }

    const externalLinks = [...html.matchAll(/<a\b[^>]*href="https?:\/\/[^"]+"[^>]*>/g)].map((match) => match[0]);
    expect(externalLinks.length).toBeGreaterThan(0);
    for (const link of externalLinks) {
      expect(link).toContain('target="_blank"');
      expect(link).toContain('rel="noopener"');
    }

    expect(html).not.toContain('<button');
  });
});
