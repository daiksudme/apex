import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { github, currentControl, latestMain, cloudflare, required } from './api.mjs';
import { changeWhenOpen, restoreTarget, newestReceiptArtifact } from './control.mjs';
import { candidate, download } from './download.mjs';
import { worker, deployment } from './worker.mjs';
import { verifyHttp } from './http.mjs';

async function latestReceipt() {
  const artifacts = [];
  for (let page = 1; page <= 20; page++) {
    const result = await github(`actions/artifacts?name=delivery-receipt&per_page=100&page=${page}`);
    artifacts.push(...result.artifacts);
    if (result.artifacts.length < 100) break;
    if (page === 20) throw new Error('Delivery history could not be established');
  }
  const artifact = newestReceiptArtifact(artifacts);
  if (!artifact) return null;
  const runId = artifact.workflow_run.id;
  download(runId, 'delivery-receipt', '.previous');
  const receipt = JSON.parse(readFileSync('.previous/receipt.json', 'utf8'));
  if (String(receipt.delivery_run) !== String(runId) || receipt.status !== 'verified' || !/^\d+$/.test(String(receipt.attempt))) throw new Error('Invalid delivery receipt');
  const attempt = await github(`actions/runs/${runId}/attempts/${receipt.attempt}`);
  if (attempt.path !== '.github/workflows/delivery.yml' || attempt.head_branch !== 'main' || attempt.status !== 'completed' || attempt.conclusion !== 'success' || !['workflow_dispatch', 'workflow_run'].includes(attempt.event)) throw new Error('Unverified delivery attempt');
  if (String(runId) === process.env.GITHUB_RUN_ID) throw new Error('Use a new dispatch; this run already has an immutable receipt');
  return receipt;
}
try {
  if (required('GITHUB_RUN_ATTEMPT') !== '1') throw new Error('Start a new dispatch instead of rerunning a delivery run');
  const operation = process.env.OPERATION;
  if (!['deploy', 'rollback'].includes(operation) || process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Expected a main delivery operation');
  const currentWorker = await worker();
  const previous = await latestReceipt();
  let runId = required('VERIFY_RUN_ID');
  let restore;
  if (operation === 'rollback') {
    const target = restoreTarget(previous, await deployment());
    restore = target;
    runId = String(target.verification_run);
  }
  const manifest = await candidate(runId);
  if (restore && (manifest.sha !== restore.sha || manifest.hash !== restore.hash)) throw new Error('Restore artifact mismatch');
  if (operation === 'deploy' && manifest.sha !== process.env.GITHUB_SHA) throw new Error('Stale artifact SHA');
  // All downloads and setup finish before the final state/SHA check inside the shared workflow lock.
  const output = '.delivery/wrangler-output.jsonl';
  const result = await changeWhenOpen(currentControl, latestMain, required('GITHUB_SHA'), () => spawnSync('pnpm', ['exec', 'wrangler', 'deploy', '--assets', '.delivery/dist'], { stdio: 'inherit', env: { ...process.env, WRANGLER_OUTPUT_FILE_PATH: output, WRANGLER_SEND_METRICS: 'false' } }));
  if (result.status !== 0) throw new Error('Wrangler deployment failed');
  const entries = readFileSync(output, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  const uploaded = entries.findLast((entry) => entry.type === 'deploy');
  const active = await deployment();
  if (!uploaded?.version_id || active.version !== uploaded.version_id || uploaded.worker_name !== 'apex') throw new Error('Deployment identity mismatch');
  const settings = await cloudflare('workers/scripts/apex/subdomain');
  if (settings.enabled !== true || settings.previews_enabled !== false) throw new Error('Unexpected URL settings');
  await verifyHttp(manifest);
  writeFileSync('.delivery/receipt.json', JSON.stringify({ status: 'verified', sha: manifest.sha, hash: manifest.hash, verification_run: runId, ...active, worker_id: currentWorker.id, delivery_run: required('GITHUB_RUN_ID'), attempt: required('GITHUB_RUN_ATTEMPT'), operation, previous: previous && { sha: previous.sha, hash: previous.hash, verification_run: previous.verification_run, version: previous.version, deployment: previous.deployment, delivery_run: previous.delivery_run } }, null, 2));
  console.log('Verified deployment; receipt contains source, artifact hash, Worker version/deployment and run identity.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
