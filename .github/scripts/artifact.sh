#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in
  pack)
    [[ $GITHUB_SHA =~ ^[a-f0-9]{40}$ && $GITHUB_RUN_ID =~ ^[0-9]+$ ]]
    test -z "$(find dist ! -type f ! -type d -print -quit)"
    mkdir -p dist/.well-known
    jq -n --arg sha "$GITHUB_SHA" --arg run "$GITHUB_RUN_ID" '{sha:$sha,run:$run}' > dist/.well-known/apex.json
    tar -C dist -cf site.tar .
    hash=$(sha256sum site.tar | cut -d ' ' -f1)
    jq -n --arg sha "$GITHUB_SHA" --arg run "$GITHUB_RUN_ID" --arg hash "$hash" '{format:2,sha:$sha,run:$run,hash:$hash}' > manifest.json
    ;;
  verify)
    cd "${2:?artifact directory required}"
    jq -e --arg sha "${3:?SHA required}" --arg run "${4:?run required}" '.format == 2 and .sha == $sha and .run == $run and (.hash | test("^[a-f0-9]{64}$"))' manifest.json >/dev/null
    test "$(jq -r .hash manifest.json)" = "$(sha256sum site.tar | cut -d ' ' -f1)"
    # Inspect effective archive names/types before extraction, including absolute names.
    LC_ALL=C tar -P -tf site.tar > names.txt
    LC_ALL=C tar -P -tvf site.tar > types.txt
    while IFS= read -r entry; do
      [[ $entry != /* && /$entry/ != */../* && $entry != *\\* ]] || exit 1
    done < names.txt
    while IFS= read -r entry; do
      [[ $entry == -* || $entry == d* ]] || exit 1
    done < types.txt
    mkdir dist
    tar --no-same-owner --no-same-permissions -xf site.tar -C dist
    ;;
  *) echo 'Usage: artifact.sh pack | verify DIR SHA RUN' >&2; exit 1 ;;
esac
