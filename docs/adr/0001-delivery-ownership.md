---
type: ADR
title: Wranglerでapex固有の配信を管理する
description: Terraformと共有stateを使わず、apexだけがWorker、配信、復旧、Custom Domainを管理する判断。
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
---

## 決定

apexはWranglerとGitHub Actionsだけで、`apex` Worker、Static Assets、Version、Deployment、rollback、PRステージング、Custom Domainを管理する。Terraform、Terraform state、R2 state資格情報、`.infra`のworkflow・リソース・共有stateへの依存を廃止する。

`apex`とPRステージングWorkerはapexだけが書く。Cloudflareアカウントの権限が広くても、DNS Zone、Nameserver、DNSSEC、他サイトのhostname・Worker・Deploymentは管理対象にしない。Custom Domainが作る`daiksud.me`のDNSレコードと証明書は、その接続に限って許容する。既存の競合するhostnameやCustom Domainは削除・上書きせず失敗する。[^workers-custom-domain]

通常配信は、Workerが一意に存在すること、最新main、検証済みartifactのrun・SHA・hashを確認してからWranglerで実行する。Workerが不在または複数なら通常配信・rollbackを拒否する。初回だけ手動bootstrapがWorker不在を確認して作成する。配信、bootstrap、rollbackは`apex-delivery`で排他する。[^workers-commands]

`wrangler.jsonc`は本番Workerの設定を保持する。`workers_dev: true`、`preview_urls: false`、routeなしを明記し、workers.devへだけnoindexを付ける。VersionとDeploymentの検証・rollbackはWrangler標準機能を使う。[^workers-config] [^workers-rollback]

## 資格情報

通常の配信・復旧・PRステージングはEnvironmentの`CLOUDFLARE_API_TOKEN`とActionsの`GITHUB_TOKEN`を使う。GitHub内の保護・review・check・artifact操作のために個人tokenやTerraform用tokenを常設しない。

初回bootstrapだけは`CLOUDFLARE_BOOTSTRAP_TOKEN`を使う。これはWorker作成に必要な広い権限を通常配信から分離するためである。トークンの実際のCloudflare権限がWorker単位に限定できない場合も、Worker以外を管理対象に拡大しない。

## 移行と見直し

既存のWorker・GitHub保護設定をdestroyして作り直さない。Terraformの削除後にWorker不在ならbootstrapから再開する。通常配信はWorkerの自動作成を行わない。

PRステージング、main自動配信、Custom Domain、v1.0.0は別々に実環境で検証する。Custom Domainの競合、DNS・TLS・HTTP、Workers権限の不成立、artifact照合やrollbackの失敗が見つかった場合は、該当経路を停止し、この判断を再検討する。

[^workers-custom-domain]: Custom DomainがDNSレコードと証明書を扱う範囲。
[^workers-commands]: WranglerのWorker作成、Version、Deploymentの標準コマンド。
[^workers-config]: Wrangler設定のWorker・workers.dev・Preview URLの契約。
[^workers-rollback]: 指定Versionを再配信するrollbackコマンド。
