#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
source "$ROOT/.github/scripts/guard.sh"
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
run=$(verified_run "${VERIFY_RUN_ID:?}")
[[ $(jq -r .head_sha <<< "$run") == "$GITHUB_SHA" ]]
gh run download "$VERIFY_RUN_ID" --repo "$REPOSITORY" --name verified-site --dir "$WORK/site"
bash "$ROOT/.github/scripts/artifact.sh" verify "$WORK/site" "$GITHUB_SHA" "$VERIFY_RUN_ID"
worker_json | jq -e '.deployed_on == null and has("deployed_on") and (.references.domains | type == "array" and length == 0)' >/dev/null
control=$(control_json)
jq -e '.release_id == "bootstrap" and (.state == "open" or .state == "frozen")' <<< "$control" >/dev/null
latest_main
if [[ $(jq -r .state <<< "$control") == frozen ]]; then
  jq -n '{name:"APEX_DELIVERY_CONTROL",value:"{\"state\":\"open\",\"release_id\":\"bootstrap\"}"}' | GH_TOKEN="${CONTROL_WRITE_TOKEN:?}" gh api "repos/$REPOSITORY/actions/variables/APEX_DELIVERY_CONTROL" --method PATCH --input - >/dev/null
fi
control_json | jq -e '.state == "open" and .release_id == "bootstrap"' >/dev/null
echo 'Initial delivery control is open.'
