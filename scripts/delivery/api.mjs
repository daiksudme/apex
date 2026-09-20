import { account, repository } from './control.mjs';
export function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
async function request(url, token, { method = 'GET', body, missing = false } = {}) {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' }, body: body && JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (response.status === 404 && missing) return null;
  if (!response.ok) throw new Error(`API request failed (${response.status})`);
  return response.status === 204 ? null : response.json();
}
export const github = (path, options, token = required('GH_TOKEN')) => request(`https://api.github.com/repos/${repository}/${path}`, token, options);
export async function cloudflare(path, options) {
  const response = await request(`https://api.cloudflare.com/client/v4/accounts/${account}/${path}`, required('CLOUDFLARE_API_TOKEN'), options);
  if (response === null && options?.missing) return null;
  if (!response?.success) throw new Error('Cloudflare request failed');
  return response.result;
}
export async function currentControl({ missing = false } = {}) {
  const variable = await github('actions/variables/APEX_DELIVERY_CONTROL', { missing }, required('CONTROL_READ_TOKEN'));
  if (!variable && missing) return null;
  try { return JSON.parse(variable.value); } catch { throw new Error('Invalid delivery control'); }
}
export const latestMain = async () => (await github('git/ref/heads/main')).object.sha;
