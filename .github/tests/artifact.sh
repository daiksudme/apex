#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
export GITHUB_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa GITHUB_RUN_ID=42
cd "$WORK"
mkdir dist
printf 'public sample' > dist/index.html
bash "$ROOT/.github/scripts/artifact.sh" pack
mkdir good
cp site.tar manifest.json good/
bash "$ROOT/.github/scripts/artifact.sh" verify "$WORK/good" "$GITHUB_SHA" "$GITHUB_RUN_ID"
test "$(cat good/dist/index.html)" = 'public sample'
for kind in symlink hardlink absolute; do
 mkdir "$kind"
 if [[ $kind == symlink ]]; then ln -s index.html dist/link; fi
 if [[ $kind == hardlink ]]; then ln dist/index.html dist/link; fi
 if [[ $kind == absolute ]]; then tar -P -cf "$kind/site.tar" "$WORK/dist/index.html"; else tar -C dist -cf "$kind/site.tar" .; fi
 hash=$(shasum -a 256 "$kind/site.tar" | cut -d ' ' -f1)
 jq --arg hash "$hash" '.hash = $hash' manifest.json > "$kind/manifest.json"
 if bash "$ROOT/.github/scripts/artifact.sh" verify "$WORK/$kind" "$GITHUB_SHA" "$GITHUB_RUN_ID"; then echo "Unsafe archive accepted: $kind" >&2; exit 1; fi
 rm -f dist/link
done
echo 'Archive paths and file types verified.'
