// @ts-nocheck
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { parseFeed } from './acceptance/rss.browser.mjs';
import { serveBuild } from './acceptance/server.mjs';

const projectDirs = [];
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
  await cp('tests/fixtures/public', join(projectDir, 'public'), { recursive: true });
  await cp('public/og-image.png', join(projectDir, 'public/og-image.png'));
  await symlink(join(process.cwd(), 'node_modules'), join(projectDir, 'node_modules'), 'dir');
  return projectDir;
}

const astroCli = join(process.cwd(), 'node_modules', 'astro', 'bin', 'astro.mjs');

it('RSS-03 preserves Japanese and XML-sensitive title and summary text', async () => {
  const projectDir = await prepareProject();
  const postPath = join(projectDir, 'src/content/posts/fixture-post.md');
  await writeFile(postPath, (await readFile(postPath, 'utf8'))
    .replace(/^title:.*$/m, `title: ${JSON.stringify('日本語 & <記事> "引用" \'例\'')}`)
    .replace(/^description:.*$/m, `description: ${JSON.stringify('要約 & <説明> "引用" \'例\'')}`));
  execFileSync(process.execPath, [astroCli, 'build'], { cwd: projectDir, stdio: 'pipe' });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const item = (await parseFeed(page, await readFile(join(projectDir, 'dist/rss.xml'), 'utf8'))).items[0];
    expect(item.title).toBe('日本語 & <記事> "引用" \'例\'');
    expect(item.description).toBe('要約 & <説明> "引用" \'例\'');
  } finally {
    await browser.close();
  }
}, 30_000);

it('RSS-02 preserves identity and publication date after a summary edit', async () => {
  const projectDir = await prepareProject();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const buildFeed = async () => {
      execFileSync(process.execPath, [astroCli, 'build'], { cwd: projectDir, stdio: 'pipe' });
      return parseFeed(page, await readFile(join(projectDir, 'dist/rss.xml'), 'utf8'));
    };
    const before = (await buildFeed()).items[0];
    const postPath = join(projectDir, 'src/content/posts/fixture-post.md');
    await writeFile(postPath, (await readFile(postPath, 'utf8'))
      .replace('description: 生成HTMLを検証するための記事。', 'description: An edited fixture summary.\nupdatedAt: 2026-01-06'));
    const after = (await buildFeed()).items[0];
    expect(after.description).toBe('An edited fixture summary.');
    expect(after.guid).toBe(before.guid);
    expect(after.date).toBe(before.date);
    expect(after.guid).toBe('https://daiksud.me/fixture-post');
    expect(after.date).toBe('2026-01-04T00:00:00.000Z');
  } finally {
    await browser.close();
  }
}, 30_000);

afterAll(async () => {
  await Promise.all(projectDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

it.each(['populated', 'empty'])('builds %s content that readers can navigate and read', async (content) => {
  const projectDir = await prepareProject();
  if (content === 'empty') await rm(join(projectDir, 'src/content/posts'), { recursive: true });
  execFileSync(process.execPath, [astroCli, 'build'], {
    cwd: projectDir,
    stdio: 'pipe',
  });
  const server = await serveBuild(join(projectDir, 'dist'));
  try {
    await promisify(execFile)(process.execPath, ['tests/acceptance/reader.browser.mjs', server.url, content === 'empty' ? '--empty' : '--fixtures'], {
      timeout: 120_000,
      env: { ...process.env, ACCEPTANCE_ARTIFACT_DIR: `test-results/acceptance/fixtures-${content}` },
    });
  } finally {
    await server.close();
  }
}, 120_000);

describe('tag references during build', () => {
  it('rejects duplicate catalog slugs before rendering conflicting tag groups', async () => {
    const projectDir = await prepareProject();
    await cp('tests/fixtures/invalid/duplicate-tags.yaml', join(projectDir, 'src/content/tags.yaml'));
    const result = spawnSync(process.execPath, [astroCli, 'build'], {
      cwd: projectDir,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('Duplicate tag slug "fixture-tag"');
  }, 30_000);

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


describe('root article route collisions', () => {
  it.each(['posts', 'tags'])('rejects an article that would occupy /%s', async (slug) => {
    const projectDir = await prepareProject();
    await cp('tests/fixtures/content/posts/fixture-post.md', join(projectDir, `src/content/posts/${slug}.md`));
    const result = spawnSync(process.execPath, [astroCli, 'build'], {
      cwd: projectDir,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain(`Post slug "${slug}" conflicts with an existing page`);
  }, 30_000);
});

it('OG-01 describes each static page with production Open Graph metadata', async () => {
  const projectDir = await prepareProject();
  const postPath = join(projectDir, 'src/content/posts/fixture-post.md');
  const title = '日本語 & <記事> "引用"';
  const description = '要約 & <説明> "引用"';
  await writeFile(postPath, (await readFile(postPath, 'utf8'))
    .replace(/^title:.*$/m, `title: ${JSON.stringify(title)}`)
    .replace(/^description:.*$/m, `description: ${JSON.stringify(description)}`));
  execFileSync(process.execPath, [astroCli, 'build'], { cwd: projectDir, stdio: 'pipe' });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const [path, expectedTitle, expectedDescription, type] of [
      ['/', 'daiksud.me', 'A blog about experiments with technology, personal projects, and what I learn and think along the way.', 'website'],
      ['/posts', 'Posts | daiksud.me', 'Posts about things I build, learn, and think about.', 'website'],
      ['/tags', 'Tags | daiksud.me', 'Browse posts by tag, with the latest posts for each tag.', 'website'],
      ['/profile', 'フィクスチャーのプロフィール | daiksud.me', '共通記事表示を確認するプロフィール。', 'article'],
      ['/fixture-post', `${title} | daiksud.me`, description, 'article'],
    ]) {
      const html = await readFile(join(projectDir, 'dist', path, 'index.html'), 'utf8');
      const parsed = await page.evaluate((html) => {
        const document = new DOMParser().parseFromString(html, 'text/html');
        return {
          title: document.title,
          description: document.querySelector('meta[name="description"]').content,
          metadata: [...document.head.querySelectorAll('meta[property^="og:"]')]
            .map((meta) => [meta.getAttribute('property'), meta.content]),
        };
      }, html);
      const expected = [
        ['og:title', expectedTitle], ['og:description', expectedDescription],
        ['og:type', type], ['og:url', `https://daiksud.me${path}`], ['og:site_name', 'daiksud.me'],
      ];
      const metadata = parsed.metadata.filter(([name]) => expected.some(([property]) => property === name));
      expect(metadata.sort()).toEqual(expected.sort());
      expect(parsed.title).toBe(expectedTitle);
      expect(parsed.description).toBe(expectedDescription);
    }
  } finally {
    await browser.close();
  }
}, 30_000);

it('OG-02 shares one decodable branded image across pages', async () => {
  const projectDir = await prepareProject();
  execFileSync(process.execPath, [astroCli, 'build'], { cwd: projectDir, stdio: 'pipe' });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const path of ['/', '/posts', '/tags', '/profile', '/fixture-post']) {
      const html = await readFile(join(projectDir, 'dist', path, 'index.html'), 'utf8');
      const images = await page.evaluate((html) => [...new DOMParser()
        .parseFromString(html, 'text/html').head.querySelectorAll('meta[property^="og:image"]')]
        .map((meta) => [meta.getAttribute('property'), meta.content]), html);
      expect(images).toEqual([
        ['og:image', 'https://daiksud.me/og-image.png'],
        ['og:image:alt', 'daiksud.me with a blue terminal cursor and the words Build. Learn. Write. Repeat. on a dark background.'],
      ]);
    }
    const image = await readFile(join(projectDir, 'dist/og-image.png'));
    expect(image.equals(await readFile('public/og-image.png'))).toBe(true);
    const dimensions = await page.evaluate(async (bytes) => {
      const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
      return [image.width, image.height];
    }, [...image]);
    expect(dimensions).toEqual([1200, 630]);
  } finally {
    await browser.close();
  }
}, 30_000);

it('TOC-01 shows an ordered article outline before the body', async () => {
  const projectDir = await prepareProject();
  await cp('tests/fixtures/toc/basic.md', join(projectDir, 'src/content/posts/toc.md'));
  execFileSync(process.execPath, [astroCli, 'build'], { cwd: projectDir, stdio: 'pipe' });
  const server = await serveBuild(join(projectDir, 'dist'));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${server.url}/toc`);
    const toc = page.getByRole('navigation', { name: 'Table of contents', exact: true });
    expect(await toc.locator('a').allTextContents()).toEqual(['First section', 'Details']);
    expect(await toc.locator('li').count()).toBe(2);
    const outline = await toc.evaluate((nav) => {
      const links = [...nav.querySelectorAll('a')];
      return {
        beforeBody: Boolean(nav.compareDocumentPosition(document.querySelector('.post-content')) & Node.DOCUMENT_POSITION_FOLLOWING),
        afterHeader: Boolean(document.querySelector('.post-header').compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING),
        targets: links.map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1)))?.textContent),
        indented: links[1].getBoundingClientRect().left > links[0].getBoundingClientRect().left,
      };
    });
    expect(outline).toEqual({ beforeBody: true, afterHeader: true, targets: ['First section', 'Details'], indented: true });
  } finally {
    await browser.close();
    await server.close();
  }
}, 30_000);

it('TOC-02a omits outlines for zero or one heading', async () => {
  const projectDir = await prepareProject();
  execFileSync(process.execPath, [astroCli, 'build'], { cwd: projectDir, stdio: 'pipe' });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const slug of ['second-post', 'profile']) {
      await page.setContent(await readFile(join(projectDir, 'dist', slug, 'index.html'), 'utf8'));
      expect(await page.getByRole('navigation', { name: 'Table of contents', exact: true }).count()).toBe(0);
      expect(await page.locator('.table-of-contents').count()).toBe(0);
    }
  } finally {
    await browser.close();
  }
}, 30_000);

it('TOC-02b includes only h2 and h3, including on Profile', async () => {
  const projectDir = await prepareProject();
  for (const slug of ['toc', 'profile']) {
    await cp('tests/fixtures/toc/mixed.md', join(projectDir, `src/content/posts/${slug}.md`));
  }
  await cp('tests/fixtures/toc/excluded.md', join(projectDir, 'src/content/posts/excluded.md'));
  execFileSync(process.execPath, [astroCli, 'build'], { cwd: projectDir, stdio: 'pipe' });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const slug of ['toc', 'profile', 'excluded']) {
      await page.setContent(await readFile(join(projectDir, 'dist', slug, 'index.html'), 'utf8'));
      const toc = page.getByRole('navigation', { name: 'Table of contents', exact: true });
      expect(await toc.locator('a').allTextContents()).toEqual(slug === 'excluded' ? [] : ['First section', 'Details']);
      expect(await page.locator('.table-of-contents').count()).toBe(slug === 'excluded' ? 0 : 1);
    }
  } finally {
    await browser.close();
  }
}, 30_000);

it('TOC-03 preserves readable text and renderer destinations', async () => {
  const projectDir = await prepareProject();
  await cp('tests/fixtures/toc/labels.md', join(projectDir, 'src/content/posts/toc.md'));
  execFileSync(process.execPath, [astroCli, 'build'], { cwd: projectDir, stdio: 'pipe' });
  const server = await serveBuild(join(projectDir, 'dist'));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 600 } });
    await page.goto(`${server.url}/toc`);
    const toc = page.getByRole('navigation', { name: 'Table of contents', exact: true });
    const labels = await toc.locator('a').allTextContents();
    expect(labels).toEqual(['日本語の見出し', '日本語の見出し', 'With emphasis and code', '<span> & “quoted”']);
    expect(await toc.locator('a > *').count()).toBe(0);
    const destinations = await toc.locator('a').evaluateAll((links) => links.map((link) => decodeURIComponent(link.hash.slice(1))));
    expect(new Set(destinations).size).toBe(4);
    expect(destinations).toEqual(await page.locator('.post-content h2, .post-content h3').evaluateAll((headings) => headings.map((heading) => heading.id)));
    expect(labels).toEqual(await page.locator('.post-content h2, .post-content h3').allTextContents());
    const repeated = toc.locator('a').nth(1);
    await repeated.click();
    expect(await page.locator(':target').getAttribute('id')).toBe(destinations[1]);
    expect(await page.locator(':target').textContent()).toBe('日本語の見出し');
    expect(await page.locator(':target').evaluate((heading) => {
      const rect = heading.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < innerHeight;
    })).toBe(true);
    await page.goto(`${server.url}/toc`);
    for (let step = 0; step < 40 && !await toc.locator('a').first().evaluate((link) => link === document.activeElement); step++) {
      await page.keyboard.press('Tab');
    }
    expect(await toc.locator('a').first().evaluate((link) => {
      const style = getComputedStyle(link);
      return link === document.activeElement && link.matches(':focus-visible') && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
    })).toBe(true);
    await page.keyboard.press('Enter');
    expect(await page.locator(':target').getAttribute('id')).toBe(destinations[0]);
  } finally {
    await browser.close();
    await server.close();
  }
}, 30_000);

it('TOC-04 fits long labels within mobile and desktop articles', async () => {
  const projectDir = await prepareProject();
  await cp('tests/fixtures/toc/long.md', join(projectDir, 'src/content/posts/toc.md'));
  execFileSync(process.execPath, [astroCli, 'build'], { cwd: projectDir, stdio: 'pipe' });
  const server = await serveBuild(join(projectDir, 'dist'));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ javaScriptEnabled: false });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${server.url}/toc`);
      const geometry = await page.getByRole('navigation', { name: 'Table of contents', exact: true }).evaluate((nav) => {
        const article = nav.closest('article').getBoundingClientRect();
        const box = nav.getBoundingClientRect();
        return {
          documentFits: document.documentElement.scrollWidth <= innerWidth,
          tocFits: box.left >= article.left && box.right <= article.right && nav.scrollWidth <= nav.clientWidth,
          linksFit: [...nav.querySelectorAll('a')].every((link) => [...link.getClientRects()].every((rect) => rect.left >= box.left && rect.right <= box.right + 1)),
        };
      });
      expect(geometry).toEqual({ documentFits: true, tocFits: true, linksFit: true });
    }
  } finally {
    await browser.close();
    await server.close();
  }
}, 30_000);
