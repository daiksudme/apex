#!/usr/bin/env bash
set -euo pipefail

ROOT=${APEX_ROOT:-.}

test ! -d "$ROOT/terraform"
test ! -e "$ROOT/.github/workflows/iac.yml"
if find "$ROOT" -type f \( \
  -name '*.tf' -o \
  -name '*.tf.json' -o \
  -name '*.tftest.hcl' -o \
  -name '.terraform.lock.hcl' \
  \) -print -quit | grep -q .; then
  echo 'Terraform configuration is present.' >&2
  exit 1
fi

paths=()
for path in \
  "$ROOT/.github/scripts" \
  "$ROOT/.github/workflows" \
  "$ROOT/.gitignore" \
  "$ROOT/mise.toml" \
  "$ROOT/package.json" \
  "$ROOT/pnpm-lock.yaml"; do
  [[ -e $path ]] && paths+=("$path")
done

if rg -n --glob '*.yml' --glob '*.yaml' --glob '*.sh' --glob '*.json' \
  'R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|CLOUDFLARE_IAC_TOKEN|IAC_GITHUB_TOKEN' \
  "${paths[@]}"; then
  exit 1
fi
if rg -n 'hashicorp/setup-terraform|terraform([[:space:]]|/)' "${paths[@]}"; then
  exit 1
fi

echo 'Terraform and state credentials are absent from apex operations.'
