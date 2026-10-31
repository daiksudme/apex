---
type: Feature
title: 個別記事のルートと共通表示
description: ルート直下のURLで記事とプロフィールを読み、記事一覧やタグ一覧から移動するための受入条件。
---

## Feature: ルート直下のURLで個別記事を読む

読者は記事とプロフィールを同じ表示形式で読み、記事一覧やタグ一覧からそれらに移動できます。

### Rule: ファイル名で個別記事のルートを決める

#### Scenario: POST-01 複数の記事に移動する

- Given: `fixture-post.md` と `second-post.md` が存在する
- When: サイトを生成する
- Then: `/fixture-post` と `/second-post` で記事を読める
- And: ホーム、記事一覧、タグ一覧、本文内の内部リンクが新しいURLを参照する
- And: `/posts/<slug>` にはページもリダイレクトも生成しない
- And: `/posts` と `/tags` の一覧ページを維持する
- And: 個別記事ではナビゲーションの「記事一覧」を選択状態にするが、一覧ページを現在のページとして示さない

#### Scenario: POST-02 記事名が既存のルートと競合する

- Given: `posts.md` または `tags.md` が存在する
- When: サイトを生成する
- Then: 対象の記事名を示してビルドが失敗し、既存の一覧ページを上書きしない

### Rule: プロフィールにも共通の記事表示を使う

#### Scenario: POST-03 プロフィールを読む

- Given: 承認済みの自己紹介記事が、本文とfrontmatterを維持したまま `profile.md` に改名されている
- When: 読者が「プロフィール」メニューから移動する
- Then: `/profile` で記事を読める
- And: 他の記事と同じ日付・タグ・一覧掲載のルールに従う
- And: ホームの短い紹介を「自己紹介」ペインとして維持し、詳しいプロフィールへのリンクを設ける

#### Scenario: POST-04 記事の冒頭を読む

- Given: `fixture-post.md` と `profile.md` が存在する
- When: 読者が各記事を表示する
- Then: 記事ペインの「記事」見出しは表示しない
- And: 最初のターミナル行はそれぞれ `cat fixture-post.md` と `cat profile.md` である
- And: 記事タイトルの見出しとアクセシブルな記事名を維持する

ビルドの成功と拒否の契約は [content.build.test.mjs](../../tests/content.build.test.mjs) に対応します。そのフィクスチャのブラウザー検証では、読みやすいMarkdown、メタデータ、タグ一覧、記事への内部リンク、旧階層ルートが存在しないことを確認します。

[reader.browser.mjs](../../tests/acceptance/reader.browser.mjs) のブラウザー検証でPOST-01、POST-03、POST-04を確認します。フィクスチャのビルドテストではPOST-02と不正なタグの検証を維持します。デプロイ先での操作では、フィクスチャの内容が公開されていると仮定せず、実際の一覧からリンクを選びます。
