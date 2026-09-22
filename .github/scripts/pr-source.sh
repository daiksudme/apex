#!/usr/bin/env bash
# Resolve verification and the current PR using GitHub metadata, not artifact claims.
set -euo pipefail
[[ $GITHUB_REPOSITORY == daiksudme/apex && $GITHUB_REF == refs/heads/main && ${VERIFY_RUN_ID:?} =~ ^[0-9]+$ ]]
run=$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$VERIFY_RUN_ID")
jq -e --arg repo "$GITHUB_REPOSITORY" 'select(.repository.full_name == $repo and .path == ".github/workflows/verify.yml" and .event == "pull_request" and .status == "completed" and .conclusion == "success")' <<< "$run" >/dev/null
head=$(jq -er '.head_sha | select(test("^[a-f0-9]{40}$"))' <<< "$run")
prs=$(gh api "repos/$GITHUB_REPOSITORY/commits/$head/pulls")
pr=$(jq -ce --arg head "$head" --arg repo "$GITHUB_REPOSITORY" '[.[] | select(.state == "open" and .head.sha == $head and .base.ref == "main" and .base.repo.full_name == $repo)] | select(length == 1) | .[0]' <<< "$prs")
number=$(jq -er .number <<< "$pr")
[[ $number =~ ^[1-9][0-9]*$ ]]
pr=$(gh api "repos/$GITHUB_REPOSITORY/pulls/$number")
main=$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main" --jq .object.sha)
[[ $GITHUB_SHA == "$main" ]]
jq -ce --arg head "$head" --arg main "$main" 'select(.state == "open" and .base.ref == "main" and .head.sha == $head and .base.sha == $main and .mergeable == true and (.merge_commit_sha | test("^[a-f0-9]{40}$"))) | {number, head: .head.sha, base: .base.sha, build: .merge_commit_sha}' <<< "$pr"
