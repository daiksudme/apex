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
| Sidebar pane | サイトナビゲーションとTopics | `sidebar-pane` |
| Welcome pane | ターミナル風の導入、サイト紹介、セクションへの導線 | `welcome-pane` |
| Profile pane | アバター、名前、所在地、プロフィール | `profile-pane` |
| Posts pane | 最新記事。未公開時は空状態を表示 | `posts-pane` |
| Tags pane | 記事で使われているタグ | `tags-pane` |
| Commits pane | GitHubの更新履歴への導線 | `commits-pane` |
| Footer pane | 終端プロンプト、GitHub導線、copyright | `footer-pane` |

共通の外枠は `pane`、内部の共通要素は `pane-heading` / `pane-label` / `pane-link` / `pane-footnote` とします。ホームは合計7つのpaneで構成し、すべて `src/components/Pane.astro` を使います。Sidebar paneとFooter paneは `aside` / `footer` としてサイトシェルの `sidebar` / `footer` Grid Areaに配置し、残る5つは `section` として `dashboard` の直接のGrid Itemになります。共通headerはmain側5 paneで表示し、各pane固有の内容だけをslotで渡します。Headerはトップバーとしてpaneと区別します。

これはブログUIの設計用語です。実際の端末、セッション管理、paneの分割・移動・リサイズ機能を意味しません。サイト名 `daiksud.me`、プロンプト `daiksud@kawasaki:~$`、所在地 `Kawasaki, Japan` は変更しません。

### 記事ページ

記事は `src/content/posts/<slug>.md` に置き、AstroのContent Collectionから `/posts/<slug>` を静的生成します。`/posts` では全記事を `publishedAt` の新しい順に一覧表示します。

Frontmatterは次の形式です。

```yaml
---
title: 記事タイトル
description: 記事の概要
publishedAt: 2026-10-01
updatedAt: 2026-10-02 # optional
tags:
  - astro
  - development
---
```

`slug` はFrontmatterで重複管理せず、Markdownのファイル名をそのまま使います。記事タイトルはレイアウトが `h1` として出力するため、Markdown本文には `#` 見出しを書かず、本文の見出しは `##` から始めます。

### タグ定義

使用できるタグは [src/content/tags.yaml](src/content/tags.yaml) の `catalog.tags` 配列で定義します。記事のFrontmatterの `tags` には、定義済みの `slug` を指定します。

```yaml
catalog:
  tags:
    - slug: astro
      tone: blue
    - slug: development
      tone: pink
```

`slug` と `tone` は必須です。同じ `slug` を複数定義するとビルドエラーになります。`tone` は `blue` / `purple` / `green` / `pink` / `yellow` / `orange` / `cyan` / `muted` のいずれかを指定します。新しいタグを記事で使う前に、定義へ追加してください。未定義タグを使った記事が一つでもあれば、ビルドは対象記事とタグを示すエラーで失敗します。

ホーム・タグ一覧・サイドバーには使用中のタグだけを表示します。ホームは公開日降順の記事内の初出順、タグ一覧とサイドバーはYAMLの配列順です。定義を一つのカタログ内の配列として保持することで、Astroがコレクションのエントリーを識別子順に並べ替えても表示順を維持します。

詳細な受け入れ条件は[記事タグの定義と参照](docs/behavior/tags.feature.md)、用語は[ブログの用語](docs/glossary.md)を参照してください。

### 日本語タイポグラフィ

日本語本文は `word-break: auto-phrase` を使い、未対応ブラウザ向けに `word-break: normal` を先に指定します。機械的な文節判定だけに依存せず、意図した改行候補がある箇所では `<wbr>` を明示的に使います。

見出しは `font-feature-settings: "palt"` で字間を詰め、`text-wrap: balance` を使います。`balance` は本文には適用しません。通常の本文はpaneの利用可能幅をそのまま使い、意図がない限り固定的な `max-width` を設けません。

参考: https://developer.chrome.com/blog/css-i18n-features

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

記事・タグのテスト入力には `tests/fixtures/` の専用データを使います。生成HTMLテストはアプリのソースとフィクスチャーを一時プロジェクトへコピーしてビルドし、公開記事と本番タグ定義を読み込みません。正常なビルドに加え、最新3記事より古い記事の未定義タグでも失敗することを検証します。

### Cloudflare デプロイの記録

Cloudflare Workers Builds の `Workers Builds: apex` Check が成功すると、[同期 Workflow](.github/workflows/record-cloudflare-deployment.yml) がその Check の SHA で GitHub Deployment と `success` Status を記録します。Check Suite のブランチが `main` なら `production`、それ以外の空でないブランチなら `preview` に記録します。実際のデプロイは Cloudflare Workers Builds が実行します。

同期が失敗した場合は、GitHub Actions の「Record Cloudflare deployment」Workflow の実行ログで、Check Suite の取得、Deployment 作成、Status 作成のどこで失敗したかを確認してください。初期版は成功した Check だけを記録し、再実行による重複や途中失敗で残る未完了の Deployment は自動で修復しません。

`main` の Ruleset `default` は `preview` への成功した Deployment をマージ条件にしています。この条件だけを戻す場合は、GitHub の Settings → Rules → Rulesets → `default` で Required deployments から `preview` を除き、他のルールは維持してください。
