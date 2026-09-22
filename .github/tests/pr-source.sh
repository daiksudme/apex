#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
export FIXTURES=$WORK GITHUB_REPOSITORY=daiksudme/apex GITHUB_REF=refs/heads/main
export GITHUB_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa VERIFY_RUN_ID=42
cat > "$WORK/gh" <<'GH'
#!/usr/bin/env bash
set -euo pipefail
case "$2" in
 */actions/runs/42) cat "$FIXTURES/run.json" ;;
 */commits/*/pulls) jq -s . "$FIXTURES/pr.json" ;;
 */pulls/7) cat "$FIXTURES/pr.json" ;;
 */git/ref/heads/main) echo "$GITHUB_SHA" ;;
 *) exit 1 ;;
esac
GH
chmod +x "$WORK/gh"
export PATH="$WORK:$PATH"
printf '{"repository":{"full_name":"daiksudme/apex"},"path":".github/workflows/verify.yml","event":"pull_request","status":"completed","conclusion":"success","head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}' > "$WORK/run.json"
printf '{"number":7,"state":"open","mergeable":true,"head":{"sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},"base":{"ref":"main","sha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","repo":{"full_name":"daiksudme/apex"}},"merge_commit_sha":"cccccccccccccccccccccccccccccccccccccccc"}' > "$WORK/pr.json"
result=$(bash "$ROOT/.github/scripts/pr-source.sh")
jq -e '.number == 7 and .build == "cccccccccccccccccccccccccccccccccccccccc"' <<< "$result" >/dev/null
for change in '.state = "closed"' '.mergeable = false' '.base.sha = "old"' '.head.sha = "old"'; do
 cp "$WORK/pr.json" "$WORK/valid.json"; jq "$change" "$WORK/valid.json" > "$WORK/pr.json"
 if bash "$ROOT/.github/scripts/pr-source.sh" >/dev/null; then exit 1; fi
 mv "$WORK/valid.json" "$WORK/pr.json"
done
jq '.event = "workflow_dispatch"' "$WORK/run.json" > "$WORK/next"; mv "$WORK/next" "$WORK/run.json"
if bash "$ROOT/.github/scripts/pr-source.sh" >/dev/null; then exit 1; fi
echo 'PR artifact source and freshness verified.'
