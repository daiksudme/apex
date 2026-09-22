#!/usr/bin/env bash
set -euo pipefail

test ! -d terraform
test ! -e .github/workflows/iac.yml
rg -n --glob '*.yml' --glob '*.yaml' --glob '*.sh' --glob '*.json' \
  'terraform|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|CLOUDFLARE_IAC_TOKEN|IAC_GITHUB_TOKEN' \
  .github/scripts .github/workflows .gitignore mise.toml package.json pnpm-lock.yaml && exit 1

echo 'Terraform and state credentials are absent from apex operations.'
