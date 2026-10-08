import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { checkRoute, smoke } from '../../scripts/ci/smoke.mjs';
const execute = promisify(execFile);

async function serve(t, body, status = 200) {
  const server = createServer((_request, response) => {
    response.writeHead(status, { 'content-type': 'text/html' });
    response.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('SMOKE-01 rejects a 200 home fallback on /posts despite shared Posts navigation', async (t) => {
  const base = await serve(t, '<nav>Posts</nav><main id="main-content"><h1>Build. Try. Write.</h1></main>');
  await assert.rejects(
    checkRoute(base, '/posts'),
    /Unexpected content for \/posts/,
  );
});

test('SMOKE-02 accepts the Posts heading with its existing nested chevron span', async (t) => {
  const base = await serve(t, '<main id="main-content"><h1 id="posts-index-pane-heading"><span aria-hidden="true">❯</span>Posts</h1></main>');
  await assert.doesNotReject(checkRoute(base, '/posts'));
});

for (const [route, content] of [
  ['/', '<div id="welcome-heading">Welcome</div><nav aria-label="On this page"></nav>'],
  ['/tags', '<h1 id="tags-index-pane-heading"><span>❯</span>Tags</h1>'],
  ['/profile', '<article aria-labelledby="post-title"><p>cat profile.md</p><h1 id="post-title">About</h1></article>'],
]) {
  test(`SMOKE-02 accepts semantic content for ${route}`, async (t) => {
    const base = await serve(t, `<main id="main-content">${content}</main>`);
    await assert.doesNotReject(checkRoute(base, route));
  });
}

test('SMOKE-02 requests the fixed four routes and fails when one returns an error', async (t) => {
  const requested = [];
  const pages = {
    '/': '<div id="welcome-heading">Welcome</div><nav aria-label="On this page"></nav>',
    '/posts': '<h1 id="posts-index-pane-heading">Posts</h1>',
    '/tags': '<h1 id="tags-index-pane-heading">Tags</h1>',
    '/profile': '<article aria-labelledby="post-title"><p>cat profile.md</p><h1 id="post-title">About</h1></article>',
  };
  let failTags = false;
  const server = createServer((request, response) => {
    requested.push(request.url);
    response.writeHead(failTags && request.url === '/tags' ? 503 : 200);
    response.end(`<main id="main-content">${pages[request.url]}</main>`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  await assert.doesNotReject(smoke(base));
  assert.deepEqual(requested.sort(), ['/', '/posts', '/profile', '/tags']);
  failTags = true;
  await assert.rejects(smoke(base), /HTTP 503 for \/tags/);
});

test('smoke CLI exits unsuccessfully when a deployed route returns 503', async (t) => {
  const base = await serve(t, 'temporary provider error', 503);
  await assert.rejects(execute(process.execPath, ['scripts/ci/smoke.mjs', base]), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /HTTP 503/);
    return true;
  });
});
