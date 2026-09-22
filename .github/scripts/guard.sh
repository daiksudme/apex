#!/usr/bin/env bash
# Shared checks for Wrangler operations. No Terraform, state, or GitHub variables.
set -euo pipefail

REPOSITORY=daiksudme/apex
ACCOUNT=a1f28decfde7c9df1884714e574d2059
WORKER=apex
export APEX_HOST=https://apex.daiksud-a1f.workers.dev

latest_main() {
  [[ ${GITHUB_REPOSITORY:-} == "$REPOSITORY" && ${GITHUB_REF:-} == refs/heads/main ]] || return 1
  [[ ${GITHUB_SHA:-} =~ ^[a-f0-9]{40}$ ]] || return 1
  local latest
  latest=$(gh api "repos/$REPOSITORY/git/ref/heads/main" --jq .object.sha) || return 1
  [[ $GITHUB_SHA == "$latest" ]]
}

cf() {
  curl --fail --silent --show-error --max-time 30 \
    --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN:?}" \
    "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/$1" |
    jq -e 'if .success == true then .result else error("Cloudflare request failed") end'
}

worker_json() {
  cf 'workers/workers?per_page=1000' |
    jq -e --arg name "$WORKER" \
      '[.[] | select(.name == $name)] | select(length == 1) | .[0]'
}

require_absent_worker() {
  cf 'workers/workers?per_page=1000' |
    jq -e --arg name "$WORKER" \
      'type == "array" and length < 1000 and ([.[] | select(.name == $name)] | length == 0)' \
      >/dev/null
}

verified_run() {
  [[ $1 =~ ^[0-9]+$ ]] || return 1
  gh api "repos/$REPOSITORY/actions/runs/$1" |
    jq -e --arg repo "$REPOSITORY" \
      'select(.repository.full_name == $repo and .path == ".github/workflows/verify.yml" and .head_branch == "main" and .event == "push" and .status == "completed" and .conclusion == "success" and (.head_sha | test("^[a-f0-9]{40}$")))'
}
