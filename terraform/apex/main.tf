terraform {
  required_version = "= 1.16.3"
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare", version = "= 5.25.0" }
    github     = { source = "integrations/github", version = "= 6.13.0" }
  }
  backend "s3" {
    bucket                      = "daiksudme-tfstate-apex"
    key                         = "terraform.tfstate"
    region                      = "auto"
    endpoints                   = { s3 = "https://a1f28decfde7c9df1884714e574d2059.r2.cloudflarestorage.com" }
    use_path_style              = true
    use_lockfile                = true
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
  }
}
provider "github" { owner = "daiksudme" }

resource "cloudflare_worker" "apex" {
  account_id = "a1f28decfde7c9df1884714e574d2059"
  name       = "apex"
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [subdomain, observability, logpush, tags, tail_consumers]
  }
}
resource "github_actions_variable" "control" {
  repository    = "apex"
  variable_name = "APEX_DELIVERY_CONTROL"
  value         = jsonencode({ state = "frozen", release_id = "bootstrap" })
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [value]
  }
}
resource "github_actions_variable" "worker" {
  repository    = "apex"
  variable_name = "APEX_WORKER_ID"
  value         = cloudflare_worker.apex.id
}
resource "github_repository_environment" "protected" {
  repository          = "apex"
  environment         = "apex-operations"
  can_admins_bypass   = false
  prevent_self_review = false
  reviewers { users = [155234749] }
  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
  lifecycle { prevent_destroy = true }
}
resource "github_repository_environment_deployment_policy" "protected" {
  repository     = "apex"
  environment    = github_repository_environment.protected.environment
  branch_pattern = "main"
}
resource "github_repository_environment" "delivery" {
  repository        = "apex"
  environment       = "apex-delivery"
  can_admins_bypass = false
  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
  lifecycle { prevent_destroy = true }
}
resource "github_repository_environment_deployment_policy" "delivery" {
  repository     = "apex"
  environment    = github_repository_environment.delivery.environment
  branch_pattern = "main"
}

variable "protected_policy_id" {
  type    = string
  default = ""
}
import {
  for_each = var.protected_policy_id == "" ? {} : { initial = var.protected_policy_id }
  to       = github_repository_environment.protected
  id       = "apex:apex-operations"
}
import {
  for_each = var.protected_policy_id == "" ? {} : { initial = var.protected_policy_id }
  to       = github_repository_environment_deployment_policy.protected
  id       = "apex:apex-operations:${each.value}"
}
