import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('repository import supports production and branch previews without an account binding', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.preview_urls, true);
  assert.deepEqual(config.previews, {});
  assert.equal(config.workers_dev, true);
  assert.equal(config.name, 'apex');
  assert.equal(config.assets.directory, './dist');
  assert.equal(config.assets.html_handling, 'auto-trailing-slash');
  assert.equal(config.assets.not_found_handling, '404-page');
  for (const key of ['account_id', 'routes', 'route', 'env']) {
    assert.equal(Object.hasOwn(config, key), false, `${key} must not constrain repository import`);
  }
});
