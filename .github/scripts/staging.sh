#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
source_info=$(bash "$ROOT/.github/scripts/pr-source.sh")
number=$(jq -r .number <<< "$source_info")
build=$(jq -r .build <<< "$source_info")
[[ ${APEX_STAGING_WORKER_ID:?} =~ ^[a-f0-9-]{32,36}$ ]]
source "$ROOT/.github/scripts/guard.sh"
cf "workers/workers/$APEX_STAGING_WORKER_ID" | jq -e --arg id "$APEX_STAGING_WORKER_ID" 'select(.id == $id and .name == "apex-staging" and (.references.domains | type == "array" and length == 0))' >/dev/null
gh run download "$VERIFY_RUN_ID" --repo "$REPOSITORY" --name verified-site --dir "$WORK/site"
bash "$ROOT/.github/scripts/artifact.sh" verify "$WORK/site" "$build" "$VERIFY_RUN_ID"
[[ $source_info == "$(bash "$ROOT/.github/scripts/pr-source.sh")" ]]
# The staging header policy is environment configuration, owned by main.
cp "$ROOT/.github/staging-headers" "$WORK/site/dist/_headers"
# Only trusted configuration and static files reach Wrangler; no PR code runs here.
pnpm exec wrangler triggers deploy --config "$ROOT/wrangler.staging.json" --name apex-staging
WRANGLER_OUTPUT_FILE_PATH="$WORK/version.jsonl" pnpm exec wrangler versions upload --config "$ROOT/wrangler.staging.json" --name apex-staging --assets "$WORK/site/dist" --preview-alias "pr-$number"
version=$(jq -ser 'map(select(.type == "version-upload" and .worker_name == "apex-staging")) | last' "$WORK/version.jsonl")
url=$(jq -er '.preview_url | select(test("^https://[a-f0-9]{8}-apex-staging\\.daiksud-a1f\\.workers\\.dev$"))' <<< "$version")
cf workers/scripts/apex-staging/subdomain | jq -e '.enabled == false and .previews_enabled == true' >/dev/null
curl --fail --silent --show-error --retry 5 --retry-all-errors --max-time 30 "$url/.well-known/apex.json" | jq -e --arg sha "$build" --arg run "$VERIFY_RUN_ID" '.sha == $sha and .run == $run' >/dev/null
test "$(curl --silent --show-error --max-time 30 -D "$WORK/headers" -o "$WORK/home" -w '%{http_code}' "$url/")" = 200
tr -d '\r' < "$WORK/headers" | grep -qi '^x-robots-tag: *noindex$'
grep -q 'daiksud.me' "$WORK/home"
[[ $source_info == "$(bash "$ROOT/.github/scripts/pr-source.sh")" ]]
echo "url=$url" >> "$GITHUB_OUTPUT"
echo "build=$build" >> "$GITHUB_OUTPUT"
mkdir -p .staging
jq -n --argjson pr "$source_info" --argjson version "$version" --arg run "$VERIFY_RUN_ID" --arg hash "$(jq -r .hash "$WORK/site/manifest.json")" --arg headers "$(sha256sum "$ROOT/.github/staging-headers" | cut -d ' ' -f1)" '{format:2,pr:$pr,version:$version,verification_run:$run,source_hash:$hash,headers_hash:$headers}' > .staging/receipt.json
printf 'PR #%s preview: %s\n' "$number" "$url" >> "$GITHUB_STEP_SUMMARY"
