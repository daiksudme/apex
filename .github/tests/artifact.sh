#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

artifact="$WORK/artifact"
source="$artifact/source"
mkdir -p "$source"

write_manifest() {
  local hash
  hash=$(sha256sum "$artifact/site.tar" | cut -d ' ' -f1)
  jq -n \
    --arg hash "$hash" \
    '{format:2,sha:"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",run:"123",hash:$hash}' \
    >"$artifact/manifest.json"
}

reject_archive() {
  local name=$1
  rm -rf "$artifact/dist"
  if bash "$ROOT/.github/scripts/artifact.sh" verify "$artifact" \
    aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 123; then
    echo "Unsafe archive accepted: $name" >&2
    exit 1
  fi
  test ! -e "$artifact/dist"
}

archive_with_prefix() {
  local prefix=$1
  if tar --version 2>&1 | grep -q 'GNU tar'; then
    tar -C "$source" --transform="s,^,$prefix," -cf "$artifact/site.tar" ./index.html
  else
    (cd "$source" && pax -w -f "$artifact/site.tar" -x ustar -s ",^,$prefix," ./index.html)
  fi
}

printf 'safe page' >"$source/index.html"
tar -C "$source" -cf "$artifact/site.tar" .
write_manifest
bash "$ROOT/.github/scripts/artifact.sh" verify "$artifact" \
  aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 123
test -f "$artifact/dist/index.html"

rm -rf "$artifact/dist" "$artifact/site.tar"
ln -s index.html "$source/linked-page"
tar -C "$source" -cf "$artifact/site.tar" .
write_manifest
reject_archive symlink
rm "$source/linked-page"

ln "$source/index.html" "$source/hard-linked-page"
tar -C "$source" -cf "$artifact/site.tar" .
write_manifest
reject_archive hardlink
rm "$source/hard-linked-page"

mkfifo "$source/queue"
tar -C "$source" -cf "$artifact/site.tar" .
write_manifest
reject_archive fifo
rm "$source/queue"

printf 'backslash' >"$source/path\\name"
tar -C "$source" -cf "$artifact/site.tar" .
write_manifest
reject_archive backslash
rm "$source/path\\name"

archive_with_prefix ../
write_manifest
reject_archive parent-reference

archive_with_prefix /
write_manifest
reject_archive absolute-path

echo 'Safe and unsafe artifact checks passed.'
