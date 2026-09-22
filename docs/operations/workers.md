---
type: Guide
title: Workersの初期化、配信、復旧
description: Terraformなしで検証済みartifactをWranglerで配信し、指定Versionへ復旧する手順。
sources:
  - id: workers-commands
    resource: https://developers.cloudflare.com/workers/wrangler/commands/
  - id: workers-rollback
    resource: https://developers.cloudflare.com/workers/wrangler/commands/workers/#rollback
  - id: workers-headers
    resource: https://developers.cloudflare.com/workers/static-assets/headers/
---

## 管理対象

apexは`apex` Worker、Static Assets、Version、Deployment、rollbackをWranglerで管理します。Terraform、state、R2 state資格情報、`.infra`は使いません。DNS Zoneや他サイトのhostname・Worker・Deploymentは管理しません。

本番は`https://apex.daiksud-a1f.workers.dev`で確認します。`wrangler.jsonc`はworkers.devを有効、Preview URLを無効、routeなしにします。workers.devだけに`X-Robots-Tag: noindex`を付けます。[^workers-headers]

## 資格情報

| Secret | 用途 | Environment |
| --- | --- | --- |
| `CLOUDFLARE_BOOTSTRAP_TOKEN` | 初回Worker作成だけ | `apex-operations` |
| `CLOUDFLARE_API_TOKEN` | 通常配信・rollback・後続のstaging | `apex-operations` |

通常のGitHub artifact、check、review操作は`GITHUB_TOKEN`を使います。Terraform用token、GitHub管理用個人token、R2 state資格情報は不要です。Cloudflare tokenがアカウント単位の権限であっても、apex以外のリソースを管理対象にしません。

## 初回bootstrap

`apex` Workerが不在で、Custom Domainも未接続であることを確認してから、最新mainのVerify runを指定します。

```sh
gh workflow run bootstrap.yml --repo daiksudme/apex --ref main -f verification_run=RUN_ID
```

bootstrapは同じ検証済みartifactだけをWranglerへ渡し、Worker作成、Version／Deployment、HTTP 200、SHA、noindexを確認して成功記録を保存します。Workerがすでに存在するときは失敗します。通常配信がWorkerを作成することはありません。

## 配信と復旧

```sh
gh workflow run delivery.yml --repo daiksudme/apex --ref main -f operation=deploy -f verification_run=RUN_ID
gh workflow run delivery.yml --repo daiksudme/apex --ref main -f operation=rollback -f version_id=VERSION_ID -f receipt_run=DELIVERY_RUN_ID
```

配信は最新mainと検証済みartifactのrun・SHA・hashを照合し、既存Workerを一意に確認してから実行します。rollbackは成功記録のrun IDとVersion IDを照合し、Wrangler標準rollbackを使います。どちらも再ビルドせず、`apex-delivery`で排他し、HTTP検証に失敗した場合は成功記録を作りません。[^workers-commands] [^workers-rollback]

PRステージング、mainの自動配信、Custom Domain、正式リリースは後続の移行単位で有効化します。Custom Domain接続では既存競合を削除・上書きせず、DNS・TLS・HTTPが成功するまでv1.0.0を作成しません。

[^workers-headers]: Static Assetsのhost条件付きヘッダー。
[^workers-commands]: WranglerのdeployとWorkers操作。
[^workers-rollback]: 指定Versionを再配信するrollback。
