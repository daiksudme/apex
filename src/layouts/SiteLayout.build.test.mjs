// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let outDir;

const readGeneratedPage = (...segments) =>
  readFile(join(outDir, ...segments, 'index.html'), 'utf8');

const activeLinksTo = (html, href) =>
  [...html.matchAll(new RegExp(`<a\\b[^>]*href="${href}"[^>]*>`, 'g'))]
    .map((match) => match[0])
    .filter((link) => link.includes('class="is-active"'));

const sidebarTags = (html) =>
  html.match(new RegExp('<nav\\b[^>]*class="sidebar-tags"[^>]*>.*?</nav>', 's'))?.[0] ?? '';

beforeAll(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'apex-build-'));
  const astroCli = join(process.cwd(), 'node_modules', 'astro', 'bin', 'astro.mjs');

  execFileSync(process.execPath, [astroCli, 'build', '--outDir', outDir], {
    cwd: process.cwd(),
    stdio: 'pipe',
  });
}, 30_000);

afterAll(async () => {
  await rm(outDir, { recursive: true, force: true });
});

describe('generated navigation', () => {
  it.each([
    ['posts', '/posts'],
    ['tags', '/tags'],
  ])('marks /%s as the current page in both navigation landmarks', async (page, href) => {
    const html = await readGeneratedPage(page);
    const links = activeLinksTo(html, href);

    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toContain('class="is-active"');
      expect(link).toContain('aria-current="page"');
    }
  });

  it('keeps Posts active on generated article pages without marking the index current', async () => {
    const html = await readGeneratedPage('posts', 'hello-daiksud');
    const links = activeLinksTo(html, '/posts');

    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toContain('class="is-active"');
      expect(link).not.toContain('aria-current="page"');
    }
  });

  it('renders only content-backed sidebar tags with canonical fragment links and tones on every page', async () => {
    const expectedTags = [
      { slug: 'development', tone: 'pink' },
      { slug: 'essay', tone: 'purple' },
      { slug: 'ai', tone: 'muted' },
      { slug: 'continuous-delivery', tone: 'muted' },
      { slug: 'devops', tone: 'muted' },
    ];

    for (const segments of [[], ['posts'], ['tags'], ['posts', 'hello-daiksud']]) {
      const html = await readGeneratedPage(...segments);
      const sidebar = sidebarTags(html);

      expect(sidebar).not.toBe('');
      expect(sidebar).not.toContain('#astro');
      expect(sidebar).not.toContain('#cloudflare');

      let previousIndex = -1;
      for (const tag of expectedTags) {
        const href = `href="/tags#tag-${tag.slug}"`;
        const index = sidebar.indexOf(href);
        expect(index).toBeGreaterThan(previousIndex);
        expect(sidebar).toContain(`#${tag.slug}`);
        expect(sidebar).toContain(`data-tone="${tag.tone}"`);
        previousIndex = index;
      }
    }
  });
});
