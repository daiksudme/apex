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

## 管理対象

Cloudflare account `a1f28decfde7c9df1884714e574d2059`のWorker `apex`を、`https://apex.daiksud-a1f.workers.dev`で検証します。Terraformは存在・名前とGitHub設定、Wranglerは静的配信物とVersion／Deploymentを管理します。[管理契約](../adr/0001-delivery-ownership.md)を維持し、Custom Domainは設定しません。

`wrangler.jsonc`にはAssetsだけを指定し、Worker実行コード・SSR・routeは置きません。`public/_headers`は検証ホストにだけnoindexを付けるため、正式ホスト接続時も同じ配信物を使えます。[^cf-headers]

通常の検証は資格情報なしで実行します。

```sh
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm run check
mise exec -- pnpm test
mise exec -- terraform -chdir=terraform/apex init -backend=false -lockfile=readonly
mise exec -- terraform -chdir=terraform/apex validate
mise exec -- terraform -chdir=terraform/apex test
mise exec -- pnpm exec wrangler deploy --dry-run --outdir .private/dry-run
```

provider更新時は`terraform providers lock -platform=linux_amd64 -platform=darwin_arm64`でCIとローカルのハッシュを更新します。

## R2と権限の準備

先に[.infraの導入手順](https://github.com/daiksudme/.infra)で登録・非公開の4バケット・実検証を完了します。R2登録と規約同意、トークン作成と初期投入は利用者が行います。Standard無料枠内を基本とし、超過が見込まれる場合は適用前に確認します。

apex用のObject Read & Write資格情報は`daiksudme-tfstate-apex`だけに限定します。`.infra`の検証CLIをこの資格情報で実行し、他stateの読み取り拒否、匿名拒否、使い捨てデータの読書きを確認してください。実際のTerraformロック試験は各IaC実行でも行います。foundationのstate内容や資格情報はapexへ渡しません。

| 秘密値 | 必要な範囲 | Environment |
| --- | --- | --- |
| `CLOUDFLARE_IAC_TOKEN` | 対象accountのWorkers Scripts Write。Worker存在管理用 | `apex-operations` |
| `CLOUDFLARE_DEPLOY_TOKEN` | 別トークンで同accountのWorkers Scripts Write。Assets・Version・Deployment用 | `apex-operations`、自動配信開始後は`apex-delivery` |
| `IAC_GITHUB_TOKEN` | apex限定のAdministration・Environments・Variables writeとContents read。TerraformのGitHub設定用 | `apex-operations` |
| `CONTROL_READ_TOKEN` | apex限定のVariables read。配信停止とWorker IDの読取専用 | `apex-operations`、`apex-delivery` |
| `CONTROL_WRITE_TOKEN` | 別トークンでapex限定のVariables write。初回解除専用 | `apex-operations` |
| `R2_ACCESS_KEY_ID`／`R2_SECRET_ACCESS_KEY` | apexバケットだけのObject Read & Write | `apex-operations` |

CloudflareのWorkers Scripts権限はこの運用ではaccount単位であり、トークンだけでWorker `apex`に閉じているとは扱いません。GitHub Variablesも個別変数単位の分離ではありません。DNS／Zone権限は与えず、コードの識別子検査・main限定Environment・承認で経路を制限します。GitHub内蔵tokenはartifact・Contentsの読み取りだけに使い、Variablesの読取能力を仮定しません。[^cf-permissions] [^gh-variables]

秘密値をチャット・Git・Issueへ貼りません。GitHub EnvironmentのSecretsへ利用者が投入します。配信ジョブにはstateの秘密値を渡さず、IaC用・停止解除用のtokenも渡しません。

## 保護された初期化

1. 最新mainを検証し、管理権限を持つ既存のGitHub認証で`node scripts/delivery/prepare.mjs`を実行します。`GH_TOKEN`をプロセス環境へ安全に渡してください。`apex-operations`をmainブランチだけに限定し、daiksudの承認を要求します。既存Environmentは上書きせず止まるため、部分作成時は保護を確認して再開します。
2. 上表の秘密値を登録します。初回作成用Environmentとbranch policyはTerraformのimport blockで管理へ取り込み、作り直しません。
3. mainの「Worker infrastructure」を`bootstrap`で手動実行し、Environment承認を行います。R2ロック試験後に、Workerも停止変数もなくstateも空であることを確認して作成します。未知のWorkerや部分stateがあれば停止し、通常applyとして自動復旧しません。
4. mainのVerify成功run IDを選び、「Initial delivery control」を実行します。Worker存在、未配信・未接続、`frozen/bootstrap`、artifactと最新SHAを照合し、専用書込tokenで初回停止を解除します。
5. 「Delivery」を`deploy`で実行し、同じVerify run IDを指定します。検証済みartifactをダウンロード・ハッシュ照合して配信し、再ビルドしません。
6. 「Worker infrastructure」を`verify`で実行します。Wrangler更新後のTerraform planが無差分であること、URL設定・HTTP・配信記録を確認します。ここまで成功してから別PRでmain自動配信を有効化します。

初期化中断・秘密値不足・API失敗を成功と扱いません。初回解除は`bootstrap`専用で、通常リリースの停止・再開には転用しません。PATCH後の読戻し失敗・中断では、未配信・未接続のWorker、artifact、最新SHAを再検証して、既に`open/bootstrap`なら再書込せず完了できます。Worker APIの`deployed_on`が明示的にnullであり、`references.domains`が空配列である場合だけ初期解除します。属性欠落も拒否します。[^worker-api]正式接続を伴う停止状態と候補の横断制御は#10へ引き継ぎます。

## 配信と復旧

Verifyはmain pushの成功artifactを90日保存します。manifestには完全SHA・検証run ID・全ファイルのパスと内容から算出したハッシュを保存します。別workflow、PR、失敗run、ハッシュ不一致のartifactは受け付けません。

配信、WorkerのIaC、初回解除は同じ`apex-delivery`の排他を使い、実行中の処理を自動キャンセルしません。配信の変更直前に停止状態と最新mainを再取得します。起動時のVariablesスナップショットだけで判定せず、不明・停止・古いSHAは失敗として配信しません。

成功時は`delivery-receipt` artifactへSHA・ハッシュ・Worker ID・Version／Deployment ID・run／attempt・直前の成功記録を保存します。HTTPの識別ファイルとホーム、noindex、workers.dev有効・プレビュー無効を確認してから成功記録を書きます。

成功記録はrunの起動順でなくartifactの作成順から選び、記録されたattemptの成功を照合します。Deliveryの再試行はrunの再実行でなく、新しい手動実行を開始してください。artifact記録を上書きせず、各実行を独立して照合するためです。

復旧は「Delivery」の`rollback`を手動実行します。現在のVersionとDeployment IDがともに最新成功記録と同じなら、その直前の成功artifactを選びます。失敗した新配信が現在有効なら、最後の成功artifactを選びます。現在のmainにある制御コードと停止状態を再確認し、過去の配信物を再ビルドせず配信します。初回配信以前やartifact期限切れでは復旧できないため失敗として止まり、新しい検証候補を用意します。

IaCは`default` workspaceとR2の現行stateだけを使います。独自のstateバックアップ・世代保持・日次ジョブは設けません。失敗・中断時は実stateとリソースを確認してから再開します。生のplan・stateとTerraformログはartifactに出さず、runner内の`.private/`へ限定します。サイト配信artifactによるロールバックは別の仕組みとして維持します。

## 検証範囲

ローカルの単体テスト・Terraform mock・Wrangler dry-runは実配信の証明ではありません。R2相互アクセス拒否・ロック、TerraformとWranglerの併用、HTTP検証、実際の同時実行と配信の復旧は実環境で別途記録します。

Issue #4では初回・通常配信までを扱います。Custom Domain、DNS・TLS、正式タグ、リポジトリ間のリリース制御と障害試験は#10・#12の対象です。

[^cf-headers]: Cloudflare Static Assetsのホスト条件付きヘッダー。
[^cf-permissions]: Cloudflare Workersの権限。実際に付与できる範囲とコード上の制約を区別する。
[^gh-variables]: GitHub Actions Variables APIの読取・書込権限。

[^worker-api]: 新しいWorker APIの未配信時刻と依存Custom Domainの応答契約。
