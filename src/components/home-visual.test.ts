// Temporary diagnostic: removed after inspecting the production build in Chromium.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { test } from 'vitest';
import { profile } from '../config/site';

test('exports public build assets for visual inspection', async () => {
  const dist = new URL('../../dist/', import.meta.url);
  if (!existsSync(new URL('index.html', dist))) return;
  const files: Record<string, string> = {
    'index.html': readFileSync(new URL('index.html', dist), 'utf8'),
  };
  for (const filename of readdirSync(new URL('_astro/', dist))) {
    if (filename.endsWith('.css')) {
      files[`_astro/${filename}`] = readFileSync(new URL(`_astro/${filename}`, dist), 'utf8');
    }
  }
  const avatarResponse = await fetch(profile.avatarUrl, { signal: AbortSignal.timeout(10000) });
  if (!avatarResponse.ok) throw new Error(`Avatar HTTP ${avatarResponse.status}`);
  const avatar = Buffer.from(await avatarResponse.arrayBuffer()).toString('base64');
  const payload = { files, avatar, avatarType: avatarResponse.headers.get('content-type') };
  console.log(`HOME_VISUAL_SNAPSHOT:${gzipSync(JSON.stringify(payload)).toString('base64')}`);
}, 15000);
