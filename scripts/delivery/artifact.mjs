import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
export const hashBytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function digest(directory) {
  const entries = [];
  function walk(path, prefix = '') {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const name = `${prefix}${entry.name}`;
      if (entry.isDirectory()) walk(join(path, entry.name), `${name}/`);
      else if (entry.isFile()) entries.push([name, hashBytes(readFileSync(join(path, entry.name)))]);
      else throw new Error('Unexpected artifact entry');
    }
  }
  walk(directory);
  if (!entries.length) throw new Error('Empty artifact');
  entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return hashBytes(JSON.stringify(entries));
}
export function verifyArtifact(directory, manifest, sha) {
  if (manifest?.sha !== sha || !/^[a-f0-9]{40}$/.test(sha) || manifest.hash !== digest(directory)) throw new Error('Invalid artifact hash or SHA');
}
