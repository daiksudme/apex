import { mkdirSync, writeFileSync } from 'node:fs';
import { digest } from './artifact.mjs';
const sha = process.env.GITHUB_SHA;
const run = process.env.GITHUB_RUN_ID;
if (!/^[a-f0-9]{40}$/.test(sha) || !/^\d+$/.test(run)) throw new Error('Expected CI provenance');
mkdirSync('dist/.well-known', { recursive: true });
writeFileSync('dist/.well-known/apex.json', JSON.stringify({ sha, run }));
writeFileSync('manifest.json', JSON.stringify({ sha, run, hash: digest('dist') }));
