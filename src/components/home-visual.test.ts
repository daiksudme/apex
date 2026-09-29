// @ts-nocheck -- Temporary CI diagnostic, deleted before merge; Node typings are not a project dependency.
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { test } from 'vitest';
import { profile } from '../config/site';

test('captures a small public avatar for offline layout inspection', async () => {
  const requireFromAstro = createRequire(import.meta.resolve('astro/package.json'));
  const sharp = requireFromAstro('sharp');
  const response = await fetch(profile.avatarUrl, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Avatar HTTP ${response.status}`);
  const jpeg = await sharp(Buffer.from(await response.arrayBuffer())).resize(160, 160).jpeg({ quality: 65 }).toBuffer();
  console.log(`HOME_AVATAR_JPEG:${jpeg.toString('base64')}`);
}, 15000);
