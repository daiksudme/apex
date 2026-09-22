#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

touch "$WORK/main.tf"
if APEX_ROOT="$WORK" bash "$ROOT/.github/tests/no-terraform.sh"; then
  echo 'Terraform configuration outside terraform/ was accepted' >&2
  exit 1
fi

echo 'Terraform configuration filenames are rejected repository-wide.'
