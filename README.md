---
type: Guide
title: apexサイトのビルド
description: Astro製の静的サイトの概要と、チェック・テスト・ビルドの手順。
---

## apex

Astroで構築した静的サイトです。ビルドの出力先は `dist/` です。Cloudflareへのデプロイ設定は [wrangler.jsonc](wrangler.jsonc) で管理します。

サイトとドキュメントの主言語は日本語です。画面の案内、読み上げ用ラベル、ページ情報を日本語で揃え、ブランド名、コマンド、URL、設定キー、タグのslugは元の表記を維持します。

本番のオリジンは <https://daiksud.me> で、Astroの `site` 設定に集約しています。DNSとCloudflareのカスタムドメイン設定は、この設定とは別に管理します。

### ホーム画面の設計用語

[tmuxのペイン](https://github.com/tmux/tmux/wiki/Getting-Started#sessions-windows-and-panes)と[herdrのペイン](https://herdr.dev/docs/concepts/#pane)にならい、ホーム画面で区切られたコンテンツ領域を**ペイン**と呼びます。画面の説明、設計、CSS、テストでこの用語を統一して使います。

| 名称 | 役割 | CSSクラス |
| --- | --- | --- |
| サイドバーペイン | サイト内の4ページへのナビゲーションとタグ | `sidebar-pane` |
| ウェルカムペイン | ターミナル風の導入、サイトの概要、lsコマンドの出力を模したページ内目次 | `welcome-pane` |
| 自己紹介ペイン | アバター、名前、所在地、短い自己紹介、詳しいプロフィールへのリンク | `about-pane` |
| 記事ペイン | 最新記事。公開済みの記事がない場合は、その状態を表示 | `posts-pane` |
| タグペイン | 記事で使用されているタグ | `tags-pane` |
| コミットペイン | GitHubの変更履歴へのリンク | `commits-pane` |
| フッターペイン | 締めのプロンプト、GitHub / X / Zennへのリンク、著作権表示 | `footer-pane` |

共通の外側のコンテナは `pane`、内部の共通要素は `pane-heading` / `pane-label` / `pane-link` / `pane-footnote` です。ホーム画面は7つのペインで構成し、すべて `src/components/Pane.astro` を使います。サイドバーペインとフッターペインは `aside` / `footer` を使い、サイト共通レイアウトのGrid Areaである `sidebar` / `footer` に配置します。残りの5つは `section` を使い、`dashboard` 直下のGrid Itemとして配置します。メイン領域の5つのペインには共通のヘッダーを表示し、各ペイン固有の内容だけをスロットに渡します。サイト全体のヘッダーは上部バーであり、ペインとは区別します。

共通ナビゲーションの対象は、ホーム `/`、記事一覧 `/posts`、タグ一覧 `/tags`、プロフィール `/profile` の4ページです。デスクトップではサイドバーペインに、モバイルでは本文の上にあるサイトメニューに表示します。ヘッダーにはブランド名とタグラインを表示します。ウェルカムペインのページ内目次は `ls` コマンドの出力を模し、自己紹介 `#about`、最新記事 `#posts`、タグ `#tags`、最近のコミット `#commits` にリンクします。リンクには `#` を表示して現在のページの選択状態と区別し、リンク先にはキーボードフォーカスも移せます。共通のGitHub / X / Zennリンクはフッターペインに表示します。詳しい受入条件は[サイトナビゲーションとホーム画面の目次](docs/features/navigation.feature.md)を参照してください。

これらはブログUIの設計用語です。実際のターミナルやセッション管理、ペインの分割・移動・サイズ変更の機能を意味するものではありません。サイト名 `daiksud.me`、プロンプト `daiksud@kawasaki:~$`、所在地 `Kawasaki, Japan` はそのまま維持します。

### 記事ページ

記事は `src/content/posts/<slug>.md` に配置します。AstroのContent Collectionが `/<slug>` に静的ページを生成します。`/posts` にはすべての記事を `publishedAt` の降順で表示します。

個別の記事はすべて共通の記事レイアウトを使います。記事ペインの見出しは表示せず、冒頭にターミナルのコマンド行 `cat <slug>.md` を表示します。プロフィールも `profile.md` から `/profile` に生成し、`cat profile.md` を表示します。プロフィールの日付、タグ、一覧への掲載には、ほかの記事と同じルールを適用します。プロフィールメニューのリンク先は `/profile` です。ホーム画面の短い自己紹介は自己紹介ペインに表示し、詳しいプロフィールへのリンクを添えます。

既存の一覧ページ `/posts` と `/tags` を保護するため、記事名が `posts` または `tags` の場合はビルドエラーにします。旧パス `/posts/<slug>` にはページもリダイレクトも生成しません。詳しい受入条件は[個別記事のルートと共通表示](docs/features/posts.feature.md)を参照してください。

frontmatterは次の形式で記述します。

```yaml
---
title: 記事タイトル
description: 記事の概要
publishedAt: 2026-10-01
updatedAt: 2026-10-02 # 任意
tags:
  - astro
  - development
---
```

`slug` はfrontmatterに重複して記述せず、Markdownのファイル名をそのまま使います。記事タイトルはレイアウトが `h1` として表示するため、Markdown本文に `#` 見出しは使いません。本文の見出しは `##` から始めます。

### RSS購読

共通フッターから `/rss.xml` にリンクし、各ページのHTMLのheadにもフィードを検出できるよう `https://daiksud.me/rss.xml` を記載します。静的フィードには、プロフィールを含む `/posts` と同じ記事の概要を、公開日の新しい順に掲載します。記事リンクとGUIDには、ローカルビルドやPreviewビルドでも本番のオリジンを使い、末尾のスラッシュを付けません。概要や更新日を編集しても、元の公開日とフィード上の識別情報は維持します。

受入条件は[RSSの購読と検出](docs/features/rss.feature.md)を参照してください。フィードには記事全文のHTMLを含めません。読者はフィードのリンクから元の記事を開きます。

### タグの定義

使用できるタグは [src/content/tags.yaml](src/content/tags.yaml) の `catalog.tags` 配列に定義します。各記事のfrontmatterの `tags` には、定義済みの `slug` を指定します。

```yaml
catalog:
  tags:
    - slug: astro
      tone: blue
    - slug: development
      tone: pink
```

`slug` と `tone` はどちらも必須です。同じ `slug` を複数回定義するとビルドエラーになります。`tone` に指定できる値は `blue` / `purple` / `green` / `pink` / `yellow` / `orange` / `cyan` / `muted` です。新しいタグを記事で使う前に、タグ定義に追加してください。未定義のタグを使う記事が1つでもあれば、その記事とタグを示すエラーでビルドが失敗します。

ホーム画面、タグ一覧、サイドバーには、使用中のタグだけを表示します。タグは参照する記事数の降順に並べ、記事数が同じ場合は `slug` の昇順に並べます。YAMLの配列での順序は表示順に影響しません。

詳しい受入条件は[記事のタグ定義と参照](docs/behavior/tags.feature.md)、用語の定義は[ブログの用語集](docs/glossary.md)を参照してください。

### 日本語の組版

日本語の本文には `word-break: auto-phrase` を使い、未対応ブラウザ向けのフォールバックとして、その前に `word-break: normal` を指定します。自動的な文節の検出だけに頼らず、意図した位置で改行できるよう、必要に応じて `<wbr>` を明示します。

見出しには、文字間を詰める `font-feature-settings: "palt"` と `text-wrap: balance` を使います。本文には `balance` を適用しません。通常の本文はペインの利用可能な幅をそのまま使い、明確な理由なしに固定の `max-width` を設定しません。

参考: https://developer.chrome.com/blog/css-i18n-features

### テストとビルド

依存関係のインストール、Astroの開発・ビルド、テストにはBun `1.4.4` を使います。バージョンは [mise.toml](mise.toml) と [package.json](package.json) で固定し、依存関係は [bun.lock](bun.lock) で固定しています。AstroのコマンドではBunランタイムを明示的に選択します。型チェックには引き続き `astro check` を使い、`.astro` ファイルも対象にします。

Wrangler用にNode.js `26.10.0` も使用します。Cloudflare Workers Buildsが読み取る [.node-version](.node-version) は、`mise.toml` で固定したNode.jsのバージョンと揃えてください。WranglerはNode.jsのshebangに従って実行し、デプロイコマンドにBunランタイムを強制しないでください。デプロイ記録用ワークフローはこれとは別に、GitHubランナーにプリインストールされたNode.jsを使って、信頼済みで外部依存のないURLヘルパーを実行します。

```sh
mise trust mise.toml
mise install
mise exec -- bun install --frozen-lockfile
mise exec -- bun run check
mise exec -- bun run build
mise exec -- bun run test:unit
```

ローカルのAstro開発サーバーは `mise exec -- bun run dev` で起動します。このプロジェクトのスクリプトを実行するときは `bun run check` と `bun run test` を使ってください。Bun組み込みの `check` と `test` は、それぞれ異なる動作をします。

テストは、入力と観測可能な結果を通じて公開インターフェースの契約を守ります。単体テストでは日付、タイトル、記事の並び順、コンテンツに基づくタグを検証します。フィクスチャを使う結合テストでは、有効なコンテンツをビルドし、タグの重複、古い記事にある未定義タグ、ルートの衝突に対するビルド時の診断を検証します。そのブラウザ検証では、隔離したフィクスチャコンテンツを使い、Markdownの読みやすさ、メタデータ、記事・タグの並び順、ナビゲーションを確認します。ソースの文面、YAMLの構造、生のHTML/CSS、クラス、生成された識別子、内部の呼び出し順序はテストで固定しません。受入テストの実行処理、ブラウザのアサーション、スモークチェック自体を対象にしたテストは設けません。

### ブラウザでの受入テスト

読者向けのシナリオは [`docs/features`](docs/features) に日本語で記載します。執筆者向けのタグ定義と不正な参照のルールは [`docs/behavior/tags.feature.md`](docs/behavior/tags.feature.md) に記載します。`bun run test` はBunのテストランナーで、公開インターフェースの単体テストとフィクスチャを使う結合テストを実行します。`test:unit` は公開インターフェースに対する高速なテスト、`test:integration` は [`tests/content.build.test.mjs`](tests/content.build.test.mjs) と、その中で実際にブラウザを使うフィクスチャ検証を実行します。`test`、`test:integration`、受入テストを実行する前にChromiumをインストールしてください。`test:ci` は別のテストで、プロバイダーとデプロイの情報を入力し、返される結果からPreviewの選択・拒否を検証します。

Playwrightのバージョンはロックファイルで固定しています。受入テストの前に、対応するChromium shellをインストールしてください。

```sh
mise exec -- bun run test:ci
mise exec -- bun run --bun playwright install --only-shell chromium
mise exec -- bun run test
mise exec -- bun run test:acceptance
mise exec -- bun run test:acceptance "$PREVIEW_URL"
```

Linuxでブラウザに必要なシステム依存関係がない場合は、Playwrightの `install --with-deps --only-shell chromium` を使います。受入テストのコマンドは検証前にローカルの `dist` をビルドし、フィクスチャを使う結合テストと、画面幅1440・1100・961・960・390ピクセルでのローカルの読者操作を実行します。デプロイ記録と一致する `PREVIEW_URL` を指定すると、デプロイ済みPreviewに対しても同じ操作を検証します。PRのCIではこのURLの指定が必須です。mainへのpush時の受入テストではローカルビルドを使います。

受入テストは1回だけ実行し、実行エラーや期待値との不一致があればそのまま失敗にします。コマンドログは `test-results/acceptance` 以下に保存します。ブラウザ検証が失敗した場合は、対応するローカルまたはPreviewのディレクトリにスクリーンショットとトレースを保存します。フィクスチャコンテンツの診断には `fixtures-populated` と `fixtures-empty`、サイトの操作シナリオには `local` と `preview` の各ディレクトリを使います。レイアウトの寸法を調べるヘルパーは読者の操作シナリオから呼び出し、専用のサーバーやブラウザコマンドは設けません。フォーカスと選択状態の見え方は、基準画像を使わず、その時点で描画した状態どうしを比較します。[受入シナリオ](docs/features/acceptance.feature.md)を参照してください。

初期のスモークチェックは別に実行します。[`test:smoke`](scripts/ci/smoke.mjs) は一致するPreviewの `/` だけにリクエストし、制限時間内にHTTP 200が返ることを要求します。リダイレクトの追跡やコンテンツの検査は行いません。

### Cloudflare Workers Buildsの設定

Workerの **Settings → Build** で、ビルドコマンドを `bun run build` に設定します。本番デプロイとPreviewの既存コマンド、およびWranglerの動作は維持します。これらのコマンドはNode.jsでWranglerを実行します。以前pnpmのビルドコマンドを設定していた場合は、Bunへの移行時に更新が必要です。

Workers Buildsは [bun.lock](bun.lock) から依存関係のインストーラーを選び、[package.json](package.json) の `packageManager` からBunのバージョンを選びます。ビルドコマンドはCloudflare側の外部設定なので、リポジトリのファイルを変更しても更新されません。移行時には、ビルド設定と実際のPreviewビルドログの両方を確認してください。Cloudflareの[ビルド設定](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)と[ビルドイメージ・バージョンの選択](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)を参照してください。

### Codexの承認自動化

[承認ワークフロー](.github/workflows/approve-codex-review.yml)は、agentsの更新され続ける `main` ではなく、[承認済みのソースリビジョン](https://github.com/daiksud/agents/blob/2e0067890bc39f94a8ff9580bd58ba093a3a9428/.github/workflows/approve-codex-review.yml)（blob `67e6e65c5a13e9cf87eaa2240a52dc583d88fd9f`）をコピーしたものです。`chatgpt-codex-connector[bot]` がPRのCodex Review Summaryコメントを作成・編集すると、そのSummaryを再取得し、Code ReviewとSecurity Reviewの両方が `Completed` であることを確認します。同じCodexアカウントによる👍リアクションがPR本文に付いている場合だけ、`gh pr review --approve` で承認します。ほかのユーザーによるリアクションは対象にしません。

両方のレビューが完了していても👍がない場合は、初回の確認後、30秒ごとに最大6回再確認します（待機時間は180秒）。再確認のたびにSummaryを読み直し、どちらかのレビューが未完了なら承認せず終了します。待機時間の上限に達した場合は正常終了し、APIや承認処理でエラーが発生した場合は実行を失敗にします。待機時間が終わった後に再び確認するには、Summaryの新規作成または編集が必要です。

コピー元のリビジョンと同様に、レビュー対象のコミットとHEADの比較、リアクションの時刻による絞り込み、既存の承認の取り消しは行いません。そのため、古い完了済みSummaryと既存の👍によって新しいコードが承認される可能性があります。レビューの鮮度は意図的に保証していません。このワークフローはPRのコードをチェックアウトせず、CIの完了待ちやPRのマージも行いません。必須CI、Preview、CodeQL、レビューの保護ルールは、それぞれ独立して維持します。

### PRの検証

[PRワークフロー](.github/workflows/ci-pr.yml)は、`draft` → `commit-stage` → `ready` → `acceptance-stage` → `pass` の5つのジョブで進みます。各実行では、最初にPRをDraftに変更する処理を試み、ソースとそれに対応するPreviewを検証した後、PRをReadyに変更してローカルとPreviewの受入テストを実行します。最後の必須ジョブ `pass` は、それまでのステージが成功したかを報告します。追加の検証やPRの状態変更は行いません。PRの作成、更新、再オープン、編集でワークフローが実行されます。

DraftとReadyへの変更には `gh pr ready --undo` と `gh pr ready` を使い、書き込み権限はそれらのジョブだけに付与します。HEADが最新かの確認や、fork・Dependabot専用の例外処理は行いません。状態変更が拒否されると、依存するジョブは実行されず、`pass` は失敗します。commit-stageが失敗した場合、PRはDraftのままです。受入テストが失敗した場合、PRはReadyのままで `pass` が失敗します。失敗したPRを復旧のためにDraftへ戻す処理はありません。

[mainへのpush用ワークフロー](.github/workflows/ci-push.yml)は、PRを操作せず、引き続き `commit-stage` → `acceptance-stage` → `pass` を実行します。両方のワークフローで、[commit-stage](.github/actions/commit-stage/action.yml)と[acceptance-stage](.github/actions/acceptance-stage/action.yml)の複合アクションを再利用します。PRでは、対応するPreview URLを検索できるようcommit-stageにChecksとDeploymentsの読み取り権限を付与し、そのURLをacceptance-stageに渡します。[ライフサイクルのシナリオ](docs/features/pr-validation.feature.md)を参照してください。

Readyになると、現在のソースの検証が成功した状態で、ユーザーまたはコーディングエージェントがAIレビューを明示的に依頼できます。Readyへの変更に伴い、GitHubがCODEOWNERSへ自動的にレビューを依頼する場合があります。ワークフロー自体はAIレビューを依頼しません。Readyはマージの許可を意味しません。必須の `pass`、Previewデプロイ、CodeQL、最新状態のチェック、承認、スレッドの解決は、それぞれ独立した条件として引き続き適用されます。

検証失敗後に状態遷移を最初からやり直す場合は、**Re-run all jobs** を使うか、新しいコミットをpushしてください。失敗したジョブだけの再実行では、ライフサイクル全体はやり直されません。PR単位のconcurrency設定で古い実行をキャンセルしますが、キャンセルとDraft/Readyの変更はアトミックではなく、最終状態を保証できません。独自の実行履歴管理、リトライ、状態検証の仕組みは設けません。候補コードを検証するジョブは読み取り専用とし、認証情報を保持せずにチェックアウトして共通の検証用複合アクションを呼び出します。状態を変更するジョブは、候補コードをチェックアウトせず、`gh` コマンドだけを実行します。

### Cloudflareデプロイの記録

Cloudflare Workers Buildsの `Workers Builds: apex` Checkが成功すると、[同期ワークフロー](.github/workflows/record-cloudflare-deployment.yml)が、そのCheckのSHAに対してGitHub Deploymentと `success` Statusを記録します。Check Suiteのブランチが `main` なら `production`、それ以外の空でないブランチ名なら `preview` として記録します。実際のデプロイはCloudflare Workers Buildsが行います。

デプロイの記録処理とPRのPreview照合処理は、[共通のエイリアスヘルパー](scripts/ci/preview-url.mjs)を使い、[Workers SDKのブランチエイリアス規則](https://github.com/cloudflare/workers-sdk/blob/08d694cc8ed69ffe264405a342f1ae0f233d7792/packages/deploy-helpers/src/deploy/helpers/preview-alias.ts)に従います。記号と大文字・小文字を正規化し、長いエイリアスはプロバイダーと同じ方法で元のブランチ名から生成したハッシュを末尾に付けて短縮します。英字から始まる有効なエイリアスを作れないブランチでは、明確なエラーで失敗します。記録処理では、信頼済みのデフォルトブランチ上のワークフローコミットからこのヘルパーだけを読み込みます。依存関係のインストールやPRの候補コードのチェックアウトは行いません。

同期が失敗した場合は、GitHub Actionsの「Record Cloudflare deployment」ワークフローの実行ログを確認し、Check Suiteの取得、Deploymentの作成、Statusの作成のどこで失敗したかを調べます。初期版は成功したCheckだけを記録し、再実行による重複や、途中の失敗で残った不完全なDeploymentを自動修復しません。

`main` に対する `default` Rulesetでは、マージ前に `preview` へのDeploymentが成功していることを要求します。この条件だけを戻す場合は、GitHubの Settings → Rules → Rulesets → `default` にあるRequired deploymentsから `preview` を削除し、ほかのルールはすべて維持してください。
