import { mkdirSync, openSync, closeSync, readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { github, cloudflare, currentControl, latestMain, required } from './api.mjs';
import { assertDelivery } from './control.mjs';
import { assertPlan } from './plan.mjs';
import { checkBackend, checkTerraformEnvironment } from '../../foundation-tools/lib/backend.mjs';
const root = 'terraform/apex';
const bootstrap = process.env.OPERATION === 'bootstrap';
const verify = process.env.OPERATION === 'verify';
mkdirSync('.private', { recursive: true, mode: 0o700 });
const log = openSync('.private/terraform.log', 'w', 0o600);
const run = (args) => spawnSync('terraform', [`-chdir=${root}`, ...args], { stdio: ['ignore', log, log] }).status;
const capture = (args) => execFileSync('terraform', [`-chdir=${root}`, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
async function gate() {
  const latest = await latestMain();
  if (latest !== required('GITHUB_SHA')) throw new Error('Stale workflow SHA');
  const control = await currentControl({ missing: bootstrap });
  if (!bootstrap) return assertDelivery(control, process.env.GITHUB_SHA, latest);
  if (control !== null) throw new Error('Bootstrap refuses existing control');
  // Fail closed if the account contains any Worker: never recover missing state by recreating it.
  const workers = await cloudflare('workers/workers?per_page=1');
  if (!Array.isArray(workers) || workers.length) throw new Error('Bootstrap requires no existing Worker');
}
try {
  if (!['bootstrap', 'apply', 'verify'].includes(process.env.OPERATION) || process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Invalid IaC operation');
  checkTerraformEnvironment();
  const policies = (await github('environments/apex-operations/deployment-branch-policies')).branch_policies;
  if (policies.length !== 1 || policies[0].name !== 'main' || policies[0].type !== 'branch') throw new Error('Expected main-only environment');
  process.env.TF_VAR_protected_policy_id = String(policies[0].id);
  await gate();
  if (run(['init', '-input=false', '-reconfigure', '-lockfile=readonly']) !== 0) throw new Error('Backend initialization failed');
  checkBackend(JSON.parse(readFileSync(`${root}/.terraform/terraform.tfstate`, 'utf8')).backend, 'apex', capture(['workspace', 'show']).trim());
  if (bootstrap) {
    const existing = capture(['state', 'list']).trim();
    if (existing) throw new Error('Bootstrap refuses existing state; inspect partial initialization');
  }
  const status = run(['plan', '-input=false', '-detailed-exitcode', '-out=../../.private/apex.tfplan']);
  if (![0, 2].includes(status)) throw new Error('Plan failed');
  if (verify) {
    if (status !== 0) throw new Error('Terraform/Wrangler coexistence has drift');
    console.log('Terraform plan has no changes after delivery.');
  } else {
    assertPlan(JSON.parse(capture(['show', '-json', '../../.private/apex.tfplan'])), bootstrap);
    await gate();
    if (run(['apply', '-input=false', '../../.private/apex.tfplan']) !== 0) throw new Error('Apply failed');
    console.log('IaC apply completed.');
  }
} catch { console.error('IaC failed. No state or plan was published; inspect permissions, controls and private diagnostics before retrying.'); process.exitCode = 1; }
finally { closeSync(log); }
