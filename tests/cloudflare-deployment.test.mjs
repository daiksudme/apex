import { expect, it } from 'vitest';
import {
  classifyEnvironment,
  isTargetCheck,
  parseBuildDetails,
  statusForConclusion,
  terminalConclusion,
  validatedBranch,
} from '../.github/scripts/cloudflare-deployment.mjs';

const checkSha = 'a'.repeat(40);
const buildId = 'a700dfa8-72aa-469e-a91f-9c067b04a9c7';
const previewBuildId = '8788aeb6-807f-4ccc-8578-212f34f47a3f';
const previewSlug = 'codex-44-preview-event-probe';

function genericBuildCheck() {
  return {
    external_id: buildId,
    details_url: `https://dash.cloudflare.com/a1f28decfde7c9df1884714e574d2059/workers/services/view/apex/production/builds/${buildId}`,
  };
}

function previewBuildCheck() {
  return {
    external_id: previewBuildId,
    details_url: `https://dash.cloudflare.com/a1f28decfde7c9df1884714e574d2059/workers/services/view/apex/production/previews/${previewSlug}/builds/${previewBuildId}`,
  };
}

function targetEvent() {
  return {
    repository: { full_name: 'daiksudme/apex' },
    check_run: {
      app: { id: 85455, slug: 'cloudflare-workers-and-pages' },
      name: 'Workers Builds: apex',
    },
  };
}

function sourceEventAndSuite() {
  const event = targetEvent();
  event.check_run.head_sha = checkSha;
  event.check_run.check_suite = { id: 42 };
  const suite = {
    id: 42,
    head_sha: checkSha,
    head_branch: 'codex/44-preview-event-probe',
    app: { id: 85455, slug: 'cloudflare-workers-and-pages' },
  };
  return { event, suite };
}

it('uses the Check state instead of the event action for terminal results', () => {
  expect(terminalConclusion({
    action: 'created',
    check_run: { status: 'completed', conclusion: 'success' },
  })).toBe('success');

  expect(terminalConclusion({
    action: 'completed',
    check_run: { status: 'in_progress', conclusion: null },
  })).toBeNull();
});

it('maps the main terminal Check conclusions without inventing success', () => {
  expect(statusForConclusion('success')).toBe('success');
  expect(statusForConclusion('failure')).toBe('failure');
  expect(statusForConclusion('cancelled')).toBe('error');
  expect(statusForConclusion(null)).toBeNull();
  expect(statusForConclusion('unknown')).toBeNull();
});

it('maps every other documented non-success Check conclusion to error', () => {
  for (const conclusion of ['action_required', 'neutral', 'skipped', 'stale', 'timed_out']) {
    expect(statusForConclusion(conclusion), conclusion).toBe('error');
  }
  expect(statusForConclusion('startup_failure')).toBeNull();
});

it('recognizes Production only for main with a generic Build path', () => {
  expect(classifyEnvironment('main', { kind: 'generic' }, 'success')).toBe('production');
  expect(classifyEnvironment('main', { kind: 'generic' }, 'failure')).toBe('production');
  expect(classifyEnvironment('main', { kind: 'preview', previewSlug }, 'success')).toBeNull();
  expect(classifyEnvironment('main', null, 'success')).toBeNull();
  expect(classifyEnvironment('main', { kind: 'unknown' }, 'success')).toBeNull();
  expect(classifyEnvironment(null, { kind: 'generic' }, 'success')).toBeNull();
  expect(classifyEnvironment('', { kind: 'generic' }, 'success')).toBeNull();
});

it('recognizes Preview only for a non-main branch with a Preview Build path', () => {
  const preview = { kind: 'preview', previewSlug };
  expect(classifyEnvironment('codex/44-preview-event-probe', preview, 'success')).toBe('preview');
  expect(classifyEnvironment('codex/44-preview-event-probe', preview, 'failure')).toBe('preview');
  expect(classifyEnvironment('main', preview, 'success')).toBeNull();
  expect(classifyEnvironment(null, preview, 'success')).toBeNull();
  expect(classifyEnvironment('', preview, 'success')).toBeNull();
  expect(classifyEnvironment('  ', preview, 'success')).toBeNull();
  expect(classifyEnvironment('codex/44-preview-event-probe', { kind: 'generic' }, 'success')).toBeNull();
});

it('records a failed non-main generic Build as a failed Preview attempt', () => {
  const generic = { kind: 'generic' };
  expect(classifyEnvironment('codex/42-mise-toolchain', generic, 'failure')).toBe('preview');
  expect(classifyEnvironment('codex/42-mise-toolchain', generic, 'error')).toBe('preview');
  expect(classifyEnvironment('codex/42-mise-toolchain', generic, 'success')).toBeNull();
  expect(classifyEnvironment('codex/42-mise-toolchain', generic, null)).toBeNull();
  expect(classifyEnvironment('codex/42-mise-toolchain', generic, 'unknown')).toBeNull();
  expect(classifyEnvironment('main', generic, 'error')).toBe('production');
  expect(classifyEnvironment(null, generic, 'failure')).toBeNull();
});

it('accepts only the target repository, App, and Check name together', () => {
  expect(isTargetCheck(targetEvent())).toBe(true);

  const mismatches = [
    ['repository', (event) => { event.repository.full_name = 'other/apex'; }],
    ['App ID', (event) => { event.check_run.app.id = 1; }],
    ['App slug', (event) => { event.check_run.app.slug = 'other-app'; }],
    ['Check name', (event) => { event.check_run.name = 'other check'; }],
    ['missing repository', (event) => { delete event.repository; }],
    ['missing App', (event) => { delete event.check_run.app; }],
    ['missing Check name', (event) => { delete event.check_run.name; }],
  ];
  for (const [field, change] of mismatches) {
    const event = targetEvent();
    change(event);
    expect(isTargetCheck(event), field).toBe(false);
  }
});

it('returns a branch only when the Check and Suite identify the same source', () => {
  const source = sourceEventAndSuite();
  expect(validatedBranch(source.event, source.suite)).toBe('codex/44-preview-event-probe');

  const mismatches = [
    ['malformed Check SHA', ({ event }) => { event.check_run.head_sha = 'abc'; }],
    ['different Suite SHA', ({ suite }) => { suite.head_sha = 'b'.repeat(40); }],
    ['different Suite ID', ({ suite }) => { suite.id = 43; }],
    ['missing event Suite ID', ({ event }) => { delete event.check_run.check_suite; }],
    ['missing both Suite IDs', ({ event, suite }) => {
      delete event.check_run.check_suite;
      delete suite.id;
    }],
    ['missing fetched Suite', (candidate) => { candidate.suite = null; }],
    ['different Suite App ID', ({ suite }) => { suite.app.id = 1; }],
    ['different Suite App slug', ({ suite }) => { suite.app.slug = 'other-app'; }],
    ['missing Suite App', ({ suite }) => { delete suite.app; }],
    ['empty branch', ({ suite }) => { suite.head_branch = ''; }],
    ['whitespace branch', ({ suite }) => { suite.head_branch = '  '; }],
    ['non-string branch', ({ suite }) => { suite.head_branch = 42; }],
    ['missing branch', ({ suite }) => { delete suite.head_branch; }],
  ];
  for (const [field, change] of mismatches) {
    const candidate = sourceEventAndSuite();
    change(candidate);
    expect(validatedBranch(candidate.event, candidate.suite), field).toBeNull();
  }
});

it('accepts only the target Worker generic Build URL with its matching Build ID', () => {
  expect(parseBuildDetails(genericBuildCheck())).toEqual({ buildId, kind: 'generic' });

  const mismatches = [
    ['different external ID', (check) => { check.external_id = 'b'.repeat(36); }],
    ['missing external ID', (check) => { delete check.external_id; }],
    ['matching malformed IDs', (check) => {
      check.external_id = 'not-a-uuid';
      check.details_url = check.details_url.replace(buildId, 'not-a-uuid');
    }],
    ['missing URL', (check) => { delete check.details_url; }],
    ['wrong host', (check) => { check.details_url = check.details_url.replace('dash.cloudflare.com', 'example.com'); }],
    ['wrong account', (check) => { check.details_url = check.details_url.replace('a1f28decfde7c9df1884714e574d2059', 'other'); }],
    ['wrong Worker', (check) => { check.details_url = check.details_url.replace('/apex/', '/other/'); }],
    ['extra path', (check) => { check.details_url += '/extra'; }],
    ['query', (check) => { check.details_url += '?x=1'; }],
    ['fragment', (check) => { check.details_url += '#x'; }],
    ['non-HTTPS', (check) => { check.details_url = check.details_url.replace('https:', 'http:'); }],
  ];
  for (const [field, change] of mismatches) {
    const check = genericBuildCheck();
    change(check);
    expect(parseBuildDetails(check), field).toBeNull();
  }
});

it('accepts only the target Worker Preview Build URL with its matching Build ID', () => {
  expect(parseBuildDetails(previewBuildCheck())).toEqual({
    buildId: previewBuildId,
    kind: 'preview',
    previewSlug,
  });

  const mismatches = [
    ['missing slug', (check) => { check.details_url = check.details_url.replace(previewSlug, ''); }],
    ['encoded slash', (check) => { check.details_url = check.details_url.replace(previewSlug, 'codex%2Fother'); }],
    ['extra segment', (check) => { check.details_url = check.details_url.replace('/builds/', '/extra/builds/'); }],
    ['different external ID', (check) => { check.external_id = buildId; }],
    ['wrong account', (check) => { check.details_url = check.details_url.replace('a1f28decfde7c9df1884714e574d2059', 'other'); }],
    ['wrong Worker', (check) => { check.details_url = check.details_url.replace('/apex/', '/other/'); }],
    ['wrong host', (check) => { check.details_url = check.details_url.replace('dash.cloudflare.com', 'example.com'); }],
    ['query', (check) => { check.details_url += '?x=1'; }],
  ];
  for (const [field, change] of mismatches) {
    const check = previewBuildCheck();
    change(check);
    expect(parseBuildDetails(check), field).toBeNull();
  }
});
