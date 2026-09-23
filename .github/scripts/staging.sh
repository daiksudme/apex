#!/usr/bin/env bash
set -euo pipefail

REPOSITORY=daiksudme/apex

bind_verify_run() {
  [[ ${GITHUB_REPOSITORY:-} == "$REPOSITORY" ]]

  local run pr merge current pr_json
  run=$(jq -e --arg repo "$REPOSITORY" '
    .workflow_run
    | select(
        .repository.full_name == $repo and
        .head_repository.full_name == $repo and
        .event == "pull_request" and
        .path == ".github/workflows/verify.yml" and
        .status == "completed" and
        .conclusion == "success" and
        (.head_sha | test("^[a-f0-9]{40}$"))
      )
    | {
        verify_run: (.id | tostring),
        sha: .head_sha,
        pr: (.pull_requests | select(type == "array" and length == 1) | .[0].number | tostring)
      }
  ' "${GITHUB_EVENT_PATH:?}") || return 1

  pr=$(jq -er '.pr | select(test("^[1-9][0-9]*$"))' <<<"$run") || return 1
  current=$(gh api "repos/$REPOSITORY/git/ref/heads/main" | jq -er '.object.sha | select(test("^[a-f0-9]{40}$"))') || return 1
  pr_json=$(gh api "repos/$REPOSITORY/pulls/$pr") || return 1
  jq -e \
    --arg repo "$REPOSITORY" \
    --arg base "$current" \
    --arg sha "$(jq -er .sha <<<"$run")" \
    'select(
      .state == "open" and
      .mergeable == true and
      .base.ref == "main" and
      .base.sha == $base and
      .base.repo.full_name == $repo and
      .head.sha == $sha and
      .head.repo.full_name == $repo
    )' <<<"$pr_json" >/dev/null || return 1

  merge=$(gh api "repos/$REPOSITORY/git/ref/pull/$pr/merge" | jq -er '.object.sha | select(test("^[a-f0-9]{40}$"))') || return 1
  jq -n \
    --arg pr "$pr" \
    --arg verify_run "$(jq -r .verify_run <<<"$run")" \
    --arg sha "$(jq -r .sha <<<"$run")" \
    --arg base "$current" \
    --arg merge "$merge" \
    '{pr:$pr,verify_run:$verify_run,sha:$sha,base:$base,merge:$merge}'
}

case "${1:-}" in
  bind) bind_verify_run ;;
  *) echo 'Usage: staging.sh bind' >&2; exit 1 ;;
esac
