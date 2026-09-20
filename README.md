---
type: Guide
title: apexの開発と検証
description: daiksud.meの静的ブログをローカルで起動し、配信物を検証する手順。
sources:
  - id: pnpm-installation
    resource: https://pnpm.io/installation
---

## apex

Astroで静的生成するブログの開発用リポジトリです。現在はサイト名と準備中の説明を表示する最小ページを提供します。

## 必要な環境

- Node.js 24.21.0（`.node-version`）
- pnpm 12.5.1（`package.json`の`packageManager`）
- Chromiumを実行できるmacOSまたはLinux

Node.jsのバージョンマネージャーで指定版を選び、`node --version` と `pnpm --version` を確認してください。pnpmが未導入の場合は、[公式の固定版インストール手順](https://pnpm.io/installation#installing-a-specific-version)で12.5.1を導入してください。[^pnpm-installation]

```sh
git clone https://github.com/daiksudme/apex.git
cd apex
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm run dev
```

開発サーバーのURLは `http://localhost:4321/` です。Linuxでブラウザーのシステム依存が不足する場合は、専用の開発環境で `pnpm exec playwright install --with-deps chromium` を実行してください。

## 検証と静的ビルド

```sh
pnpm run check
pnpm test
pnpm run preview
```

`pnpm test` は静的ビルドを作り直し、`127.0.0.1:4321` で一時プレビューを起動してChromiumで確認します。開発サーバーや別のプレビューが同じポートを使っている場合は、先に停止してください。テストが起動したサーバーは終了時に停止します。

静的配信物だけが必要な場合は `pnpm run build` を実行します。出力先は `dist/` です。`pnpm run preview` はビルド済みの出力を確認するコマンドであり、本番配信用サーバーではありません。

PRとmainへのpushではGitHub Actionsが `pnpm install --frozen-lockfile`、型検証、ビルド、スモークテストを実行します。型検証やテストの失敗は修正してから統合します。ブラウザーの失敗時にはテストレポートとトレースをActionsのartifactに保存します。

依存の更新は `pnpm add` などで行い、`package.json`と`pnpm-lock.yaml`を一緒にコミットします。`pnpm-workspace.yaml`でNode.jsの版の検査・完全版保存・依存のビルド許可を管理します。

## 構成と変更

- ページは `src/pages/`、共通レイアウトは `src/layouts/`、スタイルは `src/styles/` に置きます。
- サイト名・説明は `src/config/site.ts` で管理します。
- [受け入れ条件](docs/behavior/site-shell.feature.md)と `tests/home.spec.ts` を対応させます。
- [用語集](docs/glossary.md)で、サイトと配信物の意味を共有します。

記事・タグ機能とCloudflare配信はまだありません。`0.1.0` は開発中のパッケージ版であり、正式公開を表しません。

## 配信と基盤の管理契約

[管理責任とリリース境界のADR](docs/adr/0001-delivery-ownership.md)で、apexのTerraform・Wranglerと共通基盤 `.infra` の責任を定めています。
apexはWorkerと配信を、`.infra`はDNSとCustom Domainを所有します。state全体や管理資格情報はリポジトリ間で共有しません。

通常配信と初回ドメイン接続は別経路です。接続時は新しい配信を永続的に止め、受け入れ済みの同じ候補を照合し、接続後の確認に成功してから正式タグを付けます。
IaC・配信・停止制御・接続workflowの実装と実環境検証は後続Issueで行います。

## 公開リポジトリでの取り扱い

公開可能なサンプルだけを置いてください。秘密値や非公開原稿は、下書きであってもコミットしません。`.env`、依存、キャッシュ、生成物、テスト結果、Terraformのstate／plan／変数値はGit管理から除外します。通常ビルドとPR検証にCloudflare資格情報は不要です。

[^pnpm-installation]: pnpm公式の版指定インストール手順。プロジェクトでは12.5.1に固定する。
