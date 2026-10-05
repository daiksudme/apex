// Optional geometry check after pnpm build. Requires Playwright and Chrome/Chromium.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/home-layout.browser.mjs [URL]
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const pairs = (process.env.PAIRS ?? 'welcome/about,posts/tags').split(',').map(pair => pair.split('/'));
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = resolve('dist', '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!file.startsWith(resolve('dist') + '/')) throw new Error('Outside dist');
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const url = process.argv[2] ?? `http://127.0.0.1:${server.address().port}/`;
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  for (const width of [1440, 1100, 961, 960, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1200 } });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const evidence = await page.evaluate(({ width, pairs }) => {
      const names = ['welcome', 'about', 'posts', 'tags', 'commits'];
      const boxes = Object.fromEntries(names.map(name => {
        const r = document.querySelector('.' + name + '-pane').getBoundingClientRect();
        return [name, { top: r.top, bottom: r.bottom, height: r.height }];
      }));
      const failures = [];
      if (width > 960) {
        for (const [left, right] of pairs) {
          if (Math.abs(boxes[left].top - boxes[right].top) > 1 || Math.abs(boxes[left].bottom - boxes[right].bottom) > 1)
            failures.push(left + '/' + right + ' row edges differ');
        }
      } else {
        for (let i = 1; i < names.length; i++)
          if (boxes[names[i]].top < boxes[names[i - 1]].bottom) failures.push('mobile order/overlap');
        if (document.documentElement.scrollWidth > width) failures.push('mobile horizontal overflow');
      }
      for (const name of names) {
        const pane = document.querySelector('.' + name + '-pane');
        if (pane.scrollHeight > pane.clientHeight + 1) failures.push(name + ' content overflows');
      }
      const links = [...document.querySelectorAll('nav[aria-label="On this page"] a')].map(a => a.getAttribute('href'));
      return { width, boxes, failures, links };
    }, { width, pairs });
    console.log(JSON.stringify(evidence));
    assert.deepEqual(evidence.links, ['#about', '#posts', '#tags', '#commits']);
    assert.deepEqual(evidence.failures, [], `Home geometry at ${width}px`);
    await page.close();
  }
} finally {
  await browser?.close();
  server.close();
}
