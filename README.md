---
type: Guide
title: apexの開発と検証
description: daiksud.meの静的ブログをローカルで起動し、配信物を検証する手順。
---

## apex

Astroで静的生成するブログの開発用リポジトリです。現在はサイト名と準備中の説明を表示する最小ページを提供します。

## 必要な環境

- Node.js 24.21.0（`.node-version`）と同梱のnpm 11.19.0
- Chromiumを実行できるmacOSまたはLinux

Node.jsのバージョンマネージャーで指定版を選び、`node --version` と `npm --version` を確認してください。グローバルなnpmの更新は不要です。

```sh
git clone https://github.com/daiksudme/apex.git
cd apex
npm ci
npx playwright install chromium
npm run dev
```

開発サーバーのURLは `http://localhost:4321/` です。Linuxでブラウザーのシステム依存が不足する場合は、専用の開発環境で `npx playwright install --with-deps chromium` を実行してください。

## 検証と静的ビルド

```sh
npm run check
npm test
npm run preview
```

`npm test` は静的ビルドを作り直し、`127.0.0.1:4321` で一時プレビューを起動してChromiumで確認します。開発サーバーや別のプレビューが同じポートを使っている場合は、先に停止してください。テストが起動したサーバーは終了時に停止します。

静的配信物だけが必要な場合は `npm run build` を実行します。出力先は `dist/` です。`npm run preview` はビルド済みの出力を確認するコマンドであり、本番配信用サーバーではありません。

PRとmainへのpushではGitHub Actionsが `npm ci`、型検証、ビルド、スモークテストを実行します。型検証やテストの失敗は修正してから統合します。ブラウザーの失敗時にはテストレポートとトレースをActionsのartifactに保存します。

## 構成と変更

- ページは `src/pages/`、共通レイアウトは `src/layouts/`、スタイルは `src/styles/` に置きます。
- サイト名・説明は `src/config/site.ts` で管理します。
- [受け入れ条件](docs/behavior/site-shell.feature.md)と `tests/home.spec.ts` を対応させます。
- [用語集](docs/glossary.md)で、サイトと配信物の意味を共有します。

記事・タグ機能とCloudflare配信はまだありません。`0.1.0` は開発中のパッケージ版であり、正式公開を表しません。

## 公開リポジトリでの取り扱い

公開可能なサンプルだけを置いてください。秘密値や非公開原稿は、下書きであってもコミットしません。`.env`、依存、キャッシュ、生成物、テスト結果、Terraformのstate／plan／変数値はGit管理から除外します。通常ビルドとPR検証にCloudflare資格情報は不要です。
