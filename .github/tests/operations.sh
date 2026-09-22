#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
export GITHUB_REPOSITORY=daiksudme/apex GITHUB_REF=refs/heads/main
export GITHUB_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
export CLOUDFLARE_API_TOKEN=fixture GITHUB_RUN_ID=123 GITHUB_RUN_ATTEMPT=1

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
export FIXTURE_DIR="$TMP/site" COMMAND_LOG="$TMP/commands"
mkdir -p "$TMP/bin" "$FIXTURE_DIR/dist" "$TMP/run"
printf 'sample' >"$FIXTURE_DIR/dist/index.html"
(cd "$FIXTURE_DIR"; bash "$ROOT/.github/scripts/artifact.sh" pack)

cat >"$TMP/bin/gh" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  *git/ref/heads/main*) echo "${MOCK_MAIN:-$GITHUB_SHA}" ;;
  *actions/runs/123*) printf '{"repository":{"full_name":"daiksudme/apex"},"head_sha":"%s","head_branch":"main","event":"push","status":"completed","conclusion":"success","path":".github/workflows/verify.yml"}\n' "$GITHUB_SHA" ;;
  *actions/runs/999/attempts/1*)
    jq -n --arg path "${RECEIPT_WORKFLOW:-.github/workflows/delivery.yml}" \
      '{path:$path,head_branch:"main",status:"completed",conclusion:"success"}'
    ;;
  'run download'*)
    target=${!#}
    mkdir -p "$target"
    if [[ -n ${RECEIPT_FILE:-} ]]; then
      cp "$RECEIPT_FILE" "$target/receipt.json"
    else
      cp "$FIXTURE_DIR/site.tar" "$FIXTURE_DIR/manifest.json" "$target"
    fi
    ;;
  *) exit 1 ;;
esac
MOCK

cat >"$TMP/bin/curl" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
url=${!#}
case "$url" in
  *workers/workers\?per_page=1000)
    case "${WORKER_MODE:-one}" in
      absent) result='[]' ;;
      one) result='[{"name":"apex"}]' ;;
      many) result='[{"name":"apex"},{"name":"apex"}]' ;;
    esac
    jq -n --argjson result "$result" '{success:true,result:$result}'
    ;;
  */workers/scripts/apex/deployments)
    echo '{"success":true,"result":{"deployments":[{"id":"deployment","versions":[{"version_id":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","percentage":100}]}]}}'
    ;;
  */workers/scripts/apex/subdomain)
    echo '{"success":true,"result":{"enabled":true,"previews_enabled":false}}'
    ;;
  */.well-known/*)
    printf '{"sha":"%s","run":"123"}\n' "${HTTP_SHA:-$GITHUB_SHA}"
    ;;
  *)
    while [[ $# -gt 0 ]]; do
      case "$1" in
        -D) printf 'X-Robots-Tag: noindex\r\n' >"$2"; shift ;;
        -o) printf 'daiksud.me' >"$2"; shift ;;
      esac
      shift
    done
    printf 200
    ;;
esac
MOCK

cat >"$TMP/bin/pnpm" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
echo "$*" >>"$COMMAND_LOG"
[[ ${COMMAND_FAIL:-false} == false ]] || exit 17
if [[ "$*" == *'wrangler deploy'* ]]; then
  printf '{"type":"deploy","worker_name":"apex","version_id":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}\n' >"$WRANGLER_OUTPUT_FILE_PATH"
fi
MOCK
chmod +x "$TMP/bin/gh" "$TMP/bin/curl" "$TMP/bin/pnpm"

export PATH="$TMP/bin:$PATH" VERIFY_RUN_ID=123 OPERATION=deploy WORKER_MODE=one
run_publish() {
  (cd "$TMP/run"; bash "$ROOT/.github/scripts/publish.sh")
}

run_publish
jq -e '.format == 2 and .worker == "apex" and .operation == "deploy"' "$TMP/run/.delivery/receipt.json" >/dev/null

reject_without_wrangler() {
  rm -f "$COMMAND_LOG" "$TMP/run/.delivery/receipt.json"
  if run_publish >/dev/null 2>&1; then
    echo 'Unexpected delivery success' >&2
    exit 1
  fi
  test ! -e "$COMMAND_LOG"
}

WORKER_MODE=absent reject_without_wrangler
WORKER_MODE=many reject_without_wrangler
WORKER_MODE=one
cp "$FIXTURE_DIR/site.tar" "$TMP/original.tar"
printf changed >>"$FIXTURE_DIR/site.tar"
reject_without_wrangler
cp "$TMP/original.tar" "$FIXTURE_DIR/site.tar"

export OPERATION=bootstrap WORKER_MODE=absent
rm -f "$COMMAND_LOG" "$TMP/run/.delivery/receipt.json"
run_publish
jq -e '.operation == "bootstrap" and .worker == "apex"' "$TMP/run/.delivery/receipt.json" >/dev/null
cp "$TMP/run/.delivery/receipt.json" "$TMP/bootstrap-receipt.json"
export WORKER_MODE=one
reject_without_wrangler

export OPERATION=rollback RECEIPT_RUN=999 VERSION_ID=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
export RECEIPT_FILE="$TMP/receipt.json"
jq '.delivery_run = "999"' "$TMP/bootstrap-receipt.json" >"$RECEIPT_FILE"
export RECEIPT_WORKFLOW=.github/workflows/delivery.yml
reject_without_wrangler

export RECEIPT_WORKFLOW=.github/workflows/bootstrap.yml
rm -f "$COMMAND_LOG"
run_publish
grep -q 'wrangler rollback bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' "$COMMAND_LOG"

export RECEIPT_WORKFLOW=.github/workflows/verify.yml
reject_without_wrangler

echo 'Terraform-free bootstrap, delivery, and rollback checks passed.'
