import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { checkHomeGeometry } from '../home-layout.browser.mjs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { failureKind } from '../../scripts/ci/acceptance.mjs';

const base = process.argv[2];
const browser = await chromium.launch();
try {
  for (const width of [1440, 1100, 961, 960, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1200 } });
    await context.tracing.start({ screenshots: true, snapshots: true });
    const page = await context.newPage();
    let mainResponse;
    page.on('response', (response) => {
      if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) mainResponse = response;
    });
    const navigate = async (operation) => {
      try {
        await operation();
        await page.waitForLoadState('load');
      } catch (error) {
        const transport = error.name === 'Error'
          && /^(?:page\.goto|locator\.click): net::ERR_CONNECTION_(RESET|CLOSED)\b/.exec(error.message);
        if (transport) {
          error.name = 'TransportError';
          error.code = `NET_CONNECTION_${transport[1]}`;
        }
        throw error;
      }
      const status = mainResponse?.status();
      if (status !== 200) {
        throw Object.assign(new Error(`Main document HTTP ${status}`), {
          name: [502, 503, 504].includes(status) ? 'TransportError' : 'HttpError', code: `HTTP_${status}`,
        });
      }
    };
    try {
      await navigate(() => page.goto(base, { waitUntil: 'load' }));
      const navigation = page.getByRole('navigation', { name: 'Page navigation', exact: true });
      assert.deepEqual(await navigation.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
        ['/', '/posts', '/tags', '/profile'], 'NAV-01 shared navigation');
      const toc = page.getByRole('navigation', { name: 'On this page', exact: true });
      const anchors = ['#about', '#posts', '#tags', '#commits'];
      assert.deepEqual(await toc.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href'))), anchors, 'NAV-03 Home anchors');
      for (const anchor of anchors) {
        assert.equal(await page.locator(anchor).count(), 1, 'NAV-03 unique destination');
        const link = toc.locator(`a[href="${anchor}"]`);
        await link.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        assert.ok(await link.evaluate((element) => element === document.activeElement), 'NAV-03 Tab operation');
        assert.notEqual(await link.evaluate((element) => getComputedStyle(element).outlineStyle), 'none', 'NAV-03 visible focus');
        await page.keyboard.press('Enter');
        assert.equal(new URL(page.url()).hash, anchor, 'NAV-03 anchor destination');
        assert.ok(await page.locator(anchor).evaluate((element) => element === document.activeElement), 'NAV-03 destination receives focus');
      }
      const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
      await skip.focus();
      await page.keyboard.press('Enter');
      assert.ok(await page.locator('#main-content').evaluate((element) => element === document.activeElement), 'NAV-03 skip to content');
      await checkHomeGeometry(page, width);
      const aboutProfile = page.locator('#about a.text-link');
      assert.equal(await aboutProfile.getAttribute('href'), '/profile', 'NAV-02 About to Profile');
      await navigate(() => aboutProfile.click());
      assert.equal(new URL(page.url()).pathname, '/profile', 'NAV-02 About to Profile destination');
      assert.equal(await page.locator('main article[aria-labelledby="post-title"]').count(), 1, 'NAV-02 Profile article');
      await navigate(() => page.goto(base, { waitUntil: 'load' }));
      await navigate(() => navigation.getByRole('link', { name: 'Profile', exact: true }).click());
      assert.equal(new URL(page.url()).pathname, '/profile', 'NAV-01 Profile destination');
      assert.equal(await page.locator('main article[aria-labelledby="post-title"]').count(), 1, 'POST-03 Profile article');
      assert.ok((await page.locator('#post-title').textContent()).trim(), 'POST-04 Profile title');
      assert.equal(await page.locator('.post-command .command').textContent(), 'cat profile.md', 'POST-04 Profile command');
      await navigate(() => navigation.getByRole('link', { name: 'Posts', exact: true }).click());
      const post = page.locator('.post-list-item:has(.post-tag) .post-summary-title a').first();
      const postHref = await post.getAttribute('href');
      const postTitle = (await post.textContent()).trim();
      assert.match(postHref, /^\/[^/]+$/, 'POST-01 root-level post route');
      await navigate(() => post.click());
      assert.equal((await page.locator('#post-title').textContent()).trim(), postTitle, 'POST-01 post title');
      assert.equal(await page.locator('.post-command .command').textContent(), `cat ${decodeURIComponent(postHref.slice(1))}.md`, 'POST-04 post command');
      assert.equal(await navigation.locator('a[href="/posts"].is-active').count(), 1, 'POST-01 Posts selected');
      assert.equal(await navigation.locator('a[href="/posts"][aria-current="page"]').count(), 0, 'POST-01 index is not current page');
      const tag = page.locator('main .post-tag').first();
      const tagHref = await tag.getAttribute('href');
      await navigate(() => tag.click());
      assert.equal(new URL(page.url()).pathname + new URL(page.url()).hash, tagHref, 'TAG-01 tag route');
      const group = page.locator(new URL(page.url()).hash);
      assert.equal(await group.count(), 1, 'TAG-01 tag destination');
      const listedPost = group.locator('.tag-post-list a').first();
      const listedTitle = (await listedPost.textContent()).trim();
      assert.match(await listedPost.getAttribute('href'), /^\/[^/]+$/, 'TAG-01 root-level post route');
      await navigate(() => listedPost.click());
      assert.equal((await page.locator('#post-title').textContent()).trim(), listedTitle, 'TAG-01 listed post title');
      assert.ok(await page.locator('main .post-tag').count(), 'TAG-01 listed post tags');
    } catch (error) {
      try {
        const output = process.env.ACCEPTANCE_ARTIFACT_DIR ?? 'test-results/browser';
        await mkdir(output, { recursive: true });
        await page.screenshot({ path: join(output, `reader-${width}.png`), fullPage: true, timeout: 5_000 });
        await context.tracing.stop({ path: join(output, `reader-${width}.zip`) });
      } catch (captureError) {
        console.error(`Could not retain browser diagnostics: ${captureError.message}`);
      }
      throw error;
    } finally {
      await context.close();
    }
  }
  console.log('Reader acceptance passed: NAV-01 NAV-02 NAV-03 NAV-04 POST-01 POST-03 POST-04 TAG-01');
} catch (error) {
  console.error(`ACCEPTANCE_FAILURE ${JSON.stringify({ kind: failureKind(error), name: error.name, code: error.code ?? error.name })}`);
  throw error;
} finally {
  await browser.close();
}
