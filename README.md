---
type: Guide
title: apexの開発と検証
description: Astroの最小サイトをビルドし、Cloudflare Git Integrationへ接続する手順。
sources:
  - id: mise-setup
    resource: https://mise.jdx.dev/getting-started.html
  - id: pnpm-version-policy
    resource: https://pnpm.io/settings/cli#pmonfail
  - id: mise-path-priority
    resource: https://mise.jdx.dev/configuration/settings.html
  - id: workers-git
    resource: https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/
  - id: workers-build-image
    resource: https://developers.cloudflare.com/workers/ci-cd/builds/build-image/
  - id: worker-previews
    resource: https://developers.cloudflare.com/workers/previews/get-started/
---

## apex

Astroでトップページ1枚を静的生成するサイトです。サイト名と準備中の説明を表示し、記事機能は含みません。出力先は`dist/`です。`daiksud.me`は表示名であり、Custom Domainは未接続です。

## ローカルでビルドする

Node.js 24.21.0、pnpm 12.5.1を`mise.toml`と`package.json`で固定しています。Wrangler 4.135.0はプロジェクトの開発依存です。Cloudflareのアカウント・tokenは不要です。

miseを導入し、取得した設定を確認してから実行します。[^mise-setup]

```sh
git clone https://github.com/daiksudme/apex.git
cd apex
mise trust mise.toml
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm run build
```

指定版のNode.js・pnpmが選択されている環境では、`pnpm install --frozen-lockfile`と`pnpm run build`だけでビルドできます。開発時は`pnpm run dev`、ビルド済みページの確認は`pnpm run preview`を使います。URLは`http://localhost:4321/`です。

miseの`activate_aggressive`でプロジェクトのツールを優先し、pnpmの`pmOnFail: error`で版の不一致を拒否します。[^mise-path-priority] [^pnpm-version-policy]

## 検証する

```sh
mise exec -- pnpm exec playwright install chromium
mise exec -- pnpm run check
mise exec -- pnpm test
mise exec -- pnpm exec wrangler deploy --dry-run
```

`pnpm test`は設定契約テスト、静的ビルド、Chromiumでの表示・320px幅・404応答を確認します。テスト中は`127.0.0.1:4321`を使用します。Linuxでブラウザ依存が不足する場合は、専用環境で`pnpm exec playwright install --with-deps chromium`を使います。Wranglerの`--dry-run`はローカルの構成検証だけを行い、Workerを作成・配信しません。

PRとmainのGitHub Actions `verify`も同じ検証を実施します。GitHub ActionsからCloudflareへの配信は行いません。CODEOWNERS、必須チェック、Owner approvalは保護付きマージのために残しています。Owner approvalは所有者の最新PRと成功した必須チェックを照合するもので、独立した内容レビューの代わりにはなりません。

## Cloudflareへ接続する

リポジトリのビルドがmainで成功してから、人がCloudflare Dashboardで初回接続を行います。事前のWorker作成や手動deployは不要です。[^workers-git]

1. **Workers & Pages > Create application > Import a repository > Get started**を開きます。
2. GitHubを選び、必要ならCloudflare GitHub Appを`daiksudme/apex`だけに認可し、そのリポジトリを選択します。
3. 次の設定とBuild Variablesを指定してimportします。Build Variablesはビルド環境の既定版との不一致を防ぎます。[^workers-build-image]

| 設定 | 値 |
| --- | --- |
| Worker / project name | `apex` |
| Production branch | `main` |
| Root directory | リポジトリのルート |
| Build command | `pnpm run build` |
| Deploy command | `npx wrangler deploy` |
| Preview command | `npx wrangler preview` |
| `NODE_VERSION` | `24.21.0` |
| `PNPM_VERSION` | `12.5.1` |

初回production deploymentが成功したら、**Settings > Build > Branch control**で**Builds for non-production branches**を有効にします。Worker PreviewsはWrangler 4.135.0以上と`previews`設定を使い、branchごとのURLを更新します。[^worker-previews]

その後はmainへのpushでproduction、feature branchへのpushでPreviewが自動更新されます。実際のproduction URLの表示、PR上のbuild statusとPreview URL、同じbranchへの次のpushでURLが維持され内容が更新されることを確認してください。ローカルテストやdry-runだけでは、この接続・配信の成功を確認できません。

配信設定の正本は`wrangler.jsonc`です。DashboardはGitHub接続とBuilds実行設定を担当します。Cloudflare API、Terraform、独自bootstrap、GitHubのCloudflare配信用Secretsは使用しません。DNS・Custom Domain・他サイト・`v1.0.0`リリースは対象外です。

## 構成と変更

- トップページ: `src/pages/index.astro`
- 表示名と説明: `src/config/site.ts`
- レイアウトとスタイル: `src/layouts/`、`src/styles/`
- [受け入れ条件](docs/behavior/site-shell.feature.md)、[用語集](docs/glossary.md)、[配信の管理責任](docs/adr/0001-delivery-ownership.md)
- [PRの検証と承認](docs/behavior/pull-request.feature.md)

Node.js・pnpmの更新時は`mise.toml`、`package.json`、CloudflareのBuild Variablesを揃えます。依存更新は`pnpm add`等で行い、`pnpm-lock.yaml`もコミットします。秘密値・非公開コンテンツをコミットしないでください。

[^mise-setup]: mise公式の導入・プロジェクト設定・execによる実行手順。
[^mise-path-priority]: miseのactivate_aggressiveによるPATH優先順位。
[^pnpm-version-policy]: pnpmのpmOnFailによる版の不一致の拒否。
[^workers-git]: Cloudflare GitHub Integrationによるimportと自動build。
[^workers-build-image]: Workers BuildsのNode.js・pnpmの版指定。
[^worker-previews]: Worker Previewsの必要版と設定、Git連携。
