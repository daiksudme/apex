---
type: Feature
title: PR検証のライフサイクル
description: GitHub標準のジョブ順序制御、DraftとReadyのコマンド、最終passチェック。
---

## Feature: メンテナーがマージ前にチームのPRを検証する

### Scenario: STATE-01 各PR検証をDraftから始める

- Given: PRを作成、同期、再オープン、または編集する
- When: PRワークフローが実行される
- Then: commit-stageの前にPRをDraftに変更しようとする
- And: PR単位の標準concurrency設定で、後続の実行に置き換えられた検証をキャンセルする
- And: HEADの比較や、作成者・forkに応じたスキップ条件は適用しない

### Scenario: STATE-02 ソースの検証が成功したら次へ進む

- Given: commit-stageが成功し、対応するCloudflare Previewを選択している
- When: Readyジョブが完了する
- Then: 標準のジョブ依存関係によってacceptance-stageが開始する
- And: commit-stageが照合したPreview URLを受け取る
- And: ユーザーやコーディングエージェントが並行して外部レビューを依頼できる
- And: Readyへの変更に伴い、GitHubがCODEOWNERSレビューを依頼することがある
- And: ワークフロー自体はAPIでAIレビューを明示的に依頼しない

### Scenario: STATE-03 検証の失敗を不合格とし、状態の復旧は行わない

- Given: 必須の先行ステージのいずれかが失敗、キャンセル、またはスキップされる
- When: 最終の `pass` ジョブが必須の先行ジョブの結果を評価する
- Then: `pass` はそのリビジョンに対して成功を報告できない
- And: 失敗時の処理でPRをDraftに戻すことはしない
- And: Readyになった後に受入テストが失敗した場合、PRはReadyのままでチェックが失敗する

### Scenario: STATE-04 ライフサイクル全体をやり直す

- Given: いずれかのステージで検証が失敗している
- When: メンテナーがすべてのジョブを再実行するか、別のコミットをpushする
- Then: Draft、commit-stage、Ready、acceptance-stage、`pass` の順に実行する
- And: 失敗したジョブだけの再実行では、状態遷移全体をやり直したことにはならない

### Scenario: GATE-01 GitHub標準の成功条件を維持する

- Given: Draft、commit-stage、Ready、acceptance-stageのいずれかが成功していない
- When: 必須の `pass` チェックが終了する
- Then: GitHubはそのPRのリビジョンを検証合格として扱えない

### Scenario: GATE-02 mainへのpush時の検証を維持する

- Given: mainにコミットがpushされる
- When: 独立したpushワークフローが実行される
- Then: ビルド、高速なチェック、フィクスチャによる結合テスト、ローカルのブラウザー受入テストを実行する
- And: 最終チェックの名前は `pass` である
- And: PRの状態操作やCloudflareへのデプロイは行わない

### Scenario: GATE-03 状態変更の失敗を例外なく不合格とする

- Given: PRワークフローが必須のDraftまたはReadyへの変更を実行できない
- When: その状態変更ジョブが失敗する
- Then: 後続の依存ステージは成功を報告しない
- And: 最終の必須 `pass` チェックが失敗する
- And: forkやDependabotのPRが状態変更を回避できる特別な代替処理は設けない

変更候補を検証するジョブは読み取り専用とし、認証情報を保持せずにチェックアウトして、共通のcommit-stageおよびacceptance-stageの複合アクションを呼び出します。PRのcommit-stageはChecksとDeploymentsも読み取り、対応するPreviewを特定して検証します。状態変更ジョブは変更候補のコードをチェックアウトせず、引数を引用符で囲んだ `gh` コマンドだけを実行します。キャンセルは状態変更の原子性を保証しないため、キャンセルされたワークフローが最終チェックを完了したりDraftに戻したりするとは限りません。マージには引き続き、保護対象のPRチェック、Previewデプロイ、CodeQL、レビュー承認、ブランチが最新であることが必要です。

これらの結果は、実際の[PRワークフロー](../../.github/workflows/ci-pr.yml)と[main-pushワークフロー](../../.github/workflows/ci-push.yml)の実行で検証します。ワークフローのソースや抜き出したシェル処理のアサーションは、実際のGitHubでの実行の代わりにはなりません。Previewの選択動作は [preview.test.mjs](../../tests/ci/preview.test.mjs) で検証します。
