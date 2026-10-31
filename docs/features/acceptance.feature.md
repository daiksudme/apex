---
type: Feature
title: 読者向け受入テストの実行
description: 診断情報を保存しながら、ローカルと必要に応じてPreviewで一連の検証を実行する。
---

## Feature: メンテナーが文書化された読者の操作を検証する

### Scenario: ACCEPT-01 受入テストを1回実行する

- Given: アプリケーションのビルドが利用できる
- When: acceptance-stageを実行する
- Then: フィクスチャによるコンテンツの結合テストとローカルでの読者の操作でアプリケーションを検証する
- And: 記事を含むコレクションと空のコレクションのフィクスチャで、記事の読みやすさと記事・タグがない状態を検証する
- And: PRの受入テストでは、照合済みのPreview URLに対しても読者の操作を実行する
- And: コマンドのログはブラウザーのスクリーンショットやトレースとは別に保存する

### Scenario: ACCEPT-02 失敗したら停止する

- Given: 必須の受入テストコマンドが失敗する
- When: acceptance-stageがその結果を受け取る
- Then: 自動再試行をせず、最初の失敗でステージを停止する
- And: 診断情報を保存し、ローカルサーバーを終了する
- And: PRワークフローの最終チェックでPRをDraftに戻し、失敗のままにする

アプリケーションの検証には、[受入テストコマンド](../../scripts/ci/acceptance.mjs)、[フィクスチャによるコンテンツの結合テスト](../../tests/content.build.test.mjs)、[読者の操作](../../tests/acceptance/reader.browser.mjs)、[受入テストの複合アクション](../../.github/actions/acceptance-stage/action.yml)を使用します。意図的に壊したページや呼び出し自体を検査する自己テストで、ランナーやブラウザーのアサーションをテストすることはしません。
