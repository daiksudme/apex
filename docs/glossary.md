---
type: Glossary
title: apexの用語
description: サイト開発で使う用語とコード上の対応。
---

## 用語

| 用語 | 定義 | 適用範囲 | コード上の名称 |
| --- | --- | --- | --- |
| ホーム | サイト名と説明を最初に表示するページ | apexの閲覧 | `src/pages/index.astro`、`/` |
| 静的配信物 | ビルド時に生成するHTML・CSS等。閲覧要求ごとにサーバーで生成しない | apexのビルド | `dist/`、`output: static` |
| ローカルプレビュー | ビルド済みの静的配信物を開発環境で確認するためのサーバー | apexの検証 | `mise exec -- pnpm run preview` |
| 記事 | Markdown本文とメタデータを持つ執筆単位 | 記事公開 | Content Collection `posts` |
| 公開記事 | `draft: false`の記事。未来日時も公開対象 | 記事公開 | `getPublicPosts`、`publicPosts` |
| slug | ファイル名に依存しない一意のURL識別子。下書きでも重複しない | 記事公開 | `postSchema.slug`、`/posts/<slug>` |
| 公開日時 | 記事の公開順序を決める瞬間。表示は日本時間 | 記事公開 | `publishedAt`、`formatTimestamp` |
| 更新日時 | 任意の最終更新表示。公開順序を変えない | 記事公開 | `updatedAt` |
| タグ | 定義済み識別子で記事を分類する文字ラベル | 記事公開 | `tags`（ページへのリンクは未実装） |
| Worker | apexの静的配信先の実体。存在管理と配信物の更新を分離する | apex配信 | `cloudflare_worker` |
| Version | 配信候補が参照するWorkerの版 | apex配信 | Worker Version ID |
| Deployment | 実際に配信されるVersionを示す配信記録 | apex配信 | Worker Deployment ID |
| Custom Domain | DNS・TLSを伴う正式ホスト名とWorkerの接続 | 共通ドメイン管理 | `.infra`のCustom Domainリソース（未実装） |
| 配信停止 | 現在のサイトを維持し、新しい配信とWorker実体の変更を止める状態 | apexリリース制御 | `APEX_DELIVERY_CONTROL.state = frozen`（初回制御を実装。正式リリース制御は#10） |
| 配信候補 | apex SHA・配信物ハッシュ・Version／Deployment・.infra SHAを対応付けた受け入れ対象 | リリース制御 | 候補記録（未実装） |
| 検証済みartifact | main pushのVerify成功runが保存した静的配信物とmanifest | apex配信 | `verified-site`、`manifest.json` |
| 配信記録 | HTTP検証後のSHA・hash・Version／Deployment・runの対応 | apex配信 | `delivery-receipt`、`receipt.json` |
| リリースID | 停止・候補・接続・復旧・再開を同一操作として照合する識別子 | リリース制御 | `APEX_DELIVERY_CONTROL.release_id`（未実装） |
| state | Terraformが管理対象と実リソースの対応を保持する非公開データ | 各IaC管理境界 | R2の4バケット。各root moduleがstate内容を所有（実環境は導入時に検証） |

配信とリリース制御の所有者・遷移は[管理契約ADR](adr/0001-delivery-ownership.md)に記録する。
