mock_provider "cloudflare" {}
mock_provider "github" {}
run "ownership" {
  command = plan
  assert {
    condition     = cloudflare_worker.apex.name == "apex"
    error_message = "Only the apex Worker is owned here."
  }
  assert {
    condition     = jsondecode(github_actions_variable.control.value).state == "frozen"
    error_message = "Initial delivery must remain frozen."
  }
  assert {
    condition     = github_repository_environment.protected.can_admins_bypass == false
    error_message = "Bootstrap approval cannot be bypassed."
  }
}
