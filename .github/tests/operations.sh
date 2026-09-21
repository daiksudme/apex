#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
source "$ROOT/.github/scripts/guard.sh"
export GITHUB_REPOSITORY=daiksudme/apex GITHUB_REF=refs/heads/main GITHUB_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
export CONTROL_READ_TOKEN=fixture GH_TOKEN=fixture CLOUDFLARE_API_TOKEN=fixture
export GITHUB_RUN_ID=123 GITHUB_RUN_ATTEMPT=1
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
export FIXTURE_DIR="$TMP/site" COMMAND_LOG="$TMP/commands"
mkdir -p "$TMP/bin" "$FIXTURE_DIR/dist" "$TMP/run"
echo 'sample' > "$FIXTURE_DIR/dist/index.html"
(cd "$FIXTURE_DIR"; bash "$ROOT/.github/scripts/artifact.sh" pack)
cp -R "$FIXTURE_DIR" "$TMP/valid"; rm -r "$TMP/valid/dist"
bash "$ROOT/.github/scripts/artifact.sh" verify "$TMP/valid" "$GITHUB_SHA" 123
cat > "$TMP/bin/gh" <<'MOCK'
#!/usr/bin/env bash
case "$*" in
  *git/ref/heads/main*) echo "${MOCK_MAIN:-$GITHUB_SHA}" ;;
  *APEX_WORKER_ID*) echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ;;
  *APEX_DELIVERY_CONTROL*)
    if [[ "$*" == *'--method PATCH'* ]]; then jq -r .value > "$CONTROL_FILE"; exit 0; fi
    if [[ -n ${CONTROL_FILE:-} && -f $CONTROL_FILE ]]; then cat "$CONTROL_FILE"; exit 0; fi
    [[ ${CONTROL_MODE:-open} != error ]] || exit 1
    printf '{"state":"%s","release_id":"bootstrap"}\n' "${CONTROL_MODE:-open}" ;;
  *actions/runs/999/attempts/1*) echo '{"path":".github/workflows/delivery.yml","head_branch":"main","status":"completed","conclusion":"success"}' ;;
  *actions/runs/123*) printf '{"repository":{"full_name":"daiksudme/apex"},"head_sha":"%s","head_branch":"main","event":"push","status":"completed","conclusion":"success","path":".github/workflows/verify.yml"}\n' "$GITHUB_SHA" ;;
  'run download'*) target=${!#}; mkdir -p "$target"; cp "$FIXTURE_DIR/site.tar" "$FIXTURE_DIR/manifest.json" "$target"; if [[ -n ${RECEIPT_FILE:-} ]]; then cp "$RECEIPT_FILE" "$target/receipt.json"; else echo '{"format":1}' > "$target/receipt.json"; fi ;;
  *) exit 1 ;;
esac
MOCK
cat > "$TMP/bin/curl" <<'MOCK'
#!/usr/bin/env bash
url=${!#}
case "$url" in
  */workers/workers/*) echo '{"success":true,"result":{"id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","name":"apex","deployed_on":null,"references":{"domains":[]}}}' ;;
  */deployments) echo '{"success":true,"result":{"deployments":[{"id":"deployment","versions":[{"version_id":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","percentage":100}]}]}}' ;;
  */subdomain) echo '{"success":true,"result":{"enabled":true,"previews_enabled":false}}' ;;
  */.well-known/*) printf '{"sha":"%s","run":"123"}\n' "${HTTP_SHA:-$GITHUB_SHA}" ;;
  *)
    while [[ $# -gt 0 ]]; do
      case "$1" in -D) printf 'X-Robots-Tag: noindex\r\n' > "$2"; shift ;; -o) echo 'daiksud.me' > "$2"; shift ;; esac
      shift
    done
    printf 200 ;;
esac
MOCK
cat > "$TMP/bin/pnpm" <<'MOCK'
#!/usr/bin/env bash
echo "$*" >> "$COMMAND_LOG"
[[ ${COMMAND_FAIL:-false} == false ]] || exit 17
[[ "$*" != *rollback* ]] || exit 0
printf '{"type":"deploy","worker_name":"apex","version_id":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}\n' > "$WRANGLER_OUTPUT_FILE_PATH"
MOCK
chmod +x "$TMP/bin/gh" "$TMP/bin/curl" "$TMP/bin/pnpm"
export PATH="$TMP/bin:$PATH" OPERATION=deploy VERIFY_RUN_ID=123
reject_without_publish() {
  rm -f "$COMMAND_LOG"
  if (cd "$TMP/run"; bash "$ROOT/.github/scripts/publish.sh" >/dev/null 2>&1); then echo 'Invalid operation succeeded' >&2; exit 1; fi
  test ! -e "$COMMAND_LOG"
}
export MOCK_MAIN=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
reject_without_publish
unset MOCK_MAIN
export GITHUB_RUN_ATTEMPT=2; reject_without_publish
export GITHUB_RUN_ATTEMPT=1
export CONTROL_MODE=error; reject_without_publish
export CONTROL_MODE=frozen; reject_without_publish
export CONTROL_MODE=open
cp "$FIXTURE_DIR/site.tar" "$TMP/original.tar"; printf changed >> "$FIXTURE_DIR/site.tar"
reject_without_publish
cp "$TMP/original.tar" "$FIXTURE_DIR/site.tar"
export OPERATION=rollback RECEIPT_RUN=999 VERSION_ID=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
reject_without_publish
export OPERATION=deploy COMMAND_FAIL=true
if (cd "$TMP/run"; bash "$ROOT/.github/scripts/publish.sh" >/dev/null 2>&1); then exit 1; fi
test -e "$COMMAND_LOG" && test ! -e "$TMP/run/.delivery/receipt.json"
export COMMAND_FAIL=false HTTP_SHA=incorrect
if (cd "$TMP/run"; bash "$ROOT/.github/scripts/publish.sh" >/dev/null 2>&1); then exit 1; fi
test ! -e "$TMP/run/.delivery/receipt.json"
unset HTTP_SHA
(cd "$TMP/run"; bash "$ROOT/.github/scripts/publish.sh")
jq -e '.format == 2 and .status == "verified" and .version == "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"' "$TMP/run/.delivery/receipt.json" >/dev/null
echo 'Operational checks passed.'

export CONTROL_WRITE_TOKEN=fixture CONTROL_FILE="$TMP/control.json" CONTROL_MODE=frozen
(cd "$TMP/run"; bash "$ROOT/.github/scripts/thaw.sh")
cp "$CONTROL_FILE" "$TMP/control-before"
(cd "$TMP/run"; bash "$ROOT/.github/scripts/thaw.sh")
cmp "$CONTROL_FILE" "$TMP/control-before"
echo 'Initial thaw and retry passed.'

export RECEIPT_FILE="$TMP/verified-receipt.json"
jq '.delivery_run="999"' "$TMP/run/.delivery/receipt.json" > "$RECEIPT_FILE"
export OPERATION=rollback GITHUB_RUN_ID=456
rm -f "$COMMAND_LOG"
(cd "$TMP/run"; bash "$ROOT/.github/scripts/publish.sh")
grep -q "wrangler rollback $VERSION_ID" "$COMMAND_LOG"
jq -e '.operation == "rollback" and .delivery_run == "456"' "$TMP/run/.delivery/receipt.json" >/dev/null
echo 'Native rollback selection passed.'
