import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { synchronizeBuildCommands } from '../../scripts/cloudflare/builds.mjs';

const accountId = 'account';
const apiToken = 'fixture-api-token';
const workerName = 'apex';
const workerTag = 'worker-tag';
const configuration = { build_command: 'bun run build' };
const accountPath = `/client/v4/accounts/${accountId}`;
const workersPath = `${accountPath}/workers/scripts`;
const triggersPath = `${accountPath}/builds/workers/${workerTag}/triggers`;
const initialTriggers = [
  {
    trigger_uuid: 'production-trigger',
    trigger_name: 'Deploy the live site',
    external_script_id: workerTag,
    build_command: 'pnpm run build',
    deploy_command: 'npx wrangler deploy',
    branch_includes: ['main'],
    branch_excludes: [],
    root_directory: '/',
    build_caching_enabled: true,
    environment_variables: { EXAMPLE: { value: 'keep-me', is_secret: false } },
  },
  {
    trigger_uuid: 'preview-trigger',
    trigger_name: 'Review branches',
    external_script_id: workerTag,
    build_command: 'pnpm run build',
    deploy_command: 'npx wrangler preview',
    branch_includes: ['*'],
    branch_excludes: ['main'],
    root_directory: '/',
    build_caching_enabled: false,
    path_excludes: ['docs/**'],
  },
];

function cloudflare({ workers = [{ id: workerName, tag: workerTag }], triggers = initialTriggers } = {}) {
  const state = structuredClone(triggers);
  const requests = [];
  const patches = [];
  const controls = { failure: null, ignoreChanges: false, failAfter: null, resultInfo: null };
  const fetchImpl = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    assert.equal(url.origin, 'https://api.cloudflare.com');
    assert.equal(request.headers.get('authorization'), `Bearer ${apiToken}`);
    requests.push({ method: request.method, path: url.pathname });
    if (controls.failure) return Response.json(controls.failure.body, { status: controls.failure.status });
    if (request.method === 'GET' && url.pathname === workersPath) {
      return Response.json({ success: true, result: workers });
    }
    if (request.method === 'GET' && url.pathname === triggersPath) {
      return Response.json({ success: true, result: state, ...(controls.resultInfo && { result_info: controls.resultInfo }) });
    }
    if (request.method === 'PATCH' && url.pathname.startsWith(`${accountPath}/builds/triggers/`)) {
      const id = decodeURIComponent(url.pathname.slice(`${accountPath}/builds/triggers/`.length));
      const trigger = state.find((value) => value.trigger_uuid === id);
      assert.ok(trigger, 'PATCH must target an existing trigger for the selected Worker');
      const patch = await request.json();
      assert.deepEqual(Object.keys(patch), ['build_command'], 'only the managed field may be sent to Cloudflare');
      if (controls.failAfter !== null && patches.length >= controls.failAfter) {
        return Response.json({ success: false, errors: [{ code: 10000, message: 'Fixture mutation rejected' }] }, { status: 403 });
      }
      patches.push({ id, ...patch });
      if (!controls.ignoreChanges) Object.assign(trigger, patch);
      return Response.json({ success: true, result: trigger });
    }
    assert.fail(`Unexpected Cloudflare operation: ${request.method} ${url.pathname}`);
  };
  const run = (options = {}) => synchronizeBuildCommands({
    accountId, apiToken, workerName, configuration, fetchImpl, ...options,
  });
  return { state, requests, patches, controls, run };
}

test('plan reports production and Preview command changes without modifying Cloudflare', async () => {
  const api = cloudflare();
  const result = await api.run();
  assert.equal(result.mode, 'plan');
  assert.equal(result.worker, workerName);
  assert.equal(result.changes, 2);
  for (const initial of initialTriggers) {
    const change = result.triggers.find((value) => value.trigger_uuid === initial.trigger_uuid);
    assert.ok(change);
    assert.equal(change.trigger_name, initial.trigger_name);
    assert.deepEqual(change.branch_includes, initial.branch_includes);
    assert.deepEqual(change.branch_excludes, initial.branch_excludes);
    assert.equal(change.before, 'pnpm run build');
    assert.equal(change.after, 'bun run build');
    assert.equal(change.changed, true);
  }
  assert.deepEqual(api.state, initialTriggers);
  assert.ok(api.requests.every((request) => request.method === 'GET'));
});

test('apply updates both existing triggers and preserves deployment commands and unrelated settings', async () => {
  const api = cloudflare();
  const result = await api.run({ mode: 'apply' });
  assert.equal(result.mode, 'apply');
  assert.equal(result.changes, 2);
  assert.deepEqual(api.state, initialTriggers.map((trigger) => ({ ...trigger, ...configuration })));
  assert.equal(api.patches.length, 2);
});

test('apply changes only drifted commands and a repeated apply is a no-op', async () => {
  const triggers = structuredClone(initialTriggers);
  triggers[0].build_command = configuration.build_command;
  const api = cloudflare({ triggers });
  assert.equal((await api.run({ mode: 'apply' })).changes, 1);
  assert.deepEqual(api.patches, [{ id: 'preview-trigger', ...configuration }]);
  assert.equal((await api.run({ mode: 'apply' })).changes, 0);
  assert.deepEqual(api.patches, [{ id: 'preview-trigger', ...configuration }]);
});

test('a missing Worker fails without changing another Worker', async () => {
  const api = cloudflare({ workers: [{ id: 'other-worker', tag: 'other-tag' }] });
  await assert.rejects(api.run({ mode: 'apply' }), /worker/i);
  assert.equal(api.patches.length, 0);
  assert.deepEqual(api.state, initialTriggers);
});

test('a Worker without existing triggers fails without creating a trigger', async () => {
  const api = cloudflare({ triggers: [] });
  await assert.rejects(api.run({ mode: 'apply' }), /trigger/i);
  assert.ok(api.requests.every((request) => request.method === 'GET'));
});

test('malformed or duplicate trigger identities fail before any mutation', async () => {
  for (const triggers of [
    [initialTriggers[0], null],
    [initialTriggers[0], { ...initialTriggers[1], trigger_uuid: '' }],
    [initialTriggers[0], { ...initialTriggers[1], trigger_uuid: initialTriggers[0].trigger_uuid }],
  ]) {
    const api = cloudflare({ triggers });
    await assert.rejects(api.run({ mode: 'apply' }));
    assert.equal(api.patches.length, 0);
  }
});

test('invalid or unsupported configuration fails before mutation', async () => {
  for (const invalid of [null, {}, { build_command: '' }, { build_command: '   ' }, { build_command: 123 }, {
    ...configuration, deploy_command: 'unexpected deploy command',
  }]) {
    const api = cloudflare();
    await assert.rejects(api.run({ mode: 'apply', configuration: invalid }));
    assert.equal(api.patches.length, 0);
    assert.deepEqual(api.state, initialTriggers);
  }
});

test('HTTP and API errors fail without exposing credentials or response contents', async () => {
  for (const status of [401, 200]) {
    const api = cloudflare();
    api.controls.failure = {
      status,
      body: { success: false, errors: [{ code: 10000, message: `${apiToken}: confidential response contents` }] },
    };
    await assert.rejects(api.run({ mode: 'apply' }), (error) => {
      assert.match(error.message, /Cloudflare|API|HTTP/i);
      assert.ok(!error.message.includes(apiToken));
      assert.ok(!error.message.includes('confidential response contents'));
      return true;
    });
    assert.equal(api.patches.length, 0);
  }
});

test('a successful PATCH response is insufficient when the settings do not persist', async () => {
  const api = cloudflare();
  api.controls.ignoreChanges = true;
  await assert.rejects(api.run({ mode: 'apply' }));
  assert.ok(api.patches.length > 0);
  assert.deepEqual(api.state, initialTriggers);
});

test('partial apply fails clearly and retry applies only the remaining change', async () => {
  const api = cloudflare();
  api.controls.failAfter = 1;
  await assert.rejects(api.run({ mode: 'apply' }));
  assert.equal(api.state.filter((trigger) => trigger.build_command === configuration.build_command).length, 1);
  assert.equal(api.patches.length, 1);
  api.controls.failAfter = null;
  assert.equal((await api.run({ mode: 'apply' })).changes, 1);
  assert.deepEqual(api.state, initialTriggers.map((trigger) => ({ ...trigger, ...configuration })));
  assert.equal(api.patches.length, 2);
});

test('incomplete trigger listings fail instead of applying only a subset', async () => {
  for (const resultInfo of [{ page: 2 }, { total_pages: 2 }, { total_count: 3 }]) {
    const api = cloudflare();
    api.controls.resultInfo = resultInfo;
    await assert.rejects(api.run({ mode: 'apply' }));
    assert.equal(api.patches.length, 0);
    assert.deepEqual(api.state, initialTriggers);
  }
});
