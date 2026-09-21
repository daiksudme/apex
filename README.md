---
type: Guide
title: apexの開発と検証
description: daiksud.meの静的ブログをローカルで起動し、配信物を検証する手順。
sources:
  - id: mise-setup
    resource: https://mise.jdx.dev/getting-started.html
  - id: pnpm-version-policy
    resource: https://pnpm.io/settings/cli#pmonfail
  - id: mise-path-priority
    resource: https://mise.jdx.dev/configuration/settings.html
---

## apex

Astroで静的生成するブログの開発用リポジトリです。ホーム、記事一覧とMarkdownの記事詳細を提供します。

## 必要な環境

- mise（CI・再現検証では2026.9.11）
- Node.js 24.21.0とpnpm 12.5.1（`mise.toml`）
- Chromiumを実行できるmacOSまたはLinux

[公式手順](https://mise.jdx.dev/getting-started.html)でmiseを導入します。Node.jsとpnpmのインストール・版の選択はmiseが担当します。取得したリポジトリの`mise.toml`を確認してから信頼し、次の手順を実行してください。`mise exec`を使うため、シェルの設定変更は不要です。[^mise-setup]

```sh
git clone https://github.com/daiksudme/apex.git
cd apex
mise trust mise.toml
mise install
mise exec -- node --version
mise exec -- pnpm --version
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm exec playwright install chromium
mise exec -- pnpm run dev
```

開発サーバーのURLは `http://localhost:4321/` です。Linuxでブラウザーのシステム依存が不足する場合は、専用の開発環境で `mise exec -- pnpm exec playwright install --with-deps chromium` を実行してください。

## 検証と静的ビルド

```sh
mise exec -- pnpm run check
mise exec -- pnpm test
mise exec -- pnpm run preview
```

`mise exec -- pnpm test` は静的ビルドを作り直し、`127.0.0.1:4321` で一時プレビューを起動してChromiumで確認します。開発サーバーや別のプレビューが同じポートを使っている場合は、先に停止してください。テストが起動したサーバーは終了時に停止します。

静的配信物だけが必要な場合は `mise exec -- pnpm run build` を実行します。出力先は `dist/` です。`mise exec -- pnpm run preview` はビルド済みの出力を確認するコマンドであり、本番配信用サーバーではありません。

PRとmainへのpushではGitHub Actionsも`mise.toml`からNode.jsとpnpmを導入し、`pnpm install --frozen-lockfile`、型検証、ビルド、スモークテストを実行します。型検証やテストの失敗は修正してから統合します。ブラウザーの失敗時にはテストレポートとトレースをActionsのartifactに保存します。

依存の更新は `mise exec -- pnpm add` などで行い、`package.json`と`pnpm-lock.yaml`を一緒にコミットします。`pnpm-workspace.yaml`でNode.jsの版の検査・完全版保存・依存のビルド許可を管理します。

Node.jsとpnpmの更新時は`mise.toml`を変更し、`package.json`の`engines`と`packageManager`も同じ版へ揃えます。Node.jsとpnpmの実行版はCIで宣言値と照合します。ローカルでは`mise exec`で指定版を使います。pnpmは`pmOnFail: error`により、版が違っても別の版を自動取得せず失敗します。`mise install`後に`mise exec`で実行してください。[^pnpm-version-policy]

シェルでmiseを有効化済みなら、選択されている版を確認して`pnpm run dev`などを直接実行することもできます。

このプロジェクトは`activate_aggressive = true`を設定し、miseのツールをPATHの先頭へ置きます。mise有効化後にHomebrewなどのパスが追加されても、pnpmが起動するNode.jsを含めて指定版を使用するためです。グローバル設定やシェル設定の編集は不要です。[^mise-path-priority]

## 構成と変更

- ページは `src/pages/`、共通レイアウトは `src/layouts/`、スタイルは `src/styles/` に置きます。
- サイト名・説明は `src/config/site.ts` で管理します。
- [受け入れ条件](docs/behavior/site-shell.feature.md)と `tests/home.spec.ts` を対応させます。
- [用語集](docs/glossary.md)で、サイトと配信物の意味を共有します。

タグページとCloudflare配信はまだありません。`0.1.0` は開発中のパッケージ版であり、正式公開を表しません。

## 記事の追加・更新・公開

`src/content/posts/`にMarkdownファイルを追加します。ファイル名は自由ですが、URLになる`slug`は英小文字・数字をハイフンで区切り、下書きを含め一意にします。公開後にファイル名やタイトルを変えてもslugは維持してください。slugを変えるとURLが変わり、以前のURLへの転送は自動では作られません。

```yaml
title: 記事のタイトル
slug: first-note
description: 記事の短い説明
publishedAt: "2026-09-20T18:00:00+09:00"
tags: [notes]
draft: true
```

上記を本文冒頭の`---`で囲み、その後にMarkdownの本文を書きます。6項目はすべて必須です。タグの正本は`src/domain/posts.ts`の`tags`で、現在は`notes`（表示名「ノート」）を使えます。タグなしは`tags: []`です。未定義タグは下書きでもビルドエラーになります。

公開時は`draft: false`にします。未来日時でも公開されるため、日時による予約投稿には使いません。一覧と詳細で同じ公開条件を使い、公開日時の降順・同じ瞬間ならslug昇順で並びます。

日時は引用符で囲んだISO 8601文字列で、秒とUTCオフセットを必ず含めます。`"2026-09-20T09:00:00Z"`も同じ瞬間です。表示は日本時間の`2026-09-20 18:00 JST`になります。日付だけや時差のない日時は受け付けません。

更新時は必要に応じて`updatedAt: "2026-09-21T09:30:00+09:00"`を追加します。更新日時は一覧の順序を変えません。任意の見出し画像は次の形で指定し、公開画像を`public/images/`へ置きます。

```yaml
heroImage:
  src: /images/sample-landscape.svg
  alt: 青い空と緑の丘を描いたサンプル画像
```

公開サンプルは`welcome.md`の1件です。通常記事へ下書きのテスト原稿を混ぜず、異常系・下書き・0件の検証は一時ディレクトリで実ビルドします。`pnpm test`は下書き本文が配信物に含まれないことも検査します。[記事の受け入れ条件](docs/behavior/posts.feature.md)を参照してください。

## 配信と基盤の管理契約

[管理責任とリリース境界のADR](docs/adr/0001-delivery-ownership.md)で、apexのTerraform・Wranglerと共通基盤 `.infra` の責任を定めています。
apexはWorkerと配信を、`.infra`はDNSとCustom Domainを所有します。state全体や管理資格情報はリポジトリ間で共有しません。

通常配信と初回ドメイン接続は別経路です。接続時は新しい配信を永続的に止め、受け入れ済みの同じ候補を照合し、接続後の確認に成功してから正式タグを付けます。
IaC・配信・停止制御・接続workflowの実装と実環境検証は後続Issueで行います。

## 公開リポジトリでの取り扱い

公開可能なサンプルだけを置いてください。秘密値や非公開原稿は、下書きであってもコミットしません。`.env`、依存、キャッシュ、生成物、テスト結果、Terraformのstate／plan／変数値はGit管理から除外します。通常ビルドとPR検証にCloudflare資格情報は不要です。

[^mise-setup]: mise公式の導入・プロジェクト設定・execによる実行手順。
[^pnpm-version-policy]: pnpmのpmOnFail設定。インストール担当はmiseとし、pnpm自身は不一致を拒否する。
[^mise-path-priority]: mise公式のactivate_aggressive設定。プロジェクト内のツール選択を優先する。

## workers.devへの配信手順

[初回配信と復旧](docs/operations/workers.md)にR2・資格情報・保護された手動workflow・artifact検証をまとめています。初回併用検証の成功後に、別PRで自動配信を有効化します。

Terraformの検証・整形・provider lock更新もGitHub Actionsから実行します。ローカルTerraform実行や自作の運用JavaScriptは使いません。
