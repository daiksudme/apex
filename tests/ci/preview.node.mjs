import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { matchPreview, findPreview, waitForPreview, readGithub } from '../../scripts/ci/preview.mjs';
import { previewUrl } from '../../scripts/ci/preview-url.mjs';

const sha = 'a'.repeat(40);
const branch = 'ci/161-pr-stages';
const url = 'https://ci-161-pr-stages-apex.daiksud-a1f.workers.dev/';
const logUrl = 'https://dash.cloudflare.com/builds/fixture';
const evidence = {
  check: { head_sha: sha, app: { id: 85455, slug: 'cloudflare-workers-and-pages' }, name: 'Workers Builds: apex', status: 'completed', conclusion: 'success', details_url: logUrl },
  suite: { head_sha: sha, head_branch: branch, repository: { full_name: 'daiksudme/apex' } },
  deployment: { id: 123, sha, environment: 'preview', production_environment: false },
  status: { state: 'success', log_url: logUrl, environment_url: url },
};

test('returns the recorded URL only from matching provider, suite, deployment and success status', () => {
  assert.equal(matchPreview(evidence, { sha, branch }), url);
});

test('matches the provider alias for punctuation and uppercase branch names', () => {
  const sourceBranch = 'Fix/API_v2...---';
  const expected = 'https://fix-api-v2-apex.daiksud-a1f.workers.dev/';
  const record = structuredClone(evidence);
  record.suite.head_branch = sourceBranch;
  record.status.environment_url = expected;
  assert.equal(matchPreview(record, { sha, branch: sourceBranch }), expected);
});

test('preserves the provider DNS boundary and hashes the original long branch', () => {
  assert.equal(previewUrl('a'.repeat(59)), `https://${'a'.repeat(59)}-apex.daiksud-a1f.workers.dev/`);
  assert.equal(previewUrl('a'.repeat(60)), `https://${'a'.repeat(54)}-11ee-apex.daiksud-a1f.workers.dev/`);
  assert.notEqual(previewUrl('A'.repeat(60)), previewUrl('a'.repeat(60)));
});

test('rejects branch aliases without a leading letter instead of inventing a URL', () => {
  for (const sourceBranch of ['123-feature', '___', '']) assert.equal(previewUrl(sourceBranch), null);
});

test('shared URL CLI prints the normalized URL and fails for invalid aliases', async () => {
  const execute = promisify(execFile);
  const result = await execute(process.execPath, ['scripts/ci/preview-url.mjs', 'fix/api_v2']);
  assert.equal(result.stdout.trim(), 'https://fix-api-v2-apex.daiksud-a1f.workers.dev/');
  await assert.rejects(execute(process.execPath, ['scripts/ci/preview-url.mjs', '123-feature']), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /cannot produce a Cloudflare Preview alias/);
    return true;
  });
});

test('Preview readiness rejects an unusable alias before calling GitHub', async () => {
  await assert.rejects(promisify(execFile)(process.execPath, ['scripts/ci/preview.mjs', sha, '123-feature']), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /cannot produce a Cloudflare Preview alias/);
    return true;
  });
});

for (const [name, change] of [
  ['provider app', (value) => { value.check.app.id = 1; }],
  ['provider slug', (value) => { value.check.app.slug = 'other'; }],
  ['check name', (value) => { value.check.name = 'other'; }],
  ['provider conclusion', (value) => { value.check.conclusion = 'failure'; }],
  ['provider SHA', (value) => { value.check.head_sha = 'b'.repeat(40); }],
  ['suite repository', (value) => { value.suite.repository.full_name = 'other/repo'; }],
  ['suite branch', (value) => { value.suite.head_branch = 'other'; }],
  ['suite SHA', (value) => { value.suite.head_sha = 'b'.repeat(40); }],
  ['deployment SHA', (value) => { value.deployment.sha = 'b'.repeat(40); }],
  ['deployment environment', (value) => { value.deployment.environment = 'production'; }],
  ['status success', (value) => { value.status.state = 'failure'; }],
  ['provider link', (value) => { value.status.log_url = 'https://other.invalid/'; }],
  ['recorded URL', (value) => { value.status.environment_url = 'https://other.invalid/'; }],
  ['missing suite', (value) => { delete value.suite; }],
  ['missing status', (value) => { delete value.status; }],
]) {
  test(`rejects ${name} mismatch or missing evidence`, () => {
    const value = structuredClone(evidence);
    change(value);
    assert.equal(matchPreview(value, { sha, branch }), null);
  });
}

test('does not infer a Preview from absent source identity or incomplete records', () => {
  assert.equal(matchPreview({}, { sha, branch }), null);
  assert.equal(matchPreview(evidence, { sha }), null);
  assert.equal(matchPreview(evidence, { branch }), null);
});

test('consumes an already recorded matching deployment without waiting and retains exact evidence', async () => {
  const record = structuredClone(evidence);
  record.check.id = 45;
  record.check.check_suite = { id: 67 };
  record.status.id = 89;
  const responses = {
    [`commits/${sha}/check-runs?per_page=100`]: { check_runs: [record.check] },
    [`deployments?sha=${sha}&environment=preview&per_page=100`]: [record.deployment],
    'check-suites/67': record.suite,
    'deployments/123/statuses?per_page=100': [record.status],
  };
  const read = async (path) => {
    assert.ok(Object.hasOwn(responses, path), `unexpected API path ${path}`);
    return responses[path];
  };
  const result = await findPreview(read, { sha, branch });
  assert.ok(result, 'matching existing Preview must be available immediately');
  assert.equal(result.url, url);
  assert.equal(result.deployment.id, 123);
  assert.equal(result.status.id, 89);
  assert.equal(result.check.id, 45);
});

test('fails on the matching latest deployment status instead of reusing an older success', async () => {
  const record = structuredClone(evidence);
  record.check.check_suite = { id: 67 };
  const read = async (path) => {
    if (path.includes('/check-runs')) return { check_runs: [record.check] };
    if (path.startsWith('check-suites/')) return record.suite;
    if (path.includes('/statuses')) return [{ ...record.status, state: 'failure' }, record.status];
    return [record.deployment];
  };
  await assert.rejects(findPreview(read, { sha, branch }), /Preview deployment failed: failure/);
});

test('waits for delayed evidence within an ordinary readiness limit', async () => {
  let polls = 0;
  let elapsed = 0;
  const record = structuredClone(evidence);
  record.check.check_suite = { id: 67 };
  const read = async (path) => {
    if (path.includes('/check-runs')) { polls++; return { check_runs: [record.check] }; }
    if (path.startsWith('check-suites/')) return record.suite;
    if (path.includes('/statuses')) return [record.status];
    return polls >= 2 ? [record.deployment] : [];
  };
  const result = await waitForPreview(read, { sha, branch }, {
    timeoutMs: 10, intervalMs: 5, now: () => elapsed, pause: async (ms) => { elapsed += ms; },
  });
  assert.ok(result, 'delayed matching evidence must become available');
  assert.equal(result.deployment.id, 123);
  assert.equal(polls, 2);
  assert.equal(elapsed, 5);
});

test('fails bounded waiting and preserves API errors', async () => {
  let elapsed = 0;
  const options = { timeoutMs: 10, intervalMs: 5, now: () => elapsed, pause: async (ms) => { elapsed += ms; } };
  const missing = async (path) => path.includes('/check-runs') ? { check_runs: [] } : [];
  await assert.rejects(waitForPreview(missing, { sha, branch }, options), /Preview readiness timed out/);
  assert.equal(elapsed, 10);
  await assert.rejects(waitForPreview(async () => { throw new Error('API forbidden'); }, { sha, branch }, options), /API forbidden/);
});

for (const [name, path, pages, expected] of [
  ['deployment arrays', 'deployments?per_page=100', [[{ id: 1 }], [{ id: 2 }]], [{ id: 1 }, { id: 2 }]],
  ['check-run objects', `commits/${sha}/check-runs?per_page=100`, [{ check_runs: [{ id: 1 }] }, { check_runs: [{ id: 2 }] }], { check_runs: [{ id: 1 }, { id: 2 }] }],
  ['single suite', 'check-suites/1', [{ id: 1, head_sha: sha }], { id: 1, head_sha: sha }],
]) {
  test(`decodes native paginated ${name} with a bounded gh request`, async () => {
    const execute = async (command, args, options) => {
      assert.equal(command, 'gh');
      assert.deepEqual(args, ['api', `repos/daiksudme/apex/${path}`, '--paginate', '--slurp']);
      assert.equal(options.timeout, 30_000);
      return { stdout: JSON.stringify(pages) };
    };
    assert.deepEqual(await readGithub(path, execute), expected);
  });
}

test('rejects malformed native API shapes', async () => {
  for (const [path, pages] of [
    ['deployments?per_page=100', [{ id: 1 }]],
    [`commits/${sha}/check-runs?per_page=100`, [[{ id: 1 }]]],
    ['check-suites/1', [[{ id: 1 }]]],
  ]) {
    await assert.rejects(readGithub(path, async () => ({ stdout: JSON.stringify(pages) })), /Unexpected GitHub API response/);
  }
});

for (const conclusion of ['failure', 'cancelled', 'timed_out', 'action_required']) {
  test(`fails immediately for the matching terminal provider result ${conclusion}`, async () => {
    const record = structuredClone(evidence);
    record.check.check_suite = { id: 67 };
    record.check.conclusion = conclusion;
    const read = async (path) => {
      if (path.includes('/check-runs')) return { check_runs: [record.check] };
      if (path.startsWith('check-suites/')) return record.suite;
      return [];
    };
    await assert.rejects(waitForPreview(read, { sha, branch }, {
      pause: async () => { assert.fail('terminal provider failure must not wait'); },
    }), new RegExp(`Preview provider failed: ${conclusion}`));
    record.suite.head_branch = 'unrelated';
    assert.equal(await findPreview(read, { sha, branch }), null);
  });
}

test('ignores unrelated failed status and pending matching evidence', async () => {
  const record = structuredClone(evidence);
  record.check.check_suite = { id: 67 };
  const read = async (path) => {
    if (path.includes('/check-runs')) return { check_runs: [record.check] };
    if (path.startsWith('check-suites/')) return record.suite;
    if (path.includes('/statuses')) return [record.status];
    return [record.deployment];
  };
  record.status.state = 'failure';
  record.status.log_url = 'https://other.invalid/';
  assert.equal(await findPreview(read, { sha, branch }), null);
  record.status.log_url = logUrl;
  record.status.state = 'pending';
  assert.equal(await findPreview(read, { sha, branch }), null);
});

test('selects the latest matching provider attempt over an older failure', async () => {
  const record = structuredClone(evidence);
  record.check.check_suite = { id: 67 };
  const old = { ...record.check, id: 1, conclusion: 'failure' };
  const latest = { ...record.check, id: 2 };
  const read = async (path) => {
    if (path.includes('/check-runs')) return { check_runs: [old, latest] };
    if (path.startsWith('check-suites/')) return record.suite;
    if (path.includes('/statuses')) return [record.status];
    return [record.deployment];
  };
  assert.equal((await findPreview(read, { sha, branch })).url, url);
  latest.status = 'in_progress';
  latest.conclusion = null;
  assert.equal(await findPreview(read, { sha, branch }), null);
});

test('Preview CLI rejects invalid source identity before API access', async () => {
  for (const args of [[], ['not-a-sha', branch], [sha, ''], [sha, 'main']]) {
    await assert.rejects(promisify(execFile)(process.execPath, ['scripts/ci/preview.mjs', ...args]), (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /A PR source SHA and non-main branch are required/);
      return true;
    });
  }
});
