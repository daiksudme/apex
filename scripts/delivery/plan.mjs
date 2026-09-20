import { account } from './control.mjs';
export function assertPlan(plan, bootstrap) {
  const allowed = ['cloudflare_worker.apex', 'github_actions_variable.control', 'github_actions_variable.worker', 'github_repository_environment.protected', 'github_repository_environment.delivery', 'github_repository_environment_deployment_policy.protected', 'github_repository_environment_deployment_policy.delivery'];
  if (!Array.isArray(plan.resource_changes)) throw new Error('Invalid plan');
  for (const { address, change } of plan.resource_changes) {
    if (!allowed.includes(address) || !change.actions.every((action) => ['no-op', 'create', 'update'].includes(action))) throw new Error('Destructive or unrelated plan');
    if (address === 'cloudflare_worker.apex' && (change.after?.name !== 'apex' || change.after?.account_id !== account || (!bootstrap && change.actions.includes('create')))) throw new Error('Worker identity plan rejected');
    if (address === 'github_actions_variable.control' && !(change.actions.length === 1 && change.actions[0] === (bootstrap ? 'create' : 'no-op'))) throw new Error('Control mutation plan rejected');
    if (address === 'github_repository_environment.protected') {
      const env = change.after;
      if (env?.can_admins_bypass !== false || !env.reviewers?.some((rule) => rule.users?.includes(155234749))) throw new Error('Approval protection plan rejected');
    }
  }
}
