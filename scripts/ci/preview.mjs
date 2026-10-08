import { setTimeout as delay } from 'node:timers/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { previewUrl } from './preview-url.mjs';

export async function readGithub(path, execute = promisify(execFile)) {
  const { stdout } = await execute('gh', ['api', `repos/daiksudme/apex/${path}`, '--paginate', '--slurp'], {
    timeout: 30_000, maxBuffer: 8 * 1024 * 1024,
  });
  const pages = JSON.parse(stdout);
  if (Array.isArray(pages) && pages.length) {
    if (/^deployments(?:\?|\/\d+\/statuses(?:\?|$)|$)/.test(path) && pages.every(Array.isArray)) return pages.flat();
    if (/^commits\/[0-9a-f]{40}\/check-runs(?:\?|$)/.test(path)
      && pages.every((page) => Array.isArray(page?.check_runs))) {
      return { check_runs: pages.flatMap((page) => page.check_runs) };
    }
    if (/^check-suites\/\d+$/.test(path) && pages.length === 1
      && pages[0] && typeof pages[0] === 'object' && !Array.isArray(pages[0])) return pages[0];
  }
  throw new Error(`Unexpected GitHub API response for ${path}`);
}

export async function waitForPreview(read, source, {
  timeoutMs = 600_000, intervalMs = 10_000, now = Date.now, pause = delay,
} = {}) {
  const started = now();
  while (true) {
    const evidence = await findPreview(read, source);
    if (evidence) return evidence;
    const remaining = timeoutMs - (now() - started);
    if (remaining <= 0) throw new Error('Preview readiness timed out without matching successful evidence');
    await pause(Math.min(intervalMs, remaining));
  }
}

export async function findPreview(read, source) {
  const { check_runs: checks } = await read(`commits/${source.sha}/check-runs?per_page=100`);
  const deployments = await read(`deployments?sha=${source.sha}&environment=preview&per_page=100`);
  for (const check of checks.toSorted((a, b) => (b.id ?? 0) - (a.id ?? 0))) {
    if (check.head_sha !== source.sha || check.app?.id !== 85455
      || check.app?.slug !== 'cloudflare-workers-and-pages'
      || check.name !== 'Workers Builds: apex' || !check.check_suite?.id) continue;
    const suite = await read(`check-suites/${check.check_suite.id}`);
    if (suite?.repository?.full_name !== 'daiksudme/apex'
      || suite.head_sha !== source.sha || suite.head_branch !== source.branch) continue;
    if (check.status !== 'completed') return null;
    if (check.conclusion !== 'success') throw new Error(`Preview provider failed: ${check.conclusion}`);
    for (const deployment of deployments) {
      if (deployment.sha !== source.sha || deployment.environment !== 'preview'
        || deployment.production_environment !== false) continue;
      const statuses = await read(`deployments/${deployment.id}/statuses?per_page=100`);
      const status = statuses[0];
      const evidence = { check, suite, deployment, status };
      const url = matchPreview(evidence, source);
      if (url) return { ...evidence, url };
      if (status?.log_url === check.details_url
        && status.environment_url === previewUrl(source.branch)
        && ['failure', 'error'].includes(status.state)) {
        throw new Error(`Preview deployment failed: ${status.state}`);
      }
    }
    return null;
  }
  return null;
}

export function matchPreview({ check, suite, deployment, status }, { sha, branch }) {
  if (typeof branch !== 'string' || !branch || !/^[0-9a-f]{40}$/.test(sha ?? '')) return null;
  const expectedUrl = previewUrl(branch);
  const matches = branch && branch !== 'main'
    && check?.head_sha === sha
    && check?.app?.id === 85455
    && check?.app?.slug === 'cloudflare-workers-and-pages'
    && check?.name === 'Workers Builds: apex'
    && check?.status === 'completed' && check?.conclusion === 'success'
    && suite?.repository?.full_name === 'daiksudme/apex'
    && suite?.head_sha === sha && suite?.head_branch === branch
    && deployment?.sha === sha && deployment?.environment === 'preview'
    && deployment?.production_environment === false
    && status?.state === 'success'
    && Boolean(check?.details_url) && status?.log_url === check.details_url
    && status?.environment_url === expectedUrl;
  return matches ? status.environment_url : null;
}

if (import.meta.main) {
  try {
    const [sha, branch] = process.argv.slice(2);
    if (!/^[0-9a-f]{40}$/.test(sha ?? '') || !branch || branch === 'main') {
      throw new Error('A PR source SHA and non-main branch are required');
    }
    if (!previewUrl(branch)) throw new Error('The source branch cannot produce a Cloudflare Preview alias');
    const started = Date.now();
    const result = await waitForPreview(readGithub, { sha, branch });
    console.log(JSON.stringify({
      sourceHeadSha: sha, sourceBranch: branch, previewUrl: result.url,
      checkId: result.check.id, suiteId: result.check.check_suite.id,
      deploymentId: result.deployment.id, statusId: result.status.id,
      providerWaitMs: Date.now() - started,
    }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
