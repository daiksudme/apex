import { github } from './api.mjs';
const path = 'environments/apex-operations';
const existing = await github(path, { missing: true });
if (existing) throw new Error('Environment already exists; inspect its protections instead of overwriting');
await github(path, { method: 'PUT', body: { can_admins_bypass: false, prevent_self_review: false, reviewers: [{ type: 'User', id: 155234749 }], deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } } });
await github(`${path}/deployment-branch-policies`, { method: 'POST', body: { name: 'main', type: 'branch' } });
console.log('Prepared main-only apex-operations with required approval. Register its scoped credentials before bootstrap.');
