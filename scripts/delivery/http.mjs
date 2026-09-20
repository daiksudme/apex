import { host } from './control.mjs';
export async function verifyHttp(manifest, fetcher = fetch) {
  const options = { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30_000) };
  const response = await fetcher(`${host}/.well-known/apex.json?run=${manifest.run}`, options);
  if (response.status !== 200) throw new Error('HTTP provenance failed');
  const provenance = await response.json();
  if (provenance.sha !== manifest.sha || provenance.run !== manifest.run) throw new Error('HTTP provenance mismatch');
  const home = await fetcher(`${host}/?run=${manifest.run}`, options);
  if (home.status !== 200 || home.headers.get('x-robots-tag') !== 'noindex' || !(await home.text()).includes('daiksud.me')) throw new Error('HTTP home verification failed');
}
