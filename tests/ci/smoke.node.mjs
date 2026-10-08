import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { smoke } from '../../scripts/ci/smoke.mjs';

async function serve(t, respond) {
  const server = createServer(respond);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('SMOKE-01 requests only / and accepts HTTP 200 without inspecting body content', async (t) => {
  const requested = [];
  const base = await serve(t, (request, response) => {
    requested.push(request.url);
    response.writeHead(200).end('any body');
  });
  await assert.doesNotReject(smoke(base));
  assert.deepEqual(requested, ['/']);
});

test('SMOKE-01 requires exactly HTTP 200 and returns a failure exit', async (t) => {
  const base = await serve(t, (_request, response) => response.writeHead(204).end());
  await assert.rejects(smoke(base), /HTTP 204 for \//);
  await assert.rejects(promisify(execFile)(process.execPath, ['scripts/ci/smoke.mjs', base]), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /HTTP 204 for \//);
    return true;
  });
});

test('SMOKE-01 rejects a root redirect without requesting its HTTP 200 destination', async (t) => {
  const requested = [];
  const base = await serve(t, (request, response) => {
    requested.push(request.url);
    if (request.url === '/') response.writeHead(302, { location: '/profile' }).end();
    else response.writeHead(200).end('redirect destination');
  });
  await assert.rejects(smoke(base), /HTTP 302 for \//);
  assert.deepEqual(requested, ['/']);
});

test('SMOKE-01 bounds a pending root request', async (t) => {
  const base = await serve(t, (_request, response) => {
    setTimeout(() => response.writeHead(200).end('any body'), 100);
  });
  await assert.rejects(smoke(base, { timeoutMs: 10 }), { name: 'TimeoutError' });
});
