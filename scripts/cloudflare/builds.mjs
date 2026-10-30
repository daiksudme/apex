const apiOrigin = 'https://api.cloudflare.com/client/v4';
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

export async function synchronizeBuildCommands({
  accountId, apiToken, workerName, configuration, mode = 'plan', fetchImpl = fetch,
}) {
  if (!['plan', 'apply'].includes(mode)) throw new Error('Use plan or apply');
  if (!configuration || Array.isArray(configuration)
    || Object.keys(configuration).length !== 1 || !nonempty(configuration.build_command)) {
    throw new Error('cloudflare-builds.json must contain only a nonempty build_command string');
  }
  if (!nonempty(accountId)) throw new Error('CLOUDFLARE_ACCOUNT_ID is required');
  if (!nonempty(apiToken)) throw new Error('CLOUDFLARE_API_TOKEN is required');
  if (!nonempty(workerName)) throw new Error('wrangler.jsonc must specify a Worker name');

  const accountPath = `/accounts/${encodeURIComponent(accountId)}`;
  async function request(path, method = 'GET', body) {
    let response;
    try {
      response = await fetchImpl(`${apiOrigin}${accountPath}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error(`Cloudflare ${method} ${path} request failed or timed out`);
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Cloudflare ${method} ${path} returned invalid JSON (HTTP ${response.status})`);
    }
    if (!response.ok || data?.success !== true) {
      const codes = Array.isArray(data?.errors)
        ? data.errors.map((error) => error?.code).filter(Number.isInteger).join(', ') : '';
      throw new Error(`Cloudflare ${method} ${path} failed (HTTP ${response.status}${codes ? `; error codes: ${codes}` : ''})`);
    }
    return data;
  }

  async function readList(path) {
    const data = await request(path);
    if (!Array.isArray(data.result)) throw new Error(`Unexpected Cloudflare list response for ${path}`);
    const info = data.result_info;
    if (info?.page > 1 || info?.total_pages > 1 || info?.total_count > data.result.length) {
      throw new Error(`Incomplete Cloudflare list response for ${path}; refusing to update a partial list`);
    }
    return data.result;
  }

  const workers = (await readList('/workers/scripts')).filter((worker) => worker?.id === workerName);
  if (workers.length !== 1 || !nonempty(workers[0].tag)) {
    throw new Error(`Expected exactly one existing Worker with a tag named ${workerName}`);
  }
  const tag = workers[0].tag;
  const triggersPath = `/builds/workers/${encodeURIComponent(tag)}/triggers`;
  async function readTriggers() {
    const triggers = await readList(triggersPath);
    if (!triggers.length) throw new Error(`No existing Workers Builds triggers found for ${workerName}`);
    const ids = new Set();
    for (const trigger of triggers) {
      if (!nonempty(trigger?.trigger_uuid) || ids.has(trigger.trigger_uuid)
        || typeof trigger.build_command !== 'string'
        || (trigger.external_script_id !== undefined && trigger.external_script_id !== tag)) {
        throw new Error('Unexpected or duplicate Workers Builds trigger; no further changes will be made');
      }
      ids.add(trigger.trigger_uuid);
    }
    return triggers;
  }

  const triggers = (await readTriggers()).map((trigger) => ({
    trigger_uuid: trigger.trigger_uuid,
    trigger_name: trigger.trigger_name ?? trigger.trigger_uuid,
    branch_includes: trigger.branch_includes ?? [],
    branch_excludes: trigger.branch_excludes ?? [],
    before: trigger.build_command,
    after: configuration.build_command,
    changed: trigger.build_command !== configuration.build_command,
  }));
  const changes = triggers.filter((trigger) => trigger.changed);

  if (mode === 'apply' && changes.length) {
    let updated = 0;
    try {
      for (const trigger of changes) {
        await request(`/builds/triggers/${encodeURIComponent(trigger.trigger_uuid)}`, 'PATCH', {
          build_command: configuration.build_command,
        });
        updated += 1;
      }
      const actual = await readTriggers();
      if (actual.some((trigger) => trigger.build_command !== configuration.build_command)
        || triggers.some((expected) => !actual.some((trigger) => trigger.trigger_uuid === expected.trigger_uuid))) {
        throw new Error('Workers Builds verification failed: trigger settings do not match the declared build_command');
      }
    } catch (error) {
      throw new Error(`Workers Builds apply did not complete; ${updated} update request(s) succeeded. ${error.message}. Fix the error and rerun apply to reconcile remaining changes`);
    }
  }

  return { mode, worker: workerName, triggers, changes: changes.length };
}

if (import.meta.main) {
  try {
    const [mode = 'plan', ...extra] = process.argv.slice(2);
    if (extra.length || !['plan', 'apply'].includes(mode)) throw new Error('Usage: bun scripts/cloudflare/builds.mjs [plan|apply]');
    const configuration = await Bun.file(new URL('../../cloudflare-builds.json', import.meta.url)).json();
    const worker = Bun.JSONC.parse(await Bun.file(new URL('../../wrangler.jsonc', import.meta.url)).text());
    const result = await synchronizeBuildCommands({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
      workerName: worker.name,
      configuration,
      mode,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
