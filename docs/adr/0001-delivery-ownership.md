---
type: ADR
title: Cloudflare Git Integrationでapexを配信する
description: Worker設定をGitで管理し、配信をCloudflareの標準Git連携に任せる判断。
status: stable
date: 2026-09-23
sources:
  - id: workers-commands
    resource: https://developers.cloudflare.com/workers/wrangler/commands/
  - id: workers-config
    resource: https://developers.cloudflare.com/workers/wrangler/configuration/
  - id: workers-rollback
    resource: https://developers.cloudflare.com/workers/wrangler/commands/workers/#rollback
  - id: workers-custom-domain
    resource: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
  - id: workers-git
    resource: https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/
  - id: worker-previews
    resource: https://developers.cloudflare.com/workers/previews/get-started/
---

## 決定

apexはAstroの最小サイトと`wrangler.jsonc`を管理する。Cloudflare Git Integration / Workers BuildsがGit pushからビルド・配信し、productionとWorker Previewを同じ`apex` Workerで扱う。独自の配信スクリプト、GitHub Actionsからの配信、Terraform・共有stateへの依存を持たない。[^workers-git] [^worker-previews]

productionはWrangler設定のtop level、Preview固有設定は`previews`に置く。現在は別resourceを使わないため`previews: {}`とし、`workers_dev`と`preview_urls`を有効にする。アカウントID・route・Custom Domainを固定しない。[^workers-config]

## 責任と完了境界

リポジトリをmainへ統合した後、人がDashboardのCreate applicationからrepositoryをimportする。初回Worker作成とGitHub接続をこの経路で行い、事前の手動deployやAPI bootstrapは行わない。Dashboardは接続先とBuildsの実行設定だけを担当する。

ローカルbuild・dry-runの成功と、実環境のproduction / Preview成功を分ける。初回接続後にproduction表示、PRのstatus / Preview URL、同じbranchの更新を実測して初めて自動配信成立とする。手順は[README](https://github.com/daiksudme/apex/blob/main/README.md)に集約する。

GitHubの実保護設定は変更しない。既存のverify、CODEOWNERS、Owner approvalとそのテストは保護付きマージのために保持する。DNS Zone、Nameserver、DNSSEC、他サイト、Custom Domain接続、正式リリースはこの構成の管理対象に含めない。

## 変更履歴と見直し

以前の決定はGitHub Actions上でWranglerによるbootstrap・artifact配信・rollbackを管理し、Custom Domain接続も後続に含めていた。旧判断の参照資料を保持するが、これらは現在の実行手順ではない。[^workers-commands] [^workers-rollback] [^workers-custom-domain]

2026-09-23にIssue #28の標準Git連携方針へ置き換え、旧配信コードと不要な設定snapshotを撤去する。ファイルの撤去は既存Worker・GitHub設定・他リポジトリのリソース削除を意味しない。

Cloudflareの対応版・Preview仕様が変わる、別resourceやCustom Domainが必要になる、または標準連携で要求を満たせなくなった場合は、この境界を再検討する。ローカル検証の成功を実環境の成功へ読み替えない。

[^workers-git]: GitHub連携によるビルドと自動配信。
[^worker-previews]: Previewの必要版、同じWorkerでのbranch検証と設定。
[^workers-config]: Wrangler設定をWorker構成の正本とする契約。
[^workers-commands]: 旧判断のWorker作成・Version・Deploymentの標準コマンド。
[^workers-rollback]: 旧判断の指定Versionのrollback。
[^workers-custom-domain]: 旧判断のCustom DomainによるDNS・証明書の管理範囲。
