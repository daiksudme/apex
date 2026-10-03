// @ts-nocheck
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const projectDirs = [];
let outDir;

const readGeneratedPage = (...segments) =>
  readFile(join(outDir, ...segments, 'index.html'), 'utf8');

const activeLinksTo = (html, href) =>
  [...html.matchAll(new RegExp(`<a\\b[^>]*href="${href}"[^>]*>`, 'g'))]
    .map((match) => match[0])
    .filter((link) => link.includes('class="is-active"'));

const sidebarTags = (html) =>
  html.match(new RegExp('<nav\\b[^>]*class="sidebar-tags"[^>]*>.*?</nav>', 's'))?.[0] ?? '';

async function prepareProject() {
  const projectDir = await mkdtemp(join(tmpdir(), 'apex-build-'));
  projectDirs.push(projectDir);
  await cp('src', join(projectDir, 'src'), {
    recursive: true,
    filter: (source) => source !== join('src', 'content') && !source.includes('.test.'),
  });
  for (const file of ['astro.config.ts', 'package.json', 'tsconfig.json']) {
    await cp(file, join(projectDir, file));
  }
  await cp('tests/fixtures/content', join(projectDir, 'src/content'), { recursive: true });
  await symlink(join(process.cwd(), 'node_modules'), join(projectDir, 'node_modules'), 'dir');
  return projectDir;
}

const astroCli = join(process.cwd(), 'node_modules', 'astro', 'bin', 'astro.mjs');

beforeAll(async () => {
  const projectDir = await prepareProject();
  outDir = join(projectDir, 'dist');
  execFileSync(process.execPath, [astroCli, 'build', '--outDir', outDir], {
    cwd: projectDir,
    stdio: 'pipe',
  });
}, 30_000);

afterAll(async () => {
  await Promise.all(projectDirs.map((dir) => rm(dir, { recursive: true, force: true })));
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
    const html = await readGeneratedPage('posts', 'fixture-post');
    const links = activeLinksTo(html, '/posts');

    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toContain('class="is-active"');
      expect(link).not.toContain('aria-current="page"');
    }
  });

  it('renders only content-backed sidebar tags with canonical fragment links and tones on every page', async () => {
    const expectedTags = [
      { slug: 'fixture-tag', tone: 'purple' },
      { slug: 'development', tone: 'orange' },
      { slug: 'essay', tone: 'blue' },
    ];

    for (const segments of [[], ['posts'], ['tags'], ['posts', 'fixture-post']]) {
      const html = await readGeneratedPage(...segments);
      const sidebar = sidebarTags(html);

      expect(sidebar).not.toBe('');
      expect(sidebar).not.toContain('#astro');
      expect(sidebar).not.toContain('#cloudflare');
      expect(sidebar).not.toContain('#unused-tag');

      let previousIndex = -1;
      for (const tag of expectedTags) {
        const href = `href="/tags#tag-${tag.slug}"`;
        const index = sidebar.indexOf(href);
        expect(index).toBeGreaterThan(previousIndex);
        expect(sidebar).toContain(`#${tag.slug}`);
        const anchor = [...sidebar.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]).find((link) => link.includes(href));
        expect(anchor).toContain(`data-tone="${tag.tone}"`);
        previousIndex = index;
      }
    }
  });
});

describe('tag references during build', () => {
  it('rejects an undefined tag on an article older than the latest three', async () => {
    const projectDir = await prepareProject();
    await cp('tests/fixtures/invalid/old-post.md', join(projectDir, 'src/content/posts/old-post.md'));
    const result = spawnSync(process.execPath, [astroCli, 'build'], {
      cwd: projectDir,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('old-post');
    expect(result.stdout + result.stderr).toContain('undefined-tag');
  }, 30_000);
});
