import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function previewUrl(branch) {
  const alias = branch.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  if (!/^[a-z](?:[a-z0-9-]*[a-z0-9])?$/.test(alias)) return null;
  // The five-character -apex suffix leaves 58 alias characters in a DNS label.
  const name = alias.length <= 58 ? alias
    : `${alias.slice(0, 53)}-${createHash('sha256').update(branch).digest('hex').slice(0, 4)}`;
  return `https://${name}-apex.daiksud-a1f.workers.dev/`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const branch = process.argv[2];
  const url = branch && previewUrl(branch);
  if (url) console.log(url);
  else {
    console.error('The source branch cannot produce a Cloudflare Preview alias');
    process.exitCode = 1;
  }
}
