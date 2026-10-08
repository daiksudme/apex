import assert from 'node:assert/strict';
import { test } from 'node:test';
import { retryAcceptance, childFailure, runAcceptance } from '../../scripts/ci/acceptance.mjs';

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temporary = () => Object.assign(new Error('connection reset'), { name: 'TransportError', code: 'ECONNRESET' });

test('RETRY-01 succeeds on the fourth complete stage attempt with retained classifications', async () => {
  let attempts = 0;
  const records = [];
  const result = await retryAcceptance(async () => {
    attempts++;
    if (attempts < 4) throw temporary();
  }, (record) => records.push(record), async () => {});
  assert.equal(attempts, 4);
  assert.deepEqual(result, { attempts: 4 });
  assert.equal(records.filter((record) => record.kind === 'transient').length, 3);
  assert.equal(records.at(-1).kind, 'success');
  assert.deepEqual(records.map((record) => record.attempt), [1, 2, 3, 4]);
  assert.equal(records.at(-1).terminal, true);
});

test('RETRY-03 exhausts after the initial attempt and exactly three retries', async () => {
  let attempts = 0;
  const failure = temporary();
  const records = [];
  await assert.rejects(retryAcceptance(async () => { attempts++; throw failure; }, (record) => records.push(record), async () => {}), (error) => error === failure);
  assert.equal(attempts, 4);
  assert.equal(records.length, 4);
  assert.equal(records.at(-1).terminal, true);
});

for (const failure of [
  Object.assign(new Error('assertion failed'), { name: 'AssertionError', code: 'ECONNRESET' }),
  new TypeError('missing configuration'),
  Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
  Object.assign(new Error('unauthorized'), { name: 'TransportError', code: 'HTTP_401' }),
  new Error('browser executable missing'),
]) {
  test(`RETRY-02 does not retry ${failure.name}: ${failure.message}`, async () => {
    let attempts = 0;
    await assert.rejects(retryAcceptance(async () => { attempts++; throw failure; }, () => {}, async () => {}), (error) => error === failure);
    assert.equal(attempts, 1);
  });
}

test('RETRY-01 first-attempt success does not pause or retry', async () => {
  const records = [];
  assert.deepEqual(await retryAcceptance(async () => {}, (record) => records.push(record), async () => assert.fail('success must not pause')), { attempts: 1 });
  assert.deepEqual(records, [{ attempt: 1, kind: 'success', terminal: true }]);
});

test('decodes only one valid classified child failure', () => {
  const failure = Object.assign(new Error('child failed'), { code: 1, stderr: 'ACCEPTANCE_FAILURE {"kind":"transient","name":"TransportError","code":"HTTP_503"}\n' });
  const decoded = childFailure(failure);
  assert.equal(decoded.name, 'TransportError');
  assert.equal(decoded.code, 'HTTP_503');
  for (const stderr of ['', 'ACCEPTANCE_FAILURE invalid', failure.stderr + failure.stderr, 'ACCEPTANCE_FAILURE {"kind":"transient","name":"AssertionError","code":"HTTP_503"}', 'ACCEPTANCE_FAILURE {"kind":"transient","name":"TransportError","code":"HTTP_401"}']) {
    const error = Object.assign(new Error('invalid child result'), { stderr });
    assert.equal(childFailure(error), error);
  }
  const killed = Object.assign(new Error('command timed out'), { killed: true, signal: 'SIGTERM', stderr: failure.stderr });
  assert.equal(childFailure(killed), killed);
});

test('retries the complete local and matched Preview attempt with separate retained logs', async (t) => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'apex-acceptance-'));
  t.after(() => rm(outputRoot, { recursive: true, force: true }));
  const calls = [];
  let closed = false;
  let previewAttempts = 0;
  const preview = 'https://ci-fixture-apex.daiksud-a1f.workers.dev/';
  const result = await runAcceptance(preview, {
    outputRoot, pause: async () => {}, report: () => {},
    serve: async () => ({ url: 'http://127.0.0.1:1234', close: async () => { closed = true; } }),
    execute: async (command, args, options) => {
      calls.push([command, args]);
      assert.ok(options.timeout > 0);
      if (args.at(-1) === preview && ++previewAttempts === 1) {
        throw Object.assign(new Error('temporary upstream failure'), { code: 1, stdout: '', stderr: 'ACCEPTANCE_FAILURE {"kind":"transient","name":"TransportError","code":"HTTP_503"}\n' });
      }
      return { stdout: 'command passed', stderr: '' };
    },
  });
  assert.deepEqual(result, { attempts: 2 });
  assert.equal(closed, true);
  assert.equal(calls.length, 8);
  assert.equal(calls[0][0], 'pnpm');
  assert.deepEqual(calls[0][1], ['test:integration']);
  assert.deepEqual(calls.slice(0, 4), calls.slice(4));
  assert.match(await readFile(join(outputRoot, 'attempt-1', 'command-4.log'), 'utf8'), /HTTP_503/);
  assert.match(await readFile(join(outputRoot, 'attempt-2', 'command-4.log'), 'utf8'), /command passed/);
});
