import { cloudflare, github, required } from './api.mjs';
export async function worker() {
  const variable = await github('actions/variables/APEX_WORKER_ID', undefined, required('CONTROL_READ_TOKEN'));
  if (!/^[a-f0-9-]{32,36}$/.test(variable.value)) throw new Error('Invalid Worker ID');
  const result = await cloudflare(`workers/workers/${variable.value}`);
  if (result.id !== variable.value || result.name !== 'apex') throw new Error('Worker identity mismatch');
  return result;
}
export async function deployment() {
  const result = await cloudflare('workers/scripts/apex/deployments');
  const current = result.deployments?.[0];
  if (!current?.id || current.versions?.length !== 1 || current.versions[0].percentage !== 100) throw new Error('Expected a single full deployment');
  return { deployment: current.id, version: current.versions[0].version_id };
}
