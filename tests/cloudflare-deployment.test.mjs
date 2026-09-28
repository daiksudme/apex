import { expect, it } from 'vitest';
import {
  isTargetCheck,
  parseBuildDetails,
  terminalConclusion,
  validatedBranch,
} from '../.github/scripts/cloudflare-deployment.mjs';

const checkSha = 'a'.repeat(40);
const buildId = 'a700dfa8-72aa-469e-a91f-9c067b04a9c7';

function genericBuildCheck() {
  return {
    external_id: buildId,
    details_url: `https://dash.cloudflare.com/a1f28decfde7c9df1884714e574d2059/workers/services/view/apex/production/builds/${buildId}`,
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
