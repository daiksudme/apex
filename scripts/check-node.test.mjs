import assert from 'node:assert/strict';
import test from 'node:test';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('rejects a Node.js version that differs from the project declaration', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'apex-node-check-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, 'scripts'));
  const script = join(directory, 'scripts/check-node.mjs');
  copyFileSync(new URL('./check-node.mjs', import.meta.url), script);
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ engines: { node: '0.0.0' } }));
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Expected Node\.js 0\.0\.0/);
});
