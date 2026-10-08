import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAcceptance } from '../../scripts/ci/acceptance.mjs';

async function fixture(t) {
  const outputRoot = await mkdtemp(join(tmpdir(), 'apex-acceptance-'));
  t.after(() => rm(outputRoot, { recursive: true, force: true }));
  const calls = [];
  let closed = false;
  return {
    outputRoot, calls, closed: () => closed,
    serve: async () => ({ url: 'http://127.0.0.1:1234', close: async () => { closed = true; } }),
    execute: async (command, args, options) => {
      calls.push([command, args]);
      assert.equal(options.timeout, 120_000);
      assert.ok(options.env.ACCEPTANCE_ARTIFACT_DIR.startsWith(outputRoot));
      return { stdout: 'command passed', stderr: '' };
    },
  };
}

test('ACCEPT-01 runs integration, harness, local and matched Preview once with retained logs', async (t) => {
  const value = await fixture(t);
  const preview = 'https://ci-fixture-apex.daiksud-a1f.workers.dev/';
  await runAcceptance(preview, value);
  assert.equal(value.calls.length, 4);
  assert.deepEqual(value.calls[0], ['pnpm', ['test:integration']]);
  assert.equal(value.calls.at(-1)[1].at(-1), preview);
  assert.match(await readFile(join(value.outputRoot, 'command-4.log'), 'utf8'), /command passed/);
  assert.equal(value.closed(), true);
});

test('ACCEPT-02 fails once even for HTTP 503, preserves the child error and closes the server', async (t) => {
  const value = await fixture(t);
  const failure = Object.assign(new Error('HTTP 503'), { code: 1, stdout: '', stderr: 'Main document HTTP 503\n' });
  value.execute = async (_command, args) => {
    value.calls.push(args);
    if (value.calls.length === 4) throw failure;
    return { stdout: 'passed', stderr: '' };
  };
  await assert.rejects(runAcceptance('https://preview.example/', value), (error) => error === failure);
  assert.equal(value.calls.length, 4);
  assert.match(await readFile(join(value.outputRoot, 'command-4.log'), 'utf8'), /HTTP 503/);
  assert.equal(value.closed(), true);
});

test('ACCEPT-01 main validation runs local acceptance without a Preview command', async (t) => {
  const value = await fixture(t);
  await runAcceptance(undefined, value);
  assert.equal(value.calls.length, 3);
  assert.equal(value.calls.at(-1)[1].at(-1), 'http://127.0.0.1:1234');
  assert.equal(value.closed(), true);
});
