// @ts-nocheck
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { promisify } from 'node:util';
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
  await symlink(join(process.cwd(), 'node_modules'), join(projectDir, 'node_modules'), 'dir');
  return projectDir;
}

const astroCli = join(process.cwd(), 'node_modules', 'astro', 'bin', 'astro.mjs');

afterAll(async () => {
  await Promise.all(projectDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

it('builds valid content that readers can navigate and read', async () => {
  const projectDir = await prepareProject();
  execFileSync(process.execPath, [astroCli, 'build'], {
    cwd: projectDir,
    stdio: 'pipe',
  });
  const server = await serveBuild(join(projectDir, 'dist'));
  try {
    await promisify(execFile)(process.execPath, ['tests/acceptance/reader.browser.mjs', server.url, '--fixtures'], {
      timeout: 120_000,
      env: { ...process.env, ACCEPTANCE_ARTIFACT_DIR: 'test-results/acceptance/fixtures' },
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
