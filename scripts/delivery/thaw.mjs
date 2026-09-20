import { currentControl, latestMain, github, required } from './api.mjs';
import { worker } from './worker.mjs';
import { candidate } from './download.mjs';
try {
  if (process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Expected main');
  const manifest = await candidate(required('VERIFY_RUN_ID'));
  const current = await worker();
  if (current.deployed_on || current.references?.domains?.length) throw new Error('Initial thaw refuses deployed/connected Worker');
  const control = await currentControl();
  if (control?.state !== 'frozen' || control.release_id !== 'bootstrap') throw new Error('Only initial bootstrap freeze can be released');
  if (manifest.sha !== required('GITHUB_SHA') || manifest.sha !== await latestMain()) throw new Error('Stale bootstrap SHA');
  const value = JSON.stringify({ state: 'open', release_id: 'bootstrap' });
  await github('actions/variables/APEX_DELIVERY_CONTROL', { method: 'PATCH', body: { name: 'APEX_DELIVERY_CONTROL', value } }, required('CONTROL_WRITE_TOKEN'));
  const after = await currentControl();
  if (after.state !== 'open' || after.release_id !== 'bootstrap') throw new Error('Thaw readback failed');
  console.log('Initial freeze released. Dispatch Delivery for this verified run, then verify Terraform coexistence.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
