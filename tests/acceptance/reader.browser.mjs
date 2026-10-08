import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { checkFixtureContent } from './content.browser.mjs';
import { checkHomeGeometry } from '../home-layout.browser.mjs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const base = process.argv[2];
const fixtures = process.argv[3] === '--fixtures';
const browser = await chromium.launch();
try {
  for (const width of fixtures ? [390] : [1440, 1100, 961, 960, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1200 } });
    await context.tracing.start({ screenshots: true, snapshots: true });
    const page = await context.newPage();
    let mainResponse;
    page.on('response', (response) => {
      if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) mainResponse = response;
    });
    const navigate = async (operation) => {
      await operation();
      await page.waitForLoadState('load');
      const status = mainResponse?.status();
      assert.equal(status, 200, `Main document HTTP ${status}`);
    };
    const navigation = page.getByRole('navigation', { name: 'Page navigation', exact: true });
    const main = page.getByRole('main');
    const readArticle = async (title, href) => {
      const heading = main.getByRole('heading', { level: 1 });
      assert.equal((await heading.innerText()).trim(), title, 'POST-01 post title');
      assert.ok(await main.getByRole('article', { name: title, exact: true }).isVisible(), 'POST-04 accessible article');
      assert.ok(await main.getByText(`cat ${decodeURIComponent(href.slice(1))}.md`, { exact: true }).isVisible(), 'POST-04 post command');
      assert.equal(await navigation.getByRole('link', { name: 'Posts', exact: true }).getAttribute('aria-current'), null,
        'POST-01 index is not current page');
    };
    try {
      await navigate(() => page.goto(base, { waitUntil: 'load' }));
      if (fixtures) {
        await checkFixtureContent(page, base);
        continue;
      }
      const postsNavigation = navigation.getByRole('link', { name: 'Posts', exact: true });
      await page.mouse.move(0, 0);
      const inactivePosts = await postsNavigation.screenshot({ animations: 'disabled' });
      for (const [name, href] of [['Home', '/'], ['Posts', '/posts'], ['Tags', '/tags'], ['Profile', '/profile']]) {
        assert.equal(await navigation.getByRole('link', { name, exact: true }).getAttribute('href'), href, 'NAV-01 shared navigation');
      }
      const toc = page.getByRole('navigation', { name: 'On this page', exact: true });
      for (const [name, hash] of [['About', '#about'], ['Latest Posts', '#posts'], ['Tags', '#tags'], ['Recent Commits', '#commits']]) {
        const target = page.getByRole('region', { name, exact: true });
        assert.equal(await target.count(), 1, 'NAV-03 unique named destination');
        const link = toc.getByRole('link', { name, exact: true });
        assert.equal(await link.getAttribute('href'), hash, 'NAV-03 Home anchor');
        // Observe the rendered focus indication without fixing its CSS implementation.
        await link.hover();
        await page.evaluate(() => document.activeElement?.blur());
        const box = await link.boundingBox();
        const clip = { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 };
        const unfocused = await page.screenshot({ clip, animations: 'disabled' });
        await link.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        assert.ok(await link.evaluate((element) => element === document.activeElement), 'NAV-03 Tab operation');
        assert.notDeepEqual(await page.screenshot({ clip, animations: 'disabled' }), unfocused, 'NAV-03 visible focus');
        await page.keyboard.press('Enter');
        assert.equal(new URL(page.url()).hash, hash, 'NAV-03 anchor destination');
        assert.ok(await target.evaluate((element) => element === document.activeElement), 'NAV-03 destination receives focus');
      }
      const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
      await skip.focus();
      await page.keyboard.press('Enter');
      assert.ok(await main.evaluate((element) => element === document.activeElement), 'NAV-03 skip to content');
      await checkHomeGeometry(page, width);
      const aboutProfile = page.getByRole('region', { name: 'About', exact: true }).getByRole('link', { name: 'More about me' });
      await navigate(() => aboutProfile.click());
      assert.equal(new URL(page.url()).pathname, '/profile', 'NAV-02 About to Profile destination');
      const profileTitle = (await main.getByRole('heading', { level: 1 }).innerText()).trim();
      await readArticle(profileTitle, '/profile');
      await navigate(() => navigation.getByRole('link', { name: 'Home', exact: true }).click());
      assert.equal(new URL(page.url()).pathname, '/', 'NAV-01 Home destination');
      await navigate(() => navigation.getByRole('link', { name: 'Profile', exact: true }).click());
      assert.equal(new URL(page.url()).pathname, '/profile', 'NAV-01 Profile destination');
      await readArticle(profileTitle, '/profile');
      await navigate(() => navigation.getByRole('link', { name: 'Posts', exact: true }).click());
      assert.equal(new URL(page.url()).pathname, '/posts', 'NAV-01 Posts destination');
      assert.equal(await navigation.getByRole('link', { name: 'Posts', exact: true }).getAttribute('aria-current'), 'page');
      const post = main.getByRole('listitem')
        .filter({ has: page.getByRole('list', { name: 'Tags', exact: true }) })
        .first().getByRole('heading', { level: 2 }).getByRole('link');
      const postHref = await post.getAttribute('href');
      const postTitle = (await post.innerText()).trim();
      assert.match(postHref, /^\/[^/]+$/, 'POST-01 root-level post route');
      await navigate(() => post.click());
      assert.equal(new URL(page.url()).pathname, postHref, 'POST-01 post destination');
      await readArticle(postTitle, postHref);
      await page.mouse.move(0, 0);
      assert.notDeepEqual(await postsNavigation.screenshot({ animations: 'disabled' }), inactivePosts,
        'POST-01 Posts has a visible selected state');
      const tag = main.getByRole('list', { name: 'Tags', exact: true }).getByRole('link').first();
      const tagHref = await tag.getAttribute('href');
      const tagName = (await tag.innerText()).trim();
      await navigate(() => tag.click());
      assert.equal(new URL(page.url()).pathname + new URL(page.url()).hash, tagHref, 'TAG-01 tag route');
      const group = main.getByRole('listitem').filter({ has: page.getByRole('heading', { name: tagName, exact: true }) });
      assert.equal(await group.count(), 1, 'TAG-01 tag destination');
      const listedPost = group.getByRole('list').getByRole('link').first();
      const listedTitle = (await listedPost.innerText()).trim();
      const listedHref = await listedPost.getAttribute('href');
      assert.match(listedHref, /^\/[^/]+$/, 'TAG-01 root-level post route');
      await navigate(() => listedPost.click());
      await readArticle(listedTitle, listedHref);
      assert.ok(await main.getByRole('list', { name: 'Tags', exact: true }).getByRole('link').count(), 'TAG-01 listed post tags');
      await navigate(() => navigation.getByRole('link', { name: 'Tags', exact: true }).click());
      assert.equal(new URL(page.url()).pathname, '/tags', 'NAV-01 Tags destination');
      assert.equal(await navigation.getByRole('link', { name: 'Tags', exact: true }).getAttribute('aria-current'), 'page');
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
  console.log(fixtures ? 'Fixture content acceptance passed'
    : 'Reader acceptance passed: NAV-01 NAV-02 NAV-03 NAV-04 POST-01 POST-03 POST-04 TAG-01');
} finally {
  await browser.close();
}
