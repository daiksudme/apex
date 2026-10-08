import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const workflow = await readFile('.github/workflows/ci.yml', 'utf8');
const sourceSha = 'a'.repeat(40);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

test('API state jobs confine approved Draft and Ready write scopes without executing candidate code', () => {
  for (const name of ['prepare', 'ready', 'reconcile']) {
    const section = workflow.split(`\n  ${name}:\n`)[1].split(/\n  [a-z][a-z-]*:\n/)[0];
    assert.ok(section.includes('permissions:\n      actions: read\n      contents: write\n      pull-requests: write\n'));
    assert.doesNotMatch(section, /secrets\.|actions\/checkout|install dependencies|upload-artifact|download-artifact|actions\/cache/);
  }
});

test('candidate graph runs fast checks, matched Preview smoke, and browser acceptance with read-only credentials', () => {
  const section = (name) => workflow.split(`\n  ${name}:\n`)[1].split(/\n  [a-z][a-z-]*:\n/)[0];
  const commit = section('commit-stage');
  const acceptance = section('acceptance-stage');
  assert.match(commit, /checks: read/);
  assert.match(commit, /deployments: read/);
  for (const job of [commit, acceptance]) {
    assert.match(job, /contents: read/);
    assert.match(job, /persist-credentials: false/);
    assert.doesNotMatch(job, /(?:pull-requests|contents|actions|deployments): write|secrets\./);
  }
  assert.match(commit, /pnpm test:unit/);
  assert.match(commit, /pnpm test:ci/);
  assert.match(commit, /node scripts\/ci\/preview\.mjs "\$SOURCE_SHA" "\$SOURCE_BRANCH"/);
  assert.match(commit, /pnpm test:smoke "\$PREVIEW_URL"/);
  assert.match(acceptance, /playwright install --with-deps --only-shell chromium/);
  assert.match(acceptance, /test -n "\$PREVIEW_URL"/);
  assert.match(acceptance, /pnpm test:acceptance "\$PREVIEW_URL"/);
  assert.match(acceptance, /upload-artifact@[0-9a-f]{40}/);
  assert.match(acceptance, /path: test-results\/acceptance/);
});

function inlineScript(job) {
  const section = workflow.split(`\n  ${job}:\n`)[1]?.split(/\n  [a-z][a-z-]*:\n/)[0];
  const body = section?.match(/          script: (?:&[a-z-]+ )?\|\n((?:            .*\n|\n)+)/)?.[1];
  assert.ok(body, `${job} must have an API-only inline script`);
  return body.replace(/^ {12}/gm, '');
}

function fixture() {
  const source = { number: 174, head: { sha: sourceSha, ref: 'ci/fixture', repo: { full_name: 'daiksudme/apex', fork: false } }, user: { login: 'daiksud' } };
  const current = { ...structuredClone(source), node_id: 'PR_fixture', state: 'open', draft: false };
  const run = { id: 10, run_attempt: 1, workflow_id: 20, head_sha: sourceSha, head_branch: source.head.ref, event: 'pull_request', status: 'in_progress' };
  const latest = { ...run };
  const jobs = [{ name: 'commit-stage', run_id: 10, head_sha: sourceSha, status: 'completed', conclusion: 'success' }];
  const mutations = [];
  const github = {
    rest: {
      pulls: { get: async () => ({ data: structuredClone(current) }) },
      actions: { getWorkflowRun: async () => ({ data: run }), listWorkflowRuns: async () => ({ data: { workflow_runs: [latest] } }), listJobsForWorkflowRunAttempt: async () => ({ data: { jobs } }) },
    },
    graphql: async (query, variables) => { mutations.push([query, variables]); current.draft = !query.includes('markPullRequestReadyForReview'); },
  };
  const context = { repo: { owner: 'daiksudme', repo: 'apex' }, payload: { pull_request: source }, eventName: 'pull_request', runId: 10, actor: 'daiksud' };
  const core = { setOutput() {}, info() {}, warning() {} };
  const process = { env: { MODE: 'draft', GITHUB_RUN_ATTEMPT: '1' } };
  const execute = () => new AsyncFunction('github', 'context', 'core', 'process', inlineScript('prepare'))(github, context, core, process);
  return { source, current, run, latest, jobs, mutations, context, core, process, github, execute };
}

test('STATE-01 marks an eligible current source/run/attempt Draft and confirms it', async () => {
  const value = fixture();
  await value.execute();
  assert.equal(value.current.draft, true);
  assert.equal(value.mutations.length, 1);
  assert.match(value.mutations[0][0], /convertPullRequestToDraft/);
  assert.deepEqual(value.mutations[0][1], { id: 'PR_fixture' });
});

for (const [name, change] of [
  ['source head', (value) => { value.current.head.sha = 'b'.repeat(40); }],
  ['run source', (value) => { value.run.head_sha = 'b'.repeat(40); }],
  ['run branch', (value) => { value.run.head_branch = 'other'; }],
  ['run event', (value) => { value.run.event = 'push'; }],
  ['canceled run', (value) => { value.run.status = 'completed'; }],
  ['run attempt', (value) => { value.run.run_attempt = 2; }],
  ['newer run', (value) => { value.latest.id = 11; }],
  ['fork', (value) => { value.source.head.repo.fork = true; }],
  ['Dependabot', (value) => { value.source.user.login = 'dependabot[bot]'; }],
]) {
  test(`STATE-01 refuses ${name} without mutating state`, async () => {
    const value = fixture();
    change(value);
    await assert.rejects(value.execute(), /Unsupported|Obsolete/);
    assert.equal(value.mutations.length, 0);
  });
}

test('STATE-01 is idempotent when the current PR is already Draft', async () => {
  const value = fixture();
  value.current.draft = true;
  await value.execute();
  assert.equal(value.mutations.length, 0);
});

test('STATE-01 stops a changed head immediately before mutation', async () => {
  const value = fixture();
  let reads = 0;
  value.github.rest.pulls.get = async () => {
    if (++reads === 2) value.current.head.sha = 'b'.repeat(40);
    return { data: structuredClone(value.current) };
  };
  await assert.rejects(value.execute(), /Obsolete/);
  assert.equal(value.mutations.length, 0);
});

test('STATE-01 detects a changed head after mutation without blind compensation', async () => {
  const value = fixture();
  value.github.graphql = async (...args) => {
    value.mutations.push(args);
    value.current.draft = true;
    value.current.head.sha = 'b'.repeat(40);
  };
  await assert.rejects(value.execute(), /Obsolete/);
  assert.equal(value.mutations.length, 1);
});

function readyFixture() {
  const value = fixture();
  value.current.draft = true;
  value.source.draft = true;
  value.process.env.MODE = 'ready';
  value.process.env.NEEDS_RESULTS = JSON.stringify({ prepare: { result: 'success' }, 'commit-stage': { result: 'success' } });
  return value;
}

test('STATE-02 promotes current native commit success despite the original Draft snapshot', async () => {
  const value = readyFixture();
  await value.execute();
  assert.equal(value.current.draft, false);
  assert.equal(value.mutations.length, 1);
  assert.match(value.mutations[0][0], /markPullRequestReadyForReview/);
});

for (const [name, change] of [
  ['failed native commit', (value) => { value.jobs[0].conclusion = 'failure'; }],
  ['pending native commit', (value) => { value.jobs[0].status = 'in_progress'; }],
  ['wrong native job source', (value) => { value.jobs[0].head_sha = 'b'.repeat(40); }],
  ['missing native commit', (value) => { value.jobs.length = 0; }],
  ['skipped native dependency', (value) => { value.process.env.NEEDS_RESULTS = JSON.stringify({ prepare: { result: 'success' }, 'commit-stage': { result: 'skipped' } }); }],
]) {
  test(`STATE-02 rejects ${name} before promotion`, async () => {
    const value = readyFixture();
    change(value);
    await assert.rejects(value.execute(), /Commit stage/);
    assert.equal(value.mutations.length, 0);
  });
}

function reconcileFixture(result = 'failure') {
  const value = readyFixture();
  value.process.env.MODE = 'reconcile';
  value.current.draft = false;
  value.process.env.NEEDS_RESULTS = JSON.stringify({ prepare: { result: 'success' }, 'commit-stage': { result: 'success' }, ready: { result: 'success' }, 'acceptance-stage': { result } });
  value.jobs.push({ name: 'acceptance-stage', run_id: 10, head_sha: sourceSha, status: 'completed', conclusion: result });
  return value;
}

function timingFixture(seconds = 301) {
  const value = readyFixture();
  const iso = (seconds) => new Date(seconds * 1000).toISOString();
  value.run.created_at = iso(0);
  Object.assign(value.jobs[0], { started_at: iso(100), completed_at: iso(seconds), steps: [
    { name: 'wait for matched Preview', started_at: iso(200), completed_at: iso(290) },
  ] });
  value.jobs.push({ name: 'prepare', started_at: iso(10), completed_at: iso(30) });
  value.warnings = [];
  value.summaries = [];
  value.comments = [];
  value.core.warning = (message) => value.warnings.push(message);
  value.core.summary = { addRaw(message) { value.summaries.push(message); return this; }, async write() {} };
  value.github.rest.issues = { listComments() {}, createComment: async ({ body }) => {
    value.comments.push({ body, user: { login: 'github-actions[bot]' } });
  } };
  value.github.paginate = async () => value.comments;
  return value;
}

test('TIMING-01 overrun reports the full path without double-counting and still promotes', async () => {
  const value = timingFixture();
  await value.execute();
  assert.equal(value.current.draft, false);
  assert.equal(value.comments.length, 1);
  assert.match(value.comments[0].body, /301s.*80s.*131s.*90s/s);
  assert.equal(value.warnings.length, 1);
  assert.match(value.summaries.join(''), /301s/);
  await value.execute();
  assert.equal(value.comments.length, 1);
});

test('TIMING-01 exactly five minutes reports without overrun notification', async () => {
  const value = timingFixture(300);
  await value.execute();
  assert.equal(value.warnings.length, 0);
  assert.equal(value.comments.length, 0);
  assert.match(value.summaries.join(''), /300s/);
});

test('TIMING-01 notification failure does not block functional promotion', async () => {
  const value = timingFixture();
  value.github.rest.issues.createComment = async () => { throw new Error('notification unavailable'); };
  await value.execute();
  assert.equal(value.current.draft, false);
  assert.match(value.warnings.join(''), /notification unavailable/);
});

test('TIMING-01 rechecks current source before sending an overrun notification', async () => {
  const value = timingFixture();
  value.github.paginate = async () => { value.current.head.sha = 'b'.repeat(40); return []; };
  await assert.rejects(value.execute(), /Obsolete/);
  assert.equal(value.comments.length, 0);
  assert.equal(value.mutations.length, 0);
});

test('TIMING-01 missing native timestamps warn without fabricated timing or blocked promotion', async () => {
  const value = timingFixture();
  delete value.run.created_at;
  await value.execute();
  assert.equal(value.current.draft, false);
  assert.equal(value.comments.length, 0);
  assert.match(value.warnings.join(''), /timing unavailable/);
});

test('TIMING-01 reruns explicitly label the original creation baseline and attempt', async () => {
  const value = timingFixture();
  value.run.run_attempt = value.latest.run_attempt = 2;
  value.process.env.GITHUB_RUN_ATTEMPT = '2';
  await value.execute();
  assert.match(value.comments[0].body, /since workflow creation \(includes earlier attempts\)/);
  assert.match(value.comments[0].body, /attempt 2/);
});

test('TIMING-01 comment lookup transport failure remains nonblocking', async () => {
  const value = timingFixture();
  value.github.paginate = async () => { throw new Error('comment lookup unavailable'); };
  await value.execute();
  assert.equal(value.current.draft, false);
  assert.equal(value.comments.length, 0);
  assert.match(value.warnings.join(''), /comment lookup unavailable/);
});

test('STATE-03 returns terminal current acceptance failure to Draft', async () => {
  const value = reconcileFixture();
  await value.execute();
  assert.equal(value.current.draft, true);
  assert.equal(value.mutations.length, 1);
  assert.match(value.mutations[0][0], /convertPullRequestToDraft/);
});

test('STATE-03 leaves successful acceptance Ready without promoting again', async () => {
  const value = reconcileFixture('success');
  await value.execute();
  assert.equal(value.current.draft, false);
  assert.equal(value.mutations.length, 0);
  value.current.draft = true;
  await assert.rejects(value.execute(), /Ready state/);
  assert.equal(value.mutations.length, 0);
});

test('STATE-03 returns skipped or canceled acceptance to Draft without another cycle', async () => {
  for (const result of ['skipped', 'cancelled']) {
    const value = reconcileFixture(result);
    await value.execute();
    assert.equal(value.current.draft, true);
    assert.equal(value.mutations.length, 1);
  }
});

test('STATE-03 fails closed when successful dependency lacks successful native acceptance', async () => {
  const value = reconcileFixture('success');
  value.jobs.at(-1).conclusion = 'failure';
  await assert.rejects(value.execute(), /Acceptance stage/);
  assert.equal(value.current.draft, true);
});

function gateFixture(main = false) {
  const value = fixture();
  value.current.draft = false;
  value.jobs.length = 0;
  const names = ['prepare', 'commit-stage', 'ready', 'acceptance-stage', 'reconcile'];
  const needs = Object.fromEntries(names.map((name) => [name, { result: main && ['prepare', 'ready', 'reconcile'].includes(name) ? 'skipped' : 'success' }]));
  for (const name of names) value.jobs.push({ name, run_id: 10, head_sha: sourceSha, status: 'completed', conclusion: needs[name].result });
  value.process.env.NEEDS_RESULTS = JSON.stringify(needs);
  value.github.rest.repos = { getBranch: async () => ({ data: { commit: { sha: sourceSha } } }) };
  if (main) {
    value.context.eventName = 'push';
    value.context.ref = 'refs/heads/main';
    value.context.sha = sourceSha;
    value.context.payload = {};
    value.run.head_branch = 'main';
    value.run.event = 'push';
    value.latest.head_branch = 'main';
    value.latest.event = 'push';
    value.github.rest.pulls.get = async () => assert.fail('main must not read/mutate PR state');
  }
  value.execute = () => new AsyncFunction('github', 'context', 'core', 'process', inlineScript('ci'))(value.github, value.context, value.core, value.process);
  return { ...value, needs };
}

test('GATE-01 requires all current PR stages and state jobs', async () => {
  const value = gateFixture();
  await value.execute();
  assert.equal(value.mutations.length, 0);
  for (const name of Object.keys(value.needs)) {
    for (const result of ['failure', 'skipped', 'cancelled', undefined]) {
      const changed = gateFixture();
      changed.needs[name].result = result;
      changed.process.env.NEEDS_RESULTS = JSON.stringify(changed.needs);
      await assert.rejects(changed.execute(), /Required validation/);
      assert.equal(changed.mutations.length, 0);
    }
  }
});

test('GATE-01 refuses failed or missing native evidence and stale identity', async () => {
  for (const change of [
    (value) => { value.jobs.find((job) => job.name === 'ready').conclusion = 'failure'; },
    (value) => { value.jobs.length = 0; },
    (value) => { value.current.head.sha = 'b'.repeat(40); },
    (value) => { value.latest.id = 11; },
    (value) => { value.run.run_attempt = 2; },
    (value) => { value.current.draft = true; },
    (value) => { value.current.state = 'closed'; },
    (value) => { value.jobs.push({ ...value.jobs[0] }); },
    (value) => { value.jobs[0].head_sha = 'b'.repeat(40); },
    (value) => { value.run.status = 'completed'; },
  ]) {
    const value = gateFixture();
    change(value);
    await assert.rejects(value.execute(), /Required validation|Obsolete/);
  }
});

test('GATE-02 supports explicit main skips without any PR mutation', async () => {
  const value = gateFixture(true);
  await value.execute();
  assert.equal(value.mutations.length, 0);
  value.github.rest.repos.getBranch = async () => ({ data: { commit: { sha: 'b'.repeat(40) } } });
  await assert.rejects(value.execute(), /Obsolete main/);
  value.needs.ready.result = 'success';
  value.process.env.NEEDS_RESULTS = JSON.stringify(value.needs);
  await assert.rejects(value.execute(), /Required validation/);
});

test('GATE-01 does not complete the supported lifecycle for fork or Dependabot PRs', async () => {
  for (const change of [
    (value) => { value.source.head.repo.fork = true; },
    (value) => { value.source.user.login = 'dependabot[bot]'; },
  ]) {
    const value = gateFixture();
    change(value);
    await assert.rejects(value.execute(), /Unsupported/);
    assert.equal(value.mutations.length, 0);
  }
});
