import { expect, it } from 'vitest';
import {
  classifyEnvironment,
  deploymentRequest,
  deploymentStatusRequest,
  ensureDeployment,
  ensureStatus,
  findDeployment,
  isTargetCheck,
  listDeployments,
  listStatuses,
  parseBuildDetails,
  statusForConclusion,
  statusDecision,
  terminalConclusion,
  validatedBranch,
} from '../.github/scripts/cloudflare-deployment.mjs';

const checkSha = 'a'.repeat(40);
const buildId = 'a700dfa8-72aa-469e-a91f-9c067b04a9c7';
const productionBuildId = 'e23c9f40-5ca4-4df5-a1b3-4a0932d5671d';
const previewBuildId = '8788aeb6-807f-4ccc-8578-212f34f47a3f';
const previewSlug = 'codex-44-preview-event-probe';

function genericBuildCheck() {
  return {
    external_id: buildId,
    details_url: `https://dash.cloudflare.com/a1f28decfde7c9df1884714e574d2059/workers/services/view/apex/production/builds/${buildId}`,
  };
}

function productionBuildCheck() {
  return {
    external_id: productionBuildId,
    details_url: `https://dash.cloudflare.com/a1f28decfde7c9df1884714e574d2059/workers/services/view/apex/production/builds/${productionBuildId}`,
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

it('builds Deployment requests for the Check SHA and each Cloudflare build', () => {
  const event = sourceEventAndSuite().event;
  event.check_run.id = 108865227916;
  event.check_run.head_sha = '37976fe0d6136469e1d458b0c97f4a920e914169';
  const details = { buildId: previewBuildId, kind: 'preview', previewSlug };
  const preview = deploymentRequest(event, 'preview', details);
  expect(preview).toEqual({
    ref: '37976fe0d6136469e1d458b0c97f4a920e914169',
    environment: 'preview',
    auto_merge: false,
    required_contexts: [],
    production_environment: false,
    payload: {
      source: 'cloudflare-workers-builds',
      build_id: previewBuildId,
      check_run_id: 108865227916,
    },
  });
  expect(preview.ref).not.toBe('708e015c6767f28ccfcf65b994568c084cc49650');
  const productionEvent = targetEvent();
  productionEvent.check_run.id = 108901733751;
  productionEvent.check_run.head_sha = '708e015c6767f28ccfcf65b994568c084cc49650';
  expect(deploymentRequest(productionEvent, 'production', { buildId: productionBuildId, kind: 'generic' })).toEqual({
    ref: '708e015c6767f28ccfcf65b994568c084cc49650',
    environment: 'production',
    auto_merge: false,
    required_contexts: [],
    production_environment: true,
    payload: {
      source: 'cloudflare-workers-builds',
      build_id: productionBuildId,
      check_run_id: 108901733751,
    },
  });
  const rebuiltId = '11111111-1111-4111-8111-111111111111';
  const rebuilt = deploymentRequest(event, 'preview', { ...details, buildId: rebuiltId });
  expect(rebuilt.ref).toBe(preview.ref);
  expect(rebuilt.payload.build_id).toBe(rebuiltId);
  expect(() => deploymentRequest(event, 'unknown', details)).toThrow();
});

it('builds terminal Status requests without inactivating other Previews', () => {
  const previewCheck = previewBuildCheck();
  expect(deploymentStatusRequest(previewCheck, 'preview', 'success')).toEqual({
    state: 'success',
    log_url: previewCheck.details_url,
    auto_inactive: false,
  });
  const failedCheck = genericBuildCheck();
  for (const state of ['failure', 'error']) {
    expect(deploymentStatusRequest(failedCheck, 'preview', state)).toEqual({
      state,
      log_url: failedCheck.details_url,
      auto_inactive: false,
    });
  }
  expect(deploymentStatusRequest(failedCheck, 'production', 'failure')).toEqual({
    state: 'failure',
    log_url: failedCheck.details_url,
    auto_inactive: false,
  });
  expect(() => deploymentStatusRequest(previewCheck, 'preview', 'unknown')).toThrow();
  expect(() => deploymentStatusRequest(previewCheck, 'unknown', 'success')).toThrow();
});

it('links only a successful Production Status to the verified public endpoint', () => {
  const check = productionBuildCheck();
  expect(deploymentStatusRequest(check, 'production', 'success')).toEqual({
    state: 'success',
    log_url: check.details_url,
    auto_inactive: false,
    environment_url: 'https://apex.daiksud-a1f.workers.dev/',
  });
  expect(deploymentStatusRequest(check, 'production', 'error')).toEqual({
    state: 'error',
    log_url: check.details_url,
    auto_inactive: false,
  });
});

it('finds exactly one Deployment for a Build without collapsing same-SHA rebuilds', () => {
  const request = deploymentRequest({
    check_run: { head_sha: 'a'.repeat(40), id: 108865227916 },
  }, 'preview', { buildId: previewBuildId });
  const matching = {
    id: 101,
    sha: request.ref,
    environment: 'preview',
    payload: request.payload,
  };
  expect(findDeployment([matching], request)).toBe(matching);
  const earlierCheck = { ...matching, payload: { ...matching.payload, check_run_id: 108864963627 } };
  expect(findDeployment([earlierCheck], request)).toBe(earlierCheck);
  const stringPayload = { ...matching, payload: JSON.stringify(matching.payload) };
  expect(findDeployment([stringPayload], request)).toBe(stringPayload);
  expect(findDeployment([], request)).toBeNull();
  expect(findDeployment([{ ...matching, payload: { ...matching.payload, build_id: buildId } }], request)).toBeNull();
  expect(findDeployment([{ ...matching, sha: 'b'.repeat(40) }], request)).toBeNull();
  expect(findDeployment([{ ...matching, environment: 'production' }], request)).toBeNull();
  expect(findDeployment([{ ...matching, payload: { ...matching.payload, source: 'other' } }], request)).toBeNull();
  expect(findDeployment([{ ...matching, payload: '{broken' }], request)).toBeNull();
  expect(() => findDeployment([matching, { ...matching, id: 102 }], request)).toThrow();
  expect(() => findDeployment([{ ...matching, id: null }], request)).toThrow();
});

it('creates a missing Status and leaves an identical result alone', () => {
  const expected = deploymentStatusRequest(previewBuildCheck(), 'preview', 'success');
  const matching = { id: 201, state: expected.state, log_url: expected.log_url };
  const conflictingState = { ...matching, id: 202, state: 'failure' };
  const conflictingLog = { ...matching, id: 203, log_url: 'https://example.com/other-build' };

  expect(statusDecision([], expected)).toBe('create');
  expect(statusDecision([matching], expected)).toBe('skip');
  expect(statusDecision([{ ...matching, environment_url: null }], expected)).toBe('skip');
  expect(statusDecision([{ ...matching, environment_url: '' }], expected)).toBe('skip');
  expect(() => statusDecision([conflictingState], expected)).toThrow();
  expect(() => statusDecision([conflictingLog], expected)).toThrow();
  expect(() => statusDecision([matching, conflictingState], expected)).toThrow();
  expect(() => statusDecision([conflictingState, matching], expected)).toThrow();

  const productionExpected = deploymentStatusRequest(productionBuildCheck(), 'production', 'success');
  const productionMatching = {
    state: 'success',
    log_url: productionExpected.log_url,
    environment_url: productionExpected.environment_url,
  };
  expect(statusDecision([productionMatching], productionExpected)).toBe('skip');
  for (const environment_url of [undefined, null, '', 'https://example.com/stale']) {
    expect(() => statusDecision([{ ...productionMatching, environment_url }], productionExpected)).toThrow();
  }
  expect(() => statusDecision([{ ...matching, environment_url: 'https://example.com/preview' }], expected)).toThrow();
});

it('reads every Deployment page for the exact SHA and Environment', async () => {
  const request = deploymentRequest({ check_run: { head_sha: 'a'.repeat(40), id: 1 } },
    'preview', { buildId: previewBuildId });
  const matching = { id: 102, sha: request.ref, environment: 'preview', payload: request.payload };
  const otherBuild = { ...matching, id: 101, payload: { ...matching.payload, build_id: buildId } };
  const urls = [];
  const getPage = async (url) => {
    urls.push(String(url));
    if (new URL(url).searchParams.get('page') === '1') {
      return Response.json([otherBuild], {
        headers: { link: '<https://api.github.com/repositories/1377818284/deployments?page=2>; rel="next"' },
      });
    }
    return Response.json([matching]);
  };
  const all = await listDeployments(getPage, request);
  expect(all).toEqual([otherBuild, matching]);
  expect(findDeployment(all, request)).toEqual(matching);
  expect(urls.map((value) => {
    const url = new URL(value);
    return [url.origin + url.pathname, url.searchParams.get('sha'),
      url.searchParams.get('environment'), url.searchParams.get('per_page'), url.searchParams.get('page')];
  })).toEqual([
    ['https://api.github.com/repos/daiksudme/apex/deployments', request.ref, 'preview', '100', '1'],
    ['https://api.github.com/repos/daiksudme/apex/deployments', request.ref, 'preview', '100', '2'],
  ]);

  await expect(listDeployments(async () => { throw new Error('API failed'); }, request)).rejects.toThrow('API failed');
  await expect(listDeployments(async () => new Response('error', { status: 500 }), request)).rejects.toThrow();
  await expect(listDeployments(async () => Response.json({ message: 'not a list' }), request)).rejects.toThrow();
});

it('reuses a Build Deployment or creates one for a different Build', async () => {
  const request = deploymentRequest({ check_run: { head_sha: 'a'.repeat(40), id: 1 } },
    'preview', { buildId: previewBuildId });
  const stored = [];
  const posts = [];
  const api = async (url, init) => {
    if (!init) return Response.json(stored);
    const body = JSON.parse(init.body);
    posts.push({ url, body });
    const created = { id: 100 + posts.length, sha: body.ref,
      environment: body.environment, payload: body.payload };
    stored.push(created);
    return Response.json(created, { status: 201 });
  };

  const created = await ensureDeployment(api, request);
  expect(posts).toHaveLength(1);
  expect(created).toEqual(stored[0]);
  expect(posts).toEqual([{ url: 'https://api.github.com/repos/daiksudme/apex/deployments', body: request }]);
  expect(await ensureDeployment(api, request)).toEqual(stored[0]);
  expect(posts).toHaveLength(1);

  const rebuild = deploymentRequest({ check_run: { head_sha: request.ref, id: 2 } },
    'preview', { buildId: '11111111-1111-4111-8111-111111111111' });
  expect(await ensureDeployment(api, rebuild)).toEqual(stored[1]);
  expect(posts[1].body).toEqual(rebuild);
});

it('recovers a Deployment creation that succeeded before the API call failed', async () => {
  const request = deploymentRequest({ check_run: { head_sha: 'a'.repeat(40), id: 1 } },
    'preview', { buildId: previewBuildId });
  const stored = [];
  let posts = 0;
  const api = async (_url, init) => {
    if (!init) return Response.json(stored);
    posts += 1;
    stored.push({ id: 201, sha: request.ref, environment: request.environment, payload: request.payload });
    throw new Error('connection lost after create');
  };
  await expect(ensureDeployment(api, request)).rejects.toThrow('connection lost');
  expect(await ensureDeployment(api, request)).toEqual(stored[0]);
  expect(posts).toBe(1);
});

it('fails when GitHub rejects or misreports a new Deployment', async () => {
  const request = deploymentRequest({ check_run: { head_sha: 'a'.repeat(40), id: 1 } },
    'preview', { buildId: previewBuildId });
  const rejected = async (_url, init) => init
    ? new Response('error', { status: 500 }) : Response.json([]);
  await expect(ensureDeployment(rejected, request)).rejects.toThrow();
  const merged = async (_url, init) => init
    ? Response.json({ id: 300, sha: request.ref, environment: 'preview', payload: request.payload }, { status: 202 })
    : Response.json([]);
  await expect(ensureDeployment(merged, request)).rejects.toThrow();
  const mismatched = async (_url, init) => init
    ? Response.json({ id: 301, sha: 'b'.repeat(40), environment: 'preview', payload: request.payload }, { status: 201 })
    : Response.json([]);
  await expect(ensureDeployment(mismatched, request)).rejects.toThrow();
  const wrongBuild = async (_url, init) => init
    ? Response.json({ id: 302, sha: request.ref, environment: 'preview',
      payload: { ...request.payload, build_id: buildId } }, { status: 201 })
    : Response.json([]);
  await expect(ensureDeployment(wrongBuild, request)).rejects.toThrow();
});

it('reads every Status page for one Deployment before deciding to write', async () => {
  const first = { id: 1, state: 'pending', log_url: null };
  const terminal = { id: 2, state: 'success', log_url: previewBuildCheck().details_url };
  const urls = [];
  const getPage = async (url) => {
    urls.push(String(url));
    if (new URL(url).searchParams.get('page') === '1') {
      return Response.json([first], {
        headers: { link: '<https://api.github.com/repositories/1377818284/deployments/123/statuses?page=2>; rel="next"' },
      });
    }
    return Response.json([terminal]);
  };
  expect(await listStatuses(getPage, 123)).toEqual([first, terminal]);
  expect(urls.map((value) => {
    const url = new URL(value);
    return [url.origin + url.pathname, url.searchParams.get('per_page'), url.searchParams.get('page')];
  })).toEqual([
    ['https://api.github.com/repos/daiksudme/apex/deployments/123/statuses', '100', '1'],
    ['https://api.github.com/repos/daiksudme/apex/deployments/123/statuses', '100', '2'],
  ]);
  let calls = 0;
  await expect(listStatuses(async () => { calls += 1; return Response.json([]); }, 0)).rejects.toThrow();
  await expect(listStatuses(async () => { calls += 1; return Response.json([]); }, '123/other')).rejects.toThrow();
  expect(calls).toBe(0);
  await expect(listStatuses(async () => { throw new Error('API failed'); }, 123)).rejects.toThrow('API failed');
  await expect(listStatuses(async () => new Response('error', { status: 500 }), 123)).rejects.toThrow();
  await expect(listStatuses(async () => Response.json({ message: 'not a list' }), 123)).rejects.toThrow();
});

it('creates a terminal Status once and reuses it on rerun', async () => {
  const deployment = { id: 123 };
  const expected = deploymentStatusRequest(previewBuildCheck(), 'preview', 'success');
  const stored = [];
  const posts = [];
  const api = async (url, init) => {
    if (!init) return Response.json(stored);
    const body = JSON.parse(init.body);
    posts.push({ url, body });
    const created = { id: 201, ...body, environment_url: body.environment_url ?? '' };
    stored.push(created);
    return Response.json(created, { status: 201 });
  };
  expect(await ensureStatus(api, deployment, expected)).toEqual({ action: 'created', statusId: 201 });
  expect(posts).toEqual([{ url: 'https://api.github.com/repos/daiksudme/apex/deployments/123/statuses', body: expected }]);
  expect(await ensureStatus(api, deployment, expected)).toEqual({ action: 'skipped' });
  expect(posts).toHaveLength(1);
});

it('recovers a Status creation that persisted before the API call failed', async () => {
  const deployment = { id: 123 };
  const expected = deploymentStatusRequest(previewBuildCheck(), 'preview', 'success');
  const stored = [];
  let posts = 0;
  const api = async (_url, init) => {
    if (!init) return Response.json(stored);
    posts += 1;
    stored.push({ id: 202, state: expected.state, log_url: expected.log_url, environment_url: '' });
    throw new Error('connection lost after Status create');
  };
  await expect(ensureStatus(api, deployment, expected)).rejects.toThrow('connection lost');
  expect(await ensureStatus(api, deployment, expected)).toEqual({ action: 'skipped' });
  expect(posts).toBe(1);
});

it('rejects conflicting, failed, or invalid Status creation results', async () => {
  const deployment = { id: 123 };
  const expected = deploymentStatusRequest(previewBuildCheck(), 'preview', 'success');
  let posts = 0;
  const conflict = async (_url, init) => {
    if (init) posts += 1;
    return Response.json([{ id: 201, state: 'failure', log_url: expected.log_url }]);
  };
  await expect(ensureStatus(conflict, deployment, expected)).rejects.toThrow();
  expect(posts).toBe(0);
  const responseFor = (response) => async (_url, init) => init ? response : Response.json([]);
  await expect(ensureStatus(responseFor(new Response('error', { status: 500 })), deployment, expected)).rejects.toThrow();
  await expect(ensureStatus(responseFor(Response.json({ id: 203, ...expected }, { status: 202 })), deployment, expected)).rejects.toThrow();
  await expect(ensureStatus(responseFor(Response.json({ id: 0, ...expected }, { status: 201 })), deployment, expected)).rejects.toThrow();
  await expect(ensureStatus(responseFor(Response.json({ id: 204, ...expected, state: 'failure' }, { status: 201 })), deployment, expected)).rejects.toThrow();
  await expect(ensureStatus(responseFor(Response.json({ id: 205, ...expected, log_url: 'https://example.com/other-build' }, { status: 201 })), deployment, expected)).rejects.toThrow();
  const productionExpected = deploymentStatusRequest(productionBuildCheck(), 'production', 'success');
  await expect(ensureStatus(responseFor(Response.json({ id: 206, state: 'success',
    log_url: productionExpected.log_url, environment_url: '' }, { status: 201 })), deployment, productionExpected)).rejects.toThrow();
  await expect(ensureStatus(responseFor(Response.json({ id: 207, ...productionExpected,
    environment_url: 'https://example.com/stale' }, { status: 201 })), deployment, productionExpected)).rejects.toThrow();
});
