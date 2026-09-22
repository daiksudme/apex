resource "cloudflare_worker" "staging" {
  account_id = "a1f28decfde7c9df1884714e574d2059"
  name       = "apex-staging"
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [subdomain, observability, logpush, tags, tail_consumers]
  }
}
resource "github_actions_variable" "staging_worker" {
  repository    = "apex"
  variable_name = "APEX_STAGING_WORKER_ID"
  value         = cloudflare_worker.staging.id
}
resource "github_repository_environment" "staging" {
  repository       = "apex"
  environment      = "apex-staging"
  can_admins_bypass = false
  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
  lifecycle { prevent_destroy = true }
}
resource "github_repository_environment_deployment_policy" "staging" {
  repository     = "apex"
  environment    = github_repository_environment.staging.environment
  branch_pattern = "main"
}
