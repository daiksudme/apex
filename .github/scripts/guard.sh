#!/usr/bin/env bash
# Shared checks for the three credentialed Actions operations; no Terraform execution.
set -euo pipefail
REPOSITORY=daiksudme/apex
ACCOUNT=a1f28decfde7c9df1884714e574d2059
export APEX_HOST=https://apex.daiksud-a1f.workers.dev
latest_main() {
  [[ ${GITHUB_REPOSITORY:-} == "$REPOSITORY" && ${GITHUB_REF:-} == refs/heads/main ]] || return 1
  [[ ${GITHUB_SHA:-} =~ ^[a-f0-9]{40}$ ]] || return 1
  local latest
  latest=$(gh api "repos/$REPOSITORY/git/ref/heads/main" --jq .object.sha) || return 1
  [[ $GITHUB_SHA == "$latest" ]]
}
control_json() {
  GH_TOKEN="${CONTROL_READ_TOKEN:?}" gh api "repos/$REPOSITORY/actions/variables/APEX_DELIVERY_CONTROL" --jq .value | jq -e 'select(type == "object")' 2>/dev/null
}
require_open() {
  local control
  control=$(control_json) || return 1
  jq -e '.state == "open" and (.release_id | type == "string" and length > 0)' <<< "$control" >/dev/null
}
cf() {
  curl --fail --silent --show-error --max-time 30 --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN:?}" "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/$1" | jq -e 'if .success == true then .result else error("Cloudflare request failed") end'
}
worker_json() {
  local id
  id=$(GH_TOKEN="${CONTROL_READ_TOKEN:?}" gh api "repos/$REPOSITORY/actions/variables/APEX_WORKER_ID" --jq .value) || return 1
  [[ $id =~ ^[a-f0-9-]{32,36}$ ]] || return 1
  cf "workers/workers/$id" | jq -e --arg id "$id" 'select(.id == $id and .name == "apex")'
}
verified_run() {
  [[ $1 =~ ^[0-9]+$ ]] || return 1
  gh api "repos/$REPOSITORY/actions/runs/$1" | jq -e --arg repo "$REPOSITORY" 'select(.repository.full_name == $repo and .path == ".github/workflows/verify.yml" and .head_branch == "main" and .event == "push" and .status == "completed" and .conclusion == "success" and (.head_sha | test("^[a-f0-9]{40}$")))'
}
require_bootstrap() {
  local code control workers
  code=$(curl --silent --show-error --max-time 30 --header "Authorization: Bearer ${CONTROL_READ_TOKEN:?}" -o "$PRIVATE_DIR/control.json" -w '%{http_code}' "https://api.github.com/repos/$REPOSITORY/actions/variables/APEX_DELIVERY_CONTROL") || return 1
  case "$code" in
    404) ;;
    200) control=$(jq -er '.value | fromjson' "$PRIVATE_DIR/control.json") || return 1
         jq -e '.state == "frozen" and .release_id == "bootstrap"' <<< "$control" >/dev/null || return 1 ;;
    *) return 1 ;;
  esac
  workers=$(cf 'workers/workers?per_page=1000') || return 1
  jq -e 'type == "array" and length < 1000 and ([.[] | select(.name == "apex")] | length <= 1 and all(.[]; has("deployed_on") and .deployed_on == null and (.references.domains | type == "array" and length == 0)))' <<< "$workers" >/dev/null
}
