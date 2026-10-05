---
type: Feature
title: サイトナビゲーションとHomeの目次
description: ページ移動、Home内移動、外部リンクを区別する受け入れ条件。
---

## 機能: 読者が目的のページとHomeのセクションへ移動する

読者はサイト内のページ移動、Home内の目次、外部リンクの行き先を区別できる。

### ルール: 共通ナビゲーションはサイト内の4ページを示す

#### シナリオ: ページと外部リンクを選ぶ

- 前提: サイトのいずれかのページを読んでいる
- ならば: Home、Posts、Tags、Profileはそれぞれ `/`、`/posts`、`/tags`、`/profile` へ移動する
- かつ: デスクトップではサイドバー、モバイルでは本文より上のサイトメニューに表示される
- かつ: ヘッダーに同じナビゲーションを重複表示しない
- かつ: 共通のGitHub、X、Zennリンクはフッターから利用できる
- かつ: 紹介文脈の外部リンクと更新履歴へのリンクは維持する

### ルール: Homeの短い紹介はAbout、詳細な紹介はProfileで読む

#### シナリオ: 短い紹介から詳細へ移動する

- 前提: Homeを読んでいる
- ならば: 短い紹介はAboutと表示され、既存の紹介文の分量を維持する
- かつ: Aboutから `/profile` の詳細記事へ移動できる
- かつ: 詳細Profileは既存の本文と共通記事表示を維持する

### ルール: On this pageはHome内の見出しへ移動する

#### シナリオ: 目次をキーボードで使う

- 前提: HomeのWelcomeにOn this pageがある
- ならば: About、Latest Posts、Tags、Recent Commitsはそれぞれ `#about`、`#posts`、`#tags`、`#commits` を参照する
- かつ: 各移動先は一意で、対応する見出し付近へ移動しフォーカスを受け取れる
- かつ: 目次は `#` を添えて表示し、グローバルナビゲーションの選択状態と区別する
- かつ: TabとEnterでリンクを操作でき、フォーカス表示と既存の本文スキップを利用できる

コンポーネント検証は [SiteLayout.test.ts](../../src/layouts/SiteLayout.test.ts) と [Home.test.ts](../../src/components/Home.test.ts)、生成HTMLの検証は [SiteLayout.build.test.mjs](../../src/layouts/SiteLayout.build.test.mjs) に対応する。画面幅とキーボード操作はブラウザでも確認する。
