#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

export GITHUB_REPOSITORY=daiksudme/apex
export GITHUB_EVENT_PATH="$WORK/event.json"
export GH_TOKEN=fixture
export COMMAND_LOG="$WORK/commands"

cat >"$WORK/gh" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  *git/ref/heads/main*) printf '{"object":{"sha":"%s"}}\n' "${MAIN_SHA:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}" ;;
  *git/ref/pull/7/merge*) printf '{"object":{"sha":"%s"}}\n' "${MERGE_SHA:-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb}" ;;
  *pulls/7*) cat "$PR_FILE" ;;
  *'run download'*) touch "$COMMAND_LOG" ;;
  *) exit 1 ;;
esac
MOCK
chmod +x "$WORK/gh"
export PATH="$WORK:$PATH" PR_FILE="$WORK/pr.json"

valid() {
  cat >"$GITHUB_EVENT_PATH" <<'JSON'
{"workflow_run":{"id":123,"repository":{"full_name":"daiksudme/apex"},"head_repository":{"full_name":"daiksudme/apex"},"event":"pull_request","path":".github/workflows/verify.yml","status":"completed","conclusion":"success","head_sha":"cccccccccccccccccccccccccccccccccccccccc","pull_requests":[{"number":7}]}}
JSON
  cat >"$PR_FILE" <<'JSON'
{"state":"open","mergeable":true,"base":{"ref":"main","sha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","repo":{"full_name":"daiksudme/apex"}},"head":{"sha":"cccccccccccccccccccccccccccccccccccccccc","repo":{"full_name":"daiksudme/apex"}}}
JSON
  rm -f "$COMMAND_LOG"
}

reject_before_download() {
  if bash "$ROOT/.github/scripts/staging.sh" bind >/dev/null; then
    echo 'Unexpected staging binding success' >&2
    exit 1
  fi
  test ! -e "$COMMAND_LOG"
}

valid
binding=$(bash "$ROOT/.github/scripts/staging.sh" bind)
jq -e '
  .pr == "7" and
  .verify_run == "123" and
  .sha == "cccccccccccccccccccccccccccccccccccccccc" and
  .base == "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" and
  .merge == "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
' <<<"$binding" >/dev/null

for change in \
  '.workflow_run.repository.full_name = "contributor/apex"' \
  '.workflow_run.event = "push"' \
  '.workflow_run.path = ".github/workflows/other.yml"' \
  '.workflow_run.status = "in_progress"' \
  '.workflow_run.conclusion = "failure"' \
  '.workflow_run.head_sha = "invalid"' \
  '.workflow_run.pull_requests = [{"number":7},{"number":8}]' \
  '.workflow_run.head_repository.full_name = "contributor/apex"'; do
  valid
  jq "$change" "$GITHUB_EVENT_PATH" >"$WORK/next"
  mv "$WORK/next" "$GITHUB_EVENT_PATH"
  reject_before_download
done

for change in \
  '.state = "closed"' \
  '.mergeable = false' \
  '.base.ref = "release"' \
  '.base.sha = "old"' \
  '.base.repo.full_name = "contributor/apex"' \
  '.head.sha = "old"' \
  '.head.repo.full_name = "contributor/apex"'; do
  valid
  jq "$change" "$PR_FILE" >"$WORK/next"
  mv "$WORK/next" "$PR_FILE"
  reject_before_download
done

valid
if MAIN_SHA=old bash "$ROOT/.github/scripts/staging.sh" bind >/dev/null; then
  echo 'Stale main base was accepted' >&2
  exit 1
fi

valid
if MERGE_SHA=old bash "$ROOT/.github/scripts/staging.sh" bind >/dev/null; then
  echo 'Invalid merge reference was accepted' >&2
  exit 1
fi

echo 'Staging binding checks passed.'
