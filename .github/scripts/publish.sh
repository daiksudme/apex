#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
source "$ROOT/.github/scripts/guard.sh"
[[ ${GITHUB_RUN_ATTEMPT:-} == 1 ]] || { echo "Start a new delivery dispatch instead of rerunning an existing run." >&2; exit 1; }
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
worker=$(worker_json)
worker_id=$(jq -er .id <<< "$worker")
case "${OPERATION:-}" in
  deploy)
    run=$(verified_run "${VERIFY_RUN_ID:?}")
    sha=$(jq -er .head_sha <<< "$run")
    [[ $sha == "$GITHUB_SHA" ]]
    gh run download "$VERIFY_RUN_ID" --repo "$REPOSITORY" --name verified-site --dir "$WORK/site"
    bash "$ROOT/.github/scripts/artifact.sh" verify "$WORK/site" "$sha" "$VERIFY_RUN_ID"
    hash=$(jq -er .hash "$WORK/site/manifest.json")
    verification_run=$VERIFY_RUN_ID
    latest_main
    require_open
    WRANGLER_OUTPUT_FILE_PATH="$WORK/wrangler.jsonl" pnpm exec wrangler deploy --assets "$WORK/site/dist"
    version=$(jq -ser 'map(select(.type == "deploy" and .worker_name == "apex")) | last.version_id' "$WORK/wrangler.jsonl")
    ;;
  rollback)
    [[ ${RECEIPT_RUN:-} =~ ^[0-9]+$ && ${VERSION_ID:-} =~ ^[a-f0-9-]{32,36}$ ]]
    gh run download "$RECEIPT_RUN" --repo "$REPOSITORY" --name delivery-receipt --dir "$WORK/receipt"
    receipt="$WORK/receipt/receipt.json"
    jq -e --arg run "$RECEIPT_RUN" --arg version "$VERSION_ID" --arg worker "$worker_id" '.format == 2 and .status == "verified" and .delivery_run == $run and .version == $version and .worker_id == $worker and (.attempt | test("^[1-9][0-9]*$")) and (.sha | test("^[a-f0-9]{40}$")) and (.hash | test("^[a-f0-9]{64}$")) and (.verification_run | test("^[0-9]+$"))' "$receipt" >/dev/null
    attempt=$(jq -r .attempt "$receipt")
    gh api "repos/$REPOSITORY/actions/runs/$RECEIPT_RUN/attempts/$attempt" | jq -e 'select(.path == ".github/workflows/delivery.yml" and .head_branch == "main" and .status == "completed" and .conclusion == "success")' >/dev/null
    sha=$(jq -r .sha "$receipt"); hash=$(jq -r .hash "$receipt"); verification_run=$(jq -r .verification_run "$receipt")
    latest_main
    require_open
    pnpm exec wrangler rollback "$VERSION_ID" --message "Restore verified delivery run $RECEIPT_RUN"
    version=$VERSION_ID
    ;;
  *) echo 'Unknown delivery operation' >&2; exit 1 ;;
esac
active=$(cf workers/scripts/apex/deployments | jq -e --arg version "$version" '.deployments[0] | select((.versions | length) == 1 and .versions[0].percentage == 100 and .versions[0].version_id == $version)')
deployment=$(jq -er .id <<< "$active")
cf workers/scripts/apex/subdomain | jq -e '.enabled == true and .previews_enabled == false' >/dev/null
curl --fail --silent --show-error --max-time 30 "$APEX_HOST/.well-known/apex.json?run=$verification_run" | jq -e --arg sha "$sha" --arg run "$verification_run" '.sha == $sha and .run == $run' >/dev/null
test "$(curl --silent --show-error --max-time 30 -D "$WORK/headers" -o "$WORK/home" -w '%{http_code}' "$APEX_HOST/?run=$verification_run")" = 200
tr -d '\r' < "$WORK/headers" | grep -qi '^x-robots-tag: *noindex$'
grep -q 'daiksud.me' "$WORK/home"
mkdir -p .delivery
jq -n --arg sha "$sha" --arg hash "$hash" --arg verification_run "$verification_run" --arg version "$version" --arg deployment "$deployment" --arg worker_id "$worker_id" --arg delivery_run "$GITHUB_RUN_ID" --arg attempt "$GITHUB_RUN_ATTEMPT" --arg operation "$OPERATION" '{format:2,status:"verified",sha:$sha,hash:$hash,verification_run:$verification_run,version:$version,deployment:$deployment,worker_id:$worker_id,delivery_run:$delivery_run,attempt:$attempt,operation:$operation}' > .delivery/receipt.json
echo 'Deployment and HTTP verified; receipt saved.'
