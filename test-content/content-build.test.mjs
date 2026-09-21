import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, cpSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const post = (slug, extra = {}) => ({ title: `Fixture ${slug}`, slug, description: 'Fixture description', publishedAt: '2026-09-20T18:00:00+09:00', tags: ['notes'], draft: false, ...extra });
const files = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);

test('実ビルドは公開原稿だけを配信し、空一覧と不正な原稿を検証する', () => {
  const directory = mkdtempSync(join(tmpdir(), 'apex-content-'));
  try {
    for (const name of ['src', 'public', 'astro.config.mjs', 'tsconfig.json', 'package.json']) cpSync(name, join(directory, name), { recursive: true });
    symlinkSync(resolve('node_modules'), join(directory, 'node_modules'), 'dir');
    const content = join(directory, 'src/content/posts');
    const build = (entries) => {
      rmSync(content, { recursive: true, force: true }); mkdirSync(content, { recursive: true });
      rmSync(join(directory, '.astro'), { recursive: true, force: true });
      for (const [index, data] of entries.entries()) writeFileSync(join(content, `file-${index}.md`), `---\n${JSON.stringify(data)}\n---\n\n${data.draft ? 'PRIVATE_DRAFT_BODY_8e64' : 'Public fixture body'}\n`);
      return spawnSync(process.execPath, [resolve('node_modules/astro/bin/astro.mjs'), 'build'], { cwd: directory, encoding: 'utf8', timeout: 60_000 });
    };
    let result = build([post('zulu'), post('alpha', { publishedAt: '2026-09-20T09:00:00Z' }), post('future', { publishedAt: '2099-01-01T00:00:00Z' }), post('hidden', { draft: true })]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const listing = readFileSync(join(directory, 'dist/posts/index.html'), 'utf8');
    assert.ok(listing.indexOf('/posts/future') < listing.indexOf('/posts/alpha'));
    assert.ok(listing.indexOf('/posts/alpha') < listing.indexOf('/posts/zulu'));
    assert.ok(!listing.includes('/posts/hidden'));
    assert.ok(!files(join(directory, 'dist')).some((file) => file.includes('/hidden/') || readFileSync(file).includes('PRIVATE_DRAFT_BODY_8e64')));
    assert.ok(!readFileSync(join(directory, 'dist/posts/alpha/index.html'), 'utf8').includes('更新:'));
    result = build([]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(readFileSync(join(directory, 'dist/posts/index.html'), 'utf8'), /公開記事はまだありません。/);
    for (const entries of [
      [post('same'), post('same', { draft: true })], [post('Bad-Slug')],
      [post('bad-time', { publishedAt: '2026-02-29T00:00:00Z' })],
      [post('unknown-tag', { tags: ['undefined-tag'], draft: true })],
      [post('missing', { title: undefined })],
    ]) {
      result = build(entries);
      assert.notEqual(result.status, 0, JSON.stringify(entries));
      assert.match(result.stdout + result.stderr, /Duplicate slug|InvalidContentEntryDataError|invalid|Invalid|title|tags/);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
