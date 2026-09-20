import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { github, currentControl, latestMain, cloudflare, required } from './api.mjs';
import { changeWhenOpen, restoreTarget } from './control.mjs';
import { candidate, download } from './download.mjs';
import { worker, deployment } from './worker.mjs';
import { verifyHttp } from './http.mjs';

async function latestReceipt() {
  for (let page = 1; page <= 20; page++) {
    const result = await github(`actions/workflows/delivery.yml/runs?branch=main&status=success&per_page=100&page=${page}`);
    for (const run of result.workflow_runs) {
      if (String(run.id) === process.env.GITHUB_RUN_ID) continue;
      if (run.event !== 'workflow_dispatch' && run.event !== 'workflow_run') throw new Error('Unexpected delivery history');
      download(run.id, 'delivery-receipt', '.previous');
      const receipt = JSON.parse(readFileSync('.previous/receipt.json', 'utf8'));
      if (String(receipt.delivery_run) !== String(run.id) || receipt.status !== 'verified') throw new Error('Invalid delivery receipt');
      return receipt;
    }
    if (result.workflow_runs.length < 100) return null;
  }
  throw new Error('Delivery history could not be established');
}
try {
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
