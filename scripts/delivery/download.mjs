import { mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { github } from './api.mjs';
import { assertVerifiedRun, repository } from './control.mjs';
import { verifyArtifact } from './artifact.mjs';
export function download(run, name, directory) {
  if (!/^\d+$/.test(String(run))) throw new Error('Invalid run ID');
  mkdirSync(directory, { recursive: true });
  const result = spawnSync('gh', ['run', 'download', String(run), '--repo', repository, '--name', name, '--dir', directory], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Artifact unavailable');
}
export async function candidate(runId, directory = '.delivery') {
  const run = await github(`actions/runs/${runId}`);
  assertVerifiedRun(run);
  download(runId, 'verified-site', directory);
  const manifest = JSON.parse(readFileSync(`${directory}/manifest.json`, 'utf8'));
  if (String(manifest.run) !== String(runId)) throw new Error('Artifact run mismatch');
  verifyArtifact(`${directory}/dist`, manifest, run.head_sha);
  return manifest;
}
