---
type: Guide
title: workers.devへの初回配信と復旧
description: R2基盤と分離した資格情報を準備し、検証済みartifactだけを手動配信する手順。
sources:
  - id: cf-headers
    resource: https://developers.cloudflare.com/workers/static-assets/headers/
  - id: cf-permissions
    resource: https://developers.cloudflare.com/workers/platform/roles-and-permissions/
  - id: worker-api
    resource: https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/methods/get/
  - id: gh-variables
    resource: https://docs.github.com/en/rest/actions/variables
---

## 管理対象と標準ツール

Worker `apex`を`https://apex.daiksud-a1f.workers.dev`へ静的配信します。TerraformはWorkerの存在とGitHub設定、WranglerはAssets・Version・Deploymentを管理します。Custom Domainは接続しません。[管理契約](../adr/0001-delivery-ownership.md)を参照してください。

自作運用JavaScriptは使いません。ActionsからTerraform・Wrangler・gh・curl・jqと短いBashを呼びます。Astroと記事テストのNode.jsはmiseで管理します。Terraform 1.16.3は公式setup-terraformの固定SHA・wrapper無効でActionsだけに導入します。ローカルではTerraformを実行しません。

## 資格情報

| Secret | 権限 | Environment |
| --- | --- | --- |
| `CLOUDFLARE_IAC_TOKEN` | 対象accountのWorkers Scripts Write | `apex-operations` |
| `CLOUDFLARE_DEPLOY_TOKEN` | 別tokenで同accountのWorkers Scripts Write | `apex-operations`、自動配信時は`apex-delivery` |
| `IAC_GITHUB_TOKEN` | apex限定のAdministration・Environments・Variables write、Contents read | `apex-operations` |
| `CONTROL_READ_TOKEN` | apex限定Variables read | `apex-operations`、`apex-delivery` |
| `CONTROL_WRITE_TOKEN` | 別tokenでapex限定Variables write | `apex-operations` |
| `R2_ACCESS_KEY_ID`／`R2_SECRET_ACCESS_KEY` | apexバケット限定Object Read & Write | `apex-operations` |

CloudflareのWorkers権限はaccount単位、GitHub Variablesはrepo単位です。個別Workerや変数単位の制限と誤認せず、main限定Environmentと承認・識別子照合を併用します。DNS権限は付与しません。[^cf-permissions] [^gh-variables]

GitHubのEnvironmentは準備済みです。Secretsは`gh secret set NAME --repo daiksudme/apex --env apex-operations`の対話入力で登録できます。再構築が必要ならTerraformに定義されたmain限定・daiksud承認必須・bypass無効の設定に合わせ、既存の保護を弱めません。

## Terraform操作

```sh
gh workflow run iac.yml --repo daiksudme/apex --ref main -f operation=bootstrap
gh workflow run iac.yml --repo daiksudme/apex --ref main -f operation=apply
gh workflow run iac.yml --repo daiksudme/apex --ref main -f operation=verify
```

初回は`bootstrap`で存在管理と初期停止変数を作ります。初期状態は未配信・未接続と、停止変数が未作成または`frozen/bootstrap`であることを確認します。途中失敗後もTerraformに残った管理状態から再開し、配信後のbootstrapは拒否します。通常apply／verifyは`open`とWorkerの存在を確認します。Worker APIの不明な属性は許可とみなしません。[^worker-api]

TerraformはR2の標準ロック、固定backend、`prevent_destroy`、Wrangler委任属性の`ignore_changes`を使います。独自state/plan解析・所有日時照合・実ロック競合／アクセス拒否の専用試験・証明ファイルは廃止しました。stateバックアップはありません。

plan本文・state・バイナリ・診断ログはrunner内だけで扱い、差分有無を表示します。applyは同じジョブの保存planを使い、直前に最新mainと停止状態を再取得します。`verify`はplan無差分だけを成功とします。

## 配信と初回解除

mainのVerifyはテスト済みdistをtarにまとめ、SHA-256で照合できる形式2の`verified-site`を保存します。manifestの`format`・`sha`・`run`・`hash`を検証し、成功した同repoのmain push Verifyだけを使います。配信ジョブは再ビルドしません。

```sh
gh workflow run bootstrap-control.yml --repo daiksudme/apex --ref main -f verification_run=RUN_ID
gh workflow run delivery.yml --repo daiksudme/apex --ref main -f operation=deploy -f verification_run=RUN_ID
```

`RUN_ID`は最新mainのVerify成功runを指定します。初回解除は未配信・未接続のWorkerと`bootstrap`状態を照合し、PATCH後の中断では既にopenなら再書込せず完了します。配信・解除・Worker applyは`apex-delivery`で排他し、実行中の処理を自動キャンセルしません。

配信後にVersion／Deployment、HTTPのSHA・run、ホームの200応答、workers.dev限定noindex、プレビュー無効を確認して成功記録を保存します。`public/_headers`は正式ホストにnoindexを付けないため、同じ配信物を後の正式接続でも使えます。[^cf-headers]

## 明示したVersionへの復旧

```sh
gh workflow run delivery.yml --repo daiksudme/apex --ref main -f operation=rollback -f version_id=VERSION_ID -f receipt_run=DELIVERY_RUN_ID
```

Deliveryの再試行は新しい手動実行で行い、既存runの再実行は拒否します。初回解除の再試行は引き続き可能です。

成功したDeliveryの形式2 `delivery-receipt`からVersion IDとrun IDを選びます。指定値と記録のWorker・成功attempt・SHAを照合し、Wrangler標準rollbackでそのVersionを再配信します。過去artifactの自動探索は行いません。停止・最新main・HTTPの確認は通常配信と共通です。記録の期限切れ・不一致、利用不能なVersionは拒否します。

旧形式1のartifact／記録は利用しません。移行後のmain Verifyで形式2を生成します。現在は実配信前なので稼働Versionの移行はありません。自動配信PRは初回配信とTerraform再planの確認までDraftで保持します。

## CIとメンテナンス

PR／mainのVerifyでアプリテスト、Bashの拒否ケース、ShellCheck、Terraform fmt・validate・native mock testを実行します。自作JavaScriptはアプリと記事テストに限定し、運用処理をTypeScriptやインラインNodeへ移して残しません。

```sh
gh workflow run verify.yml --repo daiksudme/apex --ref main -f operation=check
gh workflow run verify.yml --repo daiksudme/apex --ref main -f operation=format
gh workflow run verify.yml --repo daiksudme/apex --ref main -f operation=lock
```

format／lockはTerraformソース差分だけをartifactに保存します。取得してPRへ取り込みます。Secretsやstateは含めません。資格情報未投入時は実import/apply・配信成功を主張せず、CI結果と区別します。正式接続・DNS・TLSとリポジトリ間リリース制御は#10・#12で扱います。

[^cf-permissions]: Cloudflare Workersの権限範囲。
[^gh-variables]: GitHub Actions Variables APIの読取・書込権限。
[^worker-api]: Get Worker APIの未配信時刻とCustom Domain参照。
[^cf-headers]: Cloudflare Static Assetsのホスト条件付きヘッダー。

## PRのステージング

apex-stagingは本番とは別のWorkerです。Terraformは存在とmain限定のapex-staging Environment、APEX_STAGING_WORKER_IDを管理します。このEnvironmentには本番と別のWorkers Scripts WriteトークンをCLOUDFLARE_DEPLOY_TOKENとして登録します。権限はaccount単位であり、Worker単位に制限されるとは扱いません。

VerifyはPRのマージ結果を資格情報なしで検証・ビルドし、形式2のartifactを保存します。Stagingはmainのコードからrun・PR head・base・マージSHA・hashを照合し、Wranglerの固定設定でVersionをアップロードします。絶対パス・親ディレクトリ参照・リンク・特殊ファイルを含むarchiveは展開しません。

ステージングの_headersだけはmainの環境設定で置き換え、全パスをnoindexにします。静的ページは再ビルドしません。staging-receiptには元artifactのsource_hashと環境ヘッダーのheaders_hashを分けて記録します。本番のヘッダーと配信記録の形式は変更しません。

Version固有URLをActionsのSummaryに表示し、HTTP・配信SHA・記事・画像・320px画面を確認します。ブラウザージョブもmainの共通smoke testを使い、PRの実行コードや配信用資格情報を持ちません。PR内の新しいテストは元のVerifyでローカルプレビューに対して実行します。Preview URLは公開URLであり、秘密の原稿や資格情報は配信物に含めません。

成功条件はverifyとstagingの両方です。Worker未準備、資格情報不足、配信失敗、動作確認失敗、PR更新はstaging成功になりません。EnvironmentとWorkerの初回bootstrap後、実チェックの生成・成功を確認してmainの必須チェックへstagingを登録します。URLを維持するためPR終了時のVersion削除は行わず、本番のVersionと混在させません。
