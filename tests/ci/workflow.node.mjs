import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const read = (path) => readFile(path, 'utf8').catch((error) => {
  if (error.code === 'ENOENT') return '';
  throw error;
});
const pr = await read('.github/workflows/ci-pr.yml');
const push = await read('.github/workflows/ci-push.yml');
const commit = await read('.github/actions/commit-stage/action.yml');
const acceptance = await read('.github/actions/acceptance-stage/action.yml');
const job = (workflow, name) => {
  const section = workflow.split(`\n  ${name}:\n`)[1]?.split(/\n  [a-z][a-z-]*:\n/)[0];
  assert.ok(section, `missing ${name} job`);
  return section;
};

test('PR uses native dependencies, concurrency and the required ci job name', () => {
  assert.match(pr, /pull_request:/);
  assert.doesNotMatch(pr, /\n  push:/);
  assert.match(pr, /group: ci-pr-\$\{\{ github.event.pull_request.number \}\}/);
  assert.match(pr, /cancel-in-progress: true/);
  assert.match(job(pr, 'commit-stage'), /needs: draft/);
  assert.match(job(pr, 'ready'), /needs: commit-stage/);
  assert.match(job(pr, 'acceptance-stage'), /needs: \[commit-stage, ready\]/);
  const gate = job(pr, 'ci');
  assert.match(gate, /name: ci/);
  assert.match(gate, /needs: \[draft, commit-stage, ready, acceptance-stage\]/);
  assert.match(gate, /always\(\)/);
  for (const name of ['draft', 'commit-stage', 'ready', 'acceptance-stage']) {
    assert.ok(gate.includes(`needs${name.includes('-') ? `['${name}']` : `.${name}`}.result == 'success'`));
  }
});

test('Mutation jobs use only gh and exclude candidate execution and untrusted PR writes', () => {
  for (const name of ['draft', 'ready', 'ci']) {
    const section = job(pr, name);
    assert.match(section, /contents: write/);
    assert.match(section, /pull-requests: write/);
    assert.doesNotMatch(section, /actions\/checkout|uses: \.\/|install|artifact|cache/);
    assert.match(section, /gh pr ready "\$PR_NUMBER" --repo "\$GH_REPO"/);
  }
  for (const name of ['draft', 'ci']) {
    assert.match(job(pr, name), /!github.event.pull_request.head.repo.fork/);
    assert.match(job(pr, name), /dependabot\[bot\]/);
  }
});

test('Both workflows reuse focused composites in read-only checked-out validation jobs', () => {
  for (const workflow of [pr, push]) for (const name of ['commit-stage', 'acceptance-stage']) {
    const section = job(workflow, name);
    assert.match(section, /contents: read/);
    assert.doesNotMatch(section, /(?:contents|pull-requests|actions|deployments): write/);
    assert.match(section, /actions\/checkout@[a-f0-9]{40}/);
    assert.match(section, /persist-credentials: false/);
    assert.ok(section.includes(`uses: ./.github/actions/${name}`));
  }
  assert.match(push, /push:\n    branches: \[main\]/);
  assert.doesNotMatch(push, /gh pr|pull-requests: write|pull_request:/);
  assert.match(job(push, 'ci'), /name: ci/);
  assert.match(job(push, 'ci'), /needs: \[commit-stage, acceptance-stage\]/);
  assert.match(job(push, 'ci'), /always\(\)/);
  for (const metadata of [commit, acceptance]) {
    assert.match(metadata, /using: composite/);
    assert.doesNotMatch(metadata, /actions\/checkout|gh pr ready/);
  }
  assert.match(commit, /pnpm test:unit/);
  assert.match(commit, /pnpm test:ci/);
  assert.match(commit, /node scripts\/ci\/preview.mjs "\$SOURCE_SHA" "\$SOURCE_BRANCH"/);
  assert.match(commit, /pnpm test:smoke "\$PREVIEW_URL"/);
  assert.match(acceptance, /playwright install --with-deps --only-shell chromium/);
  assert.match(acceptance, /test -n "\$PREVIEW_URL"/);
  assert.match(acceptance, /upload-artifact@[a-f0-9]{40}/);
  assert.doesNotMatch(pr + push + commit + acceptance, /github-script|listWorkflowRuns|listJobsForWorkflow|MODE:|GITHUB_RUN_ATTEMPT|core\.summary/);
});

test('Final ci preserves failure after demotion and does not mutate on success', async (t) => {
  const script = job(pr, 'ci').match(/        run: \|\n((?:          .*\n|\n)+)/)?.[1]?.replace(/^ {10}/gm, '');
  assert.ok(script, 'final ci must have a shell gate');
  const directory = await mkdtemp(join(tmpdir(), 'apex-ci-gate-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'gh'), '#!/bin/sh\nprintf "%s\\n" "$@" > "$GH_RECORD"\nexit "$GH_EXIT"\n', { mode: 0o755 });
  for (const [passed, ghExit, expected] of [['true', '0', 0], ['false', '0', 1], ['', '0', 1], ['false', '1', 1]]) {
    const record = join(directory, `calls-${passed}-${ghExit}`);
    const result = spawnSync('/bin/bash', ['-e', '-o', 'pipefail', '-c', script], {
      env: { PATH: `${directory}:/usr/bin:/bin`, MUTATION_ELIGIBLE: 'true', VALIDATION_PASSED: passed, GH_EXIT: ghExit, GH_RECORD: record, GH_REPO: 'daiksudme/apex', PR_NUMBER: '174' },
      encoding: 'utf8', timeout: 2_000,
    });
    assert.equal(result.status, expected, result.stderr);
    if (passed === 'true') await assert.rejects(readFile(record), { code: 'ENOENT' });
    else assert.deepEqual((await readFile(record, 'utf8')).trim().split('\n'), ['pr', 'ready', '174', '--repo', 'daiksudme/apex', '--undo']);
  }
});

test('Unsupported PRs fail required ci without executing gh', async (t) => {
  const script = job(pr, 'ci').match(/        run: \|\n((?:          .*\n|\n)+)/)?.[1]?.replace(/^ {10}/gm, '');
  const directory = await mkdtemp(join(tmpdir(), 'apex-ci-excluded-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const record = join(directory, 'gh-call');
  await writeFile(join(directory, 'gh'), '#!/bin/sh\nprintf called > "$GH_RECORD"\n', { mode: 0o755 });
  const result = spawnSync('/bin/bash', ['-e', '-o', 'pipefail', '-c', script], {
    env: { PATH: `${directory}:/usr/bin:/bin`, MUTATION_ELIGIBLE: 'false', VALIDATION_PASSED: 'true', GH_RECORD: record },
    encoding: 'utf8', timeout: 2_000,
  });
  assert.equal(result.status, 1, result.stderr);
  await assert.rejects(readFile(record), { code: 'ENOENT' });
  assert.match(job(pr, 'ci'), /if: always\(\)\n/);
});
