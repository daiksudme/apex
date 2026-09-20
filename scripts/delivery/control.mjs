export const repository = 'daiksudme/apex';
export const account = 'a1f28decfde7c9df1884714e574d2059';
export const host = 'https://apex.daiksud-a1f.workers.dev';
export function assertDelivery(control, target, latest) {
  if (control?.state !== 'open' || typeof control.release_id !== 'string' || !control.release_id.trim()) throw new Error('Delivery control is not open');
  if (!/^[a-f0-9]{40}$/.test(target) || target !== latest) throw new Error('Stale or invalid SHA');
}
export function assertVerifiedRun(run) {
  if (run.repository?.full_name !== repository || run.path !== '.github/workflows/verify.yml' || run.head_branch !== 'main' || run.event !== 'push' || run.conclusion !== 'success' || run.status !== 'completed' || !/^[a-f0-9]{40}$/.test(run.head_sha)) throw new Error('Untrusted verification run');
}
export async function changeWhenOpen(readControl, readMain, sha, change) {
  assertDelivery(await readControl(), sha, await readMain());
  return change();
}
export function restoreTarget(previous, active) {
  if (!previous) throw new Error('No verified artifact to restore');
  const target = active.version === previous.version && active.deployment && active.deployment === previous.deployment ? previous.previous : previous;
  if (!target?.verification_run) throw new Error('No previous verified artifact');
  return target;
}
export function newestReceiptArtifact(artifacts) {
  return artifacts.filter((item) => item.name === 'delivery-receipt' && !item.expired).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id)[0];
}
export function assertInitialWorker(worker) {
  if (worker?.deployed_on !== null || !Array.isArray(worker.references?.domains) || worker.references.domains.length) throw new Error('Initial Worker state is unknown, deployed or connected');
}
export function initialControlNeedsWrite(control) {
  if (control?.release_id !== 'bootstrap' || !['frozen', 'open'].includes(control.state)) throw new Error('Only initial bootstrap control can be released');
  return control.state === 'frozen';
}
