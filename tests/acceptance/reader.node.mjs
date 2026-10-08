import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { serveBuild } from './server.mjs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('NAV-01 reader CLI rejects incomplete shared navigation', async (t) => {
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end('<main id="main-content"><nav aria-label="Page navigation"><a href="/">Home</a></nav></main>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const output = await mkdtemp(join(tmpdir(), 'apex-reader-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  await assert.rejects(promisify(execFile)(process.execPath, ['tests/acceptance/reader.browser.mjs', base], { env: { ...process.env, ACCEPTANCE_ARTIFACT_DIR: output } }), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /NAV-01 shared navigation/);
    return true;
  });
  assert.equal((await readFile(join(output, 'reader-1440.png'))).subarray(0, 4).toString('hex'), '89504e47');
  assert.equal((await readFile(join(output, 'reader-1440.zip'))).subarray(0, 2).toString(), 'PK');
});

test('NAV-03 reader CLI rejects wrong Home anchor targets', async (t) => {
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end(`
    <nav aria-label="Page navigation">${['/', '/posts', '/tags', '/profile'].map((href) => `<a href="${href}">${href === '/profile' ? 'Profile' : href}</a>`).join('')}</nav>
    <main id="main-content"><nav aria-label="On this page"><a href="#missing">About</a></nav><article aria-labelledby="post-title"><h1 id="post-title">Profile</h1><p class="post-command"><span class="command">cat profile.md</span></p></article></main>
  `);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await assert.rejects(promisify(execFile)(process.execPath, ['tests/acceptance/reader.browser.mjs', `http://127.0.0.1:${server.address().port}`]), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /NAV-03 Home anchors/);
    return true;
  });
});

test('NAV-02 reader CLI rejects a broken About to Profile link', async (t) => {
  const server = await serveBuild((body) => body.replace(/(<a class="text-link" href=")\/profile"/, '$1/wrong-profile"'));
  t.after(server.close);
  await assert.rejects(promisify(execFile)(process.execPath, ['tests/acceptance/reader.browser.mjs', server.url]), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /NAV-02 About to Profile/);
    return true;
  });
});

test('TAG-01 reader CLI rejects a post tag link to an absent tag group', async (t) => {
  const server = await serveBuild((body) => body.replace(/(<a class="post-tag" href=")\/tags#tag-[^"]+"/g, '$1/tags#tag-missing"'));
  t.after(server.close);
  await assert.rejects(promisify(execFile)(process.execPath, ['tests/acceptance/reader.browser.mjs', server.url]), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /TAG-01 tag destination/);
    return true;
  });
});

for (const status of [502, 503, 504, 401, 403]) {
  test(`reader CLI rejects main-document HTTP ${status}`, async (t) => {
    const server = createServer((_request, response) => {
      response.setHeader('Content-Type', 'text/html');
      response.writeHead(status).end('upstream response');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    await assert.rejects(promisify(execFile)(process.execPath, ['tests/acceptance/reader.browser.mjs', `http://127.0.0.1:${server.address().port}`]), (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, new RegExp(`Main document HTTP ${status}`));
      return true;
    });
  });
}

for (const [name, transform, statusFor, expectedMessage] of [
  ['clicked Profile 503', (body) => body, (path) => path === '/profile' ? 503 : 200, /Main document HTTP 503/],
  ['asset 503 with navigation assertion', (body) => body.replace(/<a href="\/posts" lang="en"[^>]*>/, '<a lang="en">'), (path) => path.startsWith('/_astro/') ? 503 : 200, /NAV-01 shared navigation/],
]) {
  test(`reader CLI rejects ${name}`, async (t) => {
    const server = await serveBuild(transform, statusFor);
    t.after(server.close);
    await assert.rejects(promisify(execFile)(process.execPath, ['tests/acceptance/reader.browser.mjs', server.url]), (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, expectedMessage);
      return true;
    });
  });
}
