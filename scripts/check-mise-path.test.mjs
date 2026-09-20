import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { execFileSync } from 'node:child_process';

test('mise tools remain first after another directory is prepended to PATH', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'apex-mise-path-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const tool of ['node', 'pnpm']) {
    writeFileSync(join(directory, tool), '#!/bin/sh\nexit 99\n', { mode: 0o755 });
  }
  const env = { ...process.env };
  delete env.MISE_ACTIVATE_AGGRESSIVE;
  for (const key of Object.keys(env)) {
    if (key.startsWith('__MISE_')) delete env[key];
  }
  const active = JSON.parse(execFileSync('mise', ['env', '--json'], { env, encoding: 'utf8' }));
  const overridden = { ...env, ...active, PATH: `${directory}${delimiter}${active.PATH}` };
  for (const tool of ['node', 'pnpm']) {
    const expected = execFileSync('mise', ['which', tool], { env, encoding: 'utf8' }).trim();
    const actual = execFileSync('mise', ['exec', '--', 'which', tool], { env: overridden, encoding: 'utf8' }).trim();
    assert.equal(actual, expected);
  }
});
