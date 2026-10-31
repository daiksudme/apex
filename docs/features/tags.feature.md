---
type: Feature
title: 読者向けのタグナビゲーション
description: タグ一覧のリンクから記事を探すための受入条件。
---

## Feature: 読者がタグで記事を探す

### Scenario: TAG-01 使用中のタグから記事へ移動する

- Given: 公開済みの記事でタグが使われている
- When: 読者がホームや記事からタグのリンクをたどる
- Then: タグ一覧が開き、そのタグの一意な見出しに移動する
- And: 一覧内の記事リンクを開くと、対応するルート直下の記事に移動する
- And: 記事のタイトルとタグのリンクが維持される

[reader.browser.mjs](../../tests/acceptance/reader.browser.mjs) のブラウザー検証でTAG-01を確認します。執筆者向けのタグ定義、並び順、未使用のタグ、不正な参照は引き続き[記事のタグ定義と参照](../behavior/tags.feature.md)で規定し、公開[タグ関数](../../src/lib/tags.test.ts)と独立した[フィクスチャによるコンテンツの結合テスト](../../tests/content.build.test.mjs)で検証します。
