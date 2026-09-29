// @ts-nocheck -- Temporary CI diagnostic, deleted before merge; Node typings are not a project dependency.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { gzipSync } from 'node:zlib';
import { test } from 'vitest';
import { profile } from '../config/site';

test('exports public build assets for visual inspection', async () => {
  const dist = new URL('../../dist/', import.meta.url);
  if (!existsSync(new URL('index.html', dist))) return;
  const files = { 'index.html': readFileSync(new URL('index.html', dist), 'utf8') };
  const styles = new URL('_astro/', dist);
  if (existsSync(styles)) {
    for (const filename of readdirSync(styles)) {
      if (filename.endsWith('.css')) {
        files[`_astro/${filename}`] = readFileSync(new URL(filename, styles), 'utf8');
      }
    }
  }
  console.log(`HOME_BUILD:${gzipSync(JSON.stringify(files)).toString('base64')}`);
  const avatarResponse = await fetch(profile.avatarUrl.replace('s=320', 's=160'), { signal: AbortSignal.timeout(10000) });
  if (!avatarResponse.ok) throw new Error(`Avatar HTTP ${avatarResponse.status}`);
  console.log(`HOME_AVATAR:${Buffer.from(await avatarResponse.arrayBuffer()).toString('base64')}`);
}, 15000);
