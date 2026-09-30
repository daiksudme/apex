---
type: Guide
title: apex site build
description: Astroで作る静的サイトの概要とチェック・テスト・ビルド方法。
---

## apex

Astroで構築した静的サイトです。出力先は `dist/` です。Cloudflareの配信設定は [wrangler.jsonc](wrangler.jsonc) で管理します。

公開中のサイトは <https://apex.daiksud-a1f.workers.dev/> で確認できます。

### ホームの設計用語

[tmuxのpane](https://github.com/tmux/tmux/wiki/Getting-Started#sessions-windows-and-panes) と [herdrのpane](https://herdr.dev/docs/concepts/#pane) に着想を得て、ホームの分割された内容領域を **pane（ペイン）** と呼びます。画面説明・設計・CSS・テストでこの呼び方に統一します。

| 名称 | 役割 | CSSクラス |
| --- | --- | --- |
| Welcome pane | ターミナル風の導入、サイト紹介、セクションへの導線 | `welcome-pane` |
| Profile pane | アバター、名前、所在地、プロフィール | `profile-pane` |
| Posts pane | 最新記事。未公開時は空状態を表示 | `posts-pane` |
| Tags pane | 今後扱いたいテーマ | `tags-pane` |
| Commits pane | GitHubの更新履歴への導線 | `commits-pane` |

共通の外枠は `pane`、内部の共通要素は `pane-heading` / `pane-label` / `pane-link` / `pane-footnote` とします。`metadata-panes` はTags paneとCommits paneを配置するコンテナで、独立したpaneではありません。ヘッダー・サイドバー・フッターはpaneと区別します。

これはブログUIの設計用語です。実際の端末、セッション管理、paneの分割・移動・リサイズ機能を意味しません。サイト名 `daiksud.me`、プロンプト `daiksud@kawasaki:~$`、所在地 `Kawasaki, Japan` は変更しません。

### テストとビルド

Node.js `26.10.0` と pnpm `12.6.0` を使用します。バージョンは [mise.toml](mise.toml) と [package.json](package.json) で固定しています。Cloudflare Workers Builds が参照する [.node-version](.node-version) も、同じ Node.js バージョンに揃えます。

```sh
mise trust mise.toml
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm check
mise exec -- pnpm build
mise exec -- pnpm test
```

### Cloudflare デプロイの記録

Cloudflare Workers Builds の `Workers Builds: apex` Check が成功すると、[同期 Workflow](.github/workflows/record-cloudflare-deployment.yml) がその Check の SHA で GitHub Deployment と `success` Status を記録します。Check Suite のブランチが `main` なら `production`、それ以外の空でないブランチなら `preview` に記録します。実際のデプロイは Cloudflare Workers Builds が実行します。

同期が失敗した場合は、GitHub Actions の「Record Cloudflare deployment」Workflow の実行ログで、Check Suite の取得、Deployment 作成、Status 作成のどこで失敗したかを確認してください。初期版は成功した Check だけを記録し、再実行による重複や途中失敗で残る未完了の Deployment は自動で修復しません。

`main` の Ruleset `default` は `preview` への成功した Deployment をマージ条件にしています。この条件だけを戻す場合は、GitHub の Settings → Rules → Rulesets → `default` で Required deployments から `preview` を除き、他のルールは維持してください。
