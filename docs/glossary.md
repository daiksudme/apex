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
| Worker | apexの静的配信先の実体。bootstrapと通常配信の責任を分離する | apex配信 | Wrangler `apex` |
| Version | 配信候補が参照するWorkerの版 | apex配信 | Worker Version ID |
| Deployment | 実際に配信されるVersionを示す配信記録 | apex配信 | Worker Deployment ID |
| Custom Domain | DNS・TLSを伴う正式ホスト名とWorkerの接続 | apex配信 | `daiksud.me → apex`（後続移行単位） |
| 検証済みartifact | main pushのVerify成功runが保存した静的配信物とmanifest | apex配信 | 形式2の`verified-site`、`site.tar`、`manifest.json` |
| 配信記録 | HTTP検証後のSHA・hash・Version／Deployment・runの対応 | apex配信 | 形式2の`delivery-receipt`、`receipt.json` |
| Code Owner | 変更箇所のレビューを担当する所有者。全ファイルをdaiksudが所有する | PRレビュー | `.github/CODEOWNERS` |
| 自動Approve | 所有者本人の最新PRが必須検証を通ったことに基づくBotの承認。独立した内容レビューを意味しない | PRレビュー | `Owner approval`、`approve.sh` |
| 必須チェック | 成功しない限りmainへ統合できない検証結果 | PR統合 | `verify`、`.github/required-checks.json` |
| 古い承認の無効化 | 新しい変更に以前の承認を引き継がせないGitHubの保護 | main保護 | `dismiss_stale_reviews_on_push` |

配信とリリース制御の所有者・遷移は[管理契約ADR](adr/0001-delivery-ownership.md)に記録する。
