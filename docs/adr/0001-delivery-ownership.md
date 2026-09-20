---
type: Decision
title: apexの管理責任とリリース境界
description: Workerとドメインの二重管理を避け、検証済み候補だけを正式接続する管理契約。
status: stable
decision_status: accepted
date: 2026-09-20
sources:
  - id: workers-iac
    resource: https://developers.cloudflare.com/workers/platform/infrastructure-as-code/
  - id: worker-schema
    resource: https://github.com/cloudflare/terraform-provider-cloudflare/blob/v5.25.0/docs/resources/worker.md
  - id: wrangler-config
    resource: https://developers.cloudflare.com/workers/wrangler/configuration/
  - id: terraform-lifecycle
    resource: https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle
  - id: github-variable
    resource: https://github.com/integrations/terraform-provider-github/blob/v6.13.0/docs/resources/actions_variable.md
  - id: github-concurrency
    resource: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
  - id: github-variable-api
    resource: https://docs.github.com/en/rest/actions/variables
---

## 状況と目的

開発者は通常のサイト更新をworkers.devで検証できる。
リリース担当者は受け入れ済みの同じ配信物をdaiksud.meへ接続でき、接続途中の更新や失敗を検知して復旧できる。
基盤担当者はfamilyの認証条件と既存DNSを維持したまま共通基盤を管理できる。

目標は、各リソース・属性の書き手が一つであること、通常の更新で初回ドメイン接続が起きないこと、接続中の候補が差し替わらないことである。
このADRは[apex #3](https://github.com/daiksudme/apex/issues/3)の決定であり、実行用IaCや配信workflow、Cloudflareリソースはまだ実装しない。

## 採用する手段

| 手段 | 固定版・役割 |
| --- | --- |
| Terraform | 1.16.3。リソースの存在とGitHub設定の差分管理 |
| Cloudflare provider | 5.25.0。`cloudflare_worker`と共通基盤リソース |
| GitHub provider | 6.13.0。既存リポジトリ設定・Environment・Actions変数等 |
| Wrangler | 4.135.0。検証済みAssetsの配信とWorker Version／Deployment |
| GitHub Actions | PR検証、配信、IaC、保護されたリリース操作を分離 |

後続実装でTerraformのrequired_version、provider制約・lockfile、Wranglerの完全版・npm lockfileを保存する。
Actionsも完全SHAに固定する。既存GitHub設定はimportしてから管理し、リポジトリを作り直さない。
Workers Buildsとの併用は採用しない。同じWorkerへ別経路から自動配信される競合を避けるためである。

## 管理責任とモデルの境界

| 管理元 | 所有するリソース・属性 | 所有しないもの |
| --- | --- | --- |
| apexのTerraform | Workerの存在・account・名前、apexのGitHub設定と停止変数の初期作成 | Assets、Version、Deployment、DNS、Custom Domain、停止変数の運用値 |
| apexのWrangler | Assets、Version、Deployment、互換性・配信設定、workers.devとプレビューURLの設定 | Workerの新規作成・改名・削除、DNS、Custom Domain |
| `.infra`のTerraform | 登録ドメイン、DNSゾーン、DNSSEC、共通基盤、familyとapexのCustom Domain | 各サイトのWorker・Assets・配信・apexのGitHub設定 |
| family | familyのWorker・アプリ・Access・Googleアカウント許可一覧とサイト固有state | apex、共通state、共通Google OAuth秘密値 |

リポジトリは責任の置き場所であり、API権限の完全な隔離を意味しない。
公開ブログのapexと、Google認証・個別認可を必要とするfamilyは別モデルである。familyの認証仕様をapexへ適用しない。
`.infra`にサイトやWorkerを割り当てない。Custom Domainが作るDNS・証明書は同じホスト名の独立したDNSリソースとして重ねて管理しない。

### TerraformとWranglerの併用

Cloudflareの併用方式に従い、Terraformは`cloudflare_worker`で存在と名前を管理する。
`cloudflare_worker_version`、`cloudflare_worker_deployment`やコードを含む旧Workerリソースをapexに併設しない。[^workers-iac]

provider 5.25.0の書き込み可能な属性を次のように割り当てる。[^worker-schema]

| Terraform属性 | 書き手・契約 |
| --- | --- |
| `account_id`、`name` | Terraform。Wranglerは同じ識別子を参照し、存在確認に失敗したら配信しない |
| `subdomain` | Wrangler。`workers_dev: true`、`preview_urls: false`に対応 |
| `observability`、`logpush` | Wrangler。配信設定として管理し、未採用機能は有効にしない |
| `tags`、`tail_consumers` | Wrangler。追加・変更時もTerraformから書き戻さない |
| `id`等の読み取り専用属性 | providerが取得する観測値。別の書き手を設けない |

Terraformの`lifecycle.ignore_changes`は`[subdomain, observability, logpush, tags, tail_consumers]`に限定する。
`all`やWorker名・accountを無視する指定は使わない。これは更新時の委任であり、新規作成・削除を防ぐ仕組みではない。[^terraform-lifecycle]
作成時の既定値、Wrangler配信後のplan、Worker名変更時の挙動を#4で検証し、委任属性が戻される場合は配信開始前に解決する。

Wrangler設定には`workers_dev: true`、`preview_urls: false`を明記し、`route`／`routes`を置かない。
環境別設定にもCustom DomainやDNSを追加しない。省略時の既定値に依存せず、配信後に実設定を確認する。[^wrangler-config]
workers.devは公開検証先であり、非公開環境ではない。公開可能な内容だけを配置する。

## stateと共有契約

| state | 構成・所有元 | 他リポジトリへ渡すもの |
| --- | --- | --- |
| `foundation` | `.infra`。共通基盤と認証連携 | 必要なaccount ID、family向けGoogle IdP ID、準備完了条件 |
| `domains` | `.infra`。DNSとCustom Domain | zone ID、接続結果、リリース記録 |
| `family` | family。Worker・Access・サイト固有設定 | Worker識別子、familyの保護完了条件 |
| `apex` | apex。Worker・GitHub設定 | Worker名／ID、配信候補と準備完了条件 |

保管サービスの選定・構築、暗号化、認可、ロック、バックアップ、backend自身のブートストラップは[.infra #3](https://github.com/daiksudme/.infra/issues/3)が担当する。
apexのroot moduleとstate内容はapexが所有し、`.infra`には配置しない。
各stateの実行権限を分け、apexやfamilyから`terraform_remote_state`等で共通stateを読ませない。
秘密値・生のplan／stateを公開コード、Issue、CIログ、artifactへ保存しない。

共有する識別子は、発行元・対象環境・確認日時とともに必要最小限の構成入力へ転記する。
apexへの入力はaccount ID・zone ID、`.infra`への入力はWorker名／IDと受け入れ済み候補・準備完了条件である。
zone IDは接続照合用であり、apexへDNS変更権限を与える理由にしない。

## 資格情報とブートストラップ

| 経路 | 必要な能力・制限 |
| --- | --- |
| 通常ビルド・PR | ソース読み取りのみ。Cloudflareやstateの資格情報なし |
| apex配信 | 指定accountのWorker配信と停止状態の読み取り。DNS変更、state読み取り、停止解除は不可 |
| apex IaC | apex state、Worker存在管理、apex GitHub設定。通常配信から分離 |
| 共通基盤IaC | foundation／domainsの必要権限。apex stateを読まない |
| apex停止・再開専用workflow | 停止変数の更新、候補と接続結果の照合。保護されたEnvironmentで実行 |
| `.infra`リリース専用workflow | domain適用とapexの状態・候補読み取り。apexの配信・停止変数の直接更新は不可 |
| 正式タグ・Release | 受け入れ済みapex SHAへのタグ／Release作成。通常配信から分離 |

Actions変数のREST APIには読み書きに対応した権限が必要であり、通常の`GITHUB_TOKEN`で十分とは仮定しない。[^github-variable-api]

apex #10で既存の認可方式を調べ、必要なGitHub App等の最小権限と導入手順をコード・手順にする。

Variables権限やWorkers権限が個別変数・Workerに限定できない場合は、残る権限範囲を明記して保護された経路へ閉じ込める。
新たな権限付与・秘密値の初期注入・費用・購入は通常applyと分け、必要な承認後に行う。
Google OAuth、familyの個別Allow、メールOTP不使用の条件は変更しない。

### 永続的な配信停止

apexのリポジトリActions変数`APEX_DELIVERY_CONTROL`に、状態`open`／`frozen`とリリースIDを一つのJSON値で保持する。
`frozen`は新しい配信を止める状態であり、現在のサイトを停止する意味ではない。
Terraformの`github_actions_variable`は初期値`{"state":"frozen","release_id":"bootstrap"}`で作成し、`ignore_changes = [value]`で運用値を更新対象から外す。[^github-variable]
削除・再作成も通常planでは拒否する。消失・不正値・取得不能を`open`と解釈しない。
運用中の値を書ける経路はapexの停止・再開専用workflowだけにする。

通常配信と停止・再開は、apex内で固定のconcurrency group `apex-delivery`を共有し、`cancel-in-progress: false`とする。
ジョブが排他区間を取得した後、更新の直前にREST APIから変数を再取得する。起動時の`vars`スナップショットだけでは判定しない。
配信は`open`の場合だけ許可し、配信完了と記録まで同じ排他区間に置く。
停止は先行配信の終了後に`frozen`を書き、読み戻してリリースIDと候補を照合してから完了を通知する。

GitHubのconcurrencyはリポジトリ内の制御であり、`.infra`との共通ロックにはならない。待機順も保証として使わない。[^github-concurrency]
`.infra`は停止完了の通知だけで進まず、apexの変数と受け入れ記録をAPIで再取得する。
同じリリースID・候補・実行IDが一致しないときは接続しない。
キャンセルされた待機ジョブや応答消失を成功扱いせず、再実行でも現状態から照合する。

### 候補と通常更新

候補の記録にはリリースID、apex完全SHA、配信物ハッシュ、Worker名／ID、Version ID、Deployment ID、`.infra`完全SHAを対応付ける。
配信物ハッシュは配信対象全ファイルの相対パスと内容ハッシュから再現可能に計算し、受け入れ結果とともに保護された記録へ保存する。
記録には承認者、検証結果、workflow run ID／attemptを含める。秘密値・生のplanは含めない。
記録の保存形式・改変防止と有効期限切れ時の再検証は#10で実装・試験する。

通常のmain更新はCI成功後、apexの排他区間で`open`を再確認してworkers.devへ配信する。
`frozen`中の更新は配信せず、未配信であることを実行結果に残す。停止解除だけで過去の待機候補を一斉配信しない。
解除後は対象SHAを選び直し、最新の検証・状態照合を満たして配信する。
接続後は同じWorkerの更新が正式ドメインにも届くため、通常配信の検証条件を維持する。

通常の共通基盤applyは、apexのCustom Domainを作成・更新・置換・削除するplanを拒否する。
planから該当変更だけを除いてapplyする方式や`-target`による回避は採用しない。
許可されたplanを保存し、同じplanを適用する。通常applyとリリースapplyは`.infra`内のdomains用concurrencyとstateロックを共有する。
コードのmain統合だけでCustom Domainを接続せず、保護されたリリース専用workflowだけが接続変更を適用する。

### 初回接続と正式公開

1. 共通基盤の準備後、apex TerraformでWorkerの存在を用意し、#4でWranglerとの併用を検証する。
2. 通常配信を明示的に許可して、検証済み配信物をworkers.devへ配信する。候補のapex SHA・ハッシュ・Version／Deploymentを記録する。
3. リリース担当者が候補と`.infra` SHAを選ぶ。apexの専用workflowが排他区間で停止を取得し、現在の配信が候補と一致することを確認する。違えば停止を保ち候補の選定からやり直す。
4. 停止した同じ候補を受け入れ、承認記録を確定する。再ビルドや新しいVersionの配信は行わない。
5. `.infra`の保護されたリリースworkflowが、停止状態・リリースID・受け入れ済み候補・現在のVersion／Deployment・両リポジトリSHAを照合する。自分のrun ID／attemptもリリース記録に結び付ける。
6. `.infra`側の排他区間で最新planを確認し、接続変更だけが意図どおりであることを承認して、保存したplanを適用する。実行直前にも停止と候補を再取得する。
7. DNS・TLS・HTTP・期待するページと配信物の対応を接続後に確認する。成功記録を保存し、domainを書き換える処理をすべて終える。
8. そのapex SHAへ`v1.0.0`を付け、同じ候補記録を参照するGitHub Releaseを作成する。タグ作成を接続前の配信トリガーにしない。
9. apexの専用workflowが、対応する`.infra` run／attemptの終了と成功記録、現在の候補を照合してから停止を解除する。

開発中は`v0.x.y`を使い、必要な開発Releaseはpre-releaseとする。パッケージ`0.1.0`だけでは公開済みを意味しない。
正式タグが既に存在する場合は同じSHA・候補との一致を確認する。不一致なら停止し、タグを移動・上書きしない。

### 失敗・中断・再開

| 発生点 | 保持する状態と再開方法 |
| --- | --- |
| 停止要求・通知の失敗 | `.infra`は接続しない。変数を読み直し、同じリリースIDで停止完了を確認する |
| 候補不一致・状態取得不能 | 停止を維持する。取得の復旧または新しい候補の受け入れまで接続しない |
| apply失敗・キャンセル・応答消失 | 成否不明として停止を維持。実リソースとstateを再取得し、接続有無を調べる。盲目的な再applyはしない |
| 接続後検証失敗 | `.infra`の保護された復旧経路で接続前の状態へ戻すか前進修復する。無関係なDNSを変更しない |
| タグ／Release作成失敗 | 接続成功記録と同じ候補を保ち、未完了の記録操作だけを再開する。再ビルド・再配信しない |
| 停止解除失敗 | 接続成功と停止解除を別結果で残す。専用workflowで実状態を照合して解除を再試行する |

停止解除は同じリリースIDの接続成功、または復旧完了の承認記録がある場合に限る。
対応する`.infra` run／attemptが実行中・待機中・状態不明なら解除しない。
復旧時は接続処理が終了していること、復旧後のDomain／Worker状態と検証結果を確認する。
`.infra`の再試行・新attemptは接続直前の停止照合を省けず、古い成功記録だけで進めない。
`always()`やタイムアウトによる無条件解除は行わない。初期`bootstrap`の解除も、#4の準備完了を確認する専用操作として記録する。

### .infra計画との整合と帰結

[.infra #1](https://github.com/daiksudme/.infra/issues/1)のapex一律除外を、共通基盤とドメイン接続だけを引き受ける境界へ更新する。
[.infra #2](https://github.com/daiksudme/.infra/issues/2)へ所有属性・リリース経路を、[.infra #3](https://github.com/daiksudme/.infra/issues/3)へ4 stateと資格情報の分離を反映する。
apex用module／Worker／state内容を`.infra`で作らず、apex Custom Domainの具体的な接続・復旧実装はapex #10・#12と連携して`.infra`側で追跡する。
familyのGoogle限定認証・個別Allow・不要URL無効化・接続前後の拒否系検証は維持する。

この分割によりアプリ更新で共通stateを読む必要がなくなる。一方、停止状態と候補の照合、複数リポジトリの部分失敗を扱う運用が必要になる。
TerraformだけでVersionまで管理する案は配信責任が重なるため、WranglerでCustom Domainまで管理する案はDNS所有元が分かれるため採用しない。
backendサービスと権限付与方法は未選定であり、未検証のAPI挙動を利用可能と扱わない。

### 後続検証と見直し条件

| Issue | 実環境で確認するもの |
| --- | --- |
| [apex #4](https://github.com/daiksudme/apex/issues/4) | Worker作成→Wrangler配信→Terraform plan無差分、委任属性の保持、workers.dev有効・プレビュー無効、Domain未接続 |
| [apex #10](https://github.com/daiksudme/apex/issues/10) | 資格情報、永続停止、同時実行・待機・キャンセル・API障害、古い候補／runの拒否、通常planの接続変更拒否、失敗後の再開 |
| [apex #12](https://github.com/daiksudme/apex/issues/12) | 停止した同一候補への接続、DNS・TLS・HTTP、正式タグとRelease、失敗時の復旧と停止解除 |
| [.infra #3](https://github.com/daiksudme/.infra/issues/3) | state暗号化・認可・ロック・復元と相互参照の不要性 |

このADRでは文書・固定版schemaの整合を確認した。Terraform／Wranglerの実環境併用、停止制御、DNS・TLSは未検証である。
provider／Wrangler更新時、委任属性の書き戻し、権限分離の不成立、停止制御の競合が見つかった場合は、該当する後続Issueで契約を見直してから適用する。

[^workers-iac]: Cloudflare公式のTerraformとWrangler併用方式を採用する。具体的な所有範囲は本ADRの決定。
[^worker-schema]: 固定版5.25.0の`cloudflare_worker` schema。省略値と更新APIの実挙動は#4で確認する。
[^terraform-lifecycle]: ignore_changesは外部管理属性の更新差分を無視する機能。権限や削除防止の代わりにはならない。
[^wrangler-config]: workers_dev、preview_urls、routesの設定契約。実装時は固定版4.135.0で照合する。
[^github-variable-api]: リポジトリActions変数の取得・更新に必要な権限。資格情報の具体方式は#10へ引き継ぐ。
[^github-variable]: GitHub provider 6.13.0のActions変数リソース。初期作成と運用値更新を分けるのは本ADRの決定。
[^github-concurrency]: 排他範囲と待機処理の制約に基づき、永続状態の照合を併用する。
