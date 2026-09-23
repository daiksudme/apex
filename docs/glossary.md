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
| Code Owner | 変更箇所のレビューを担当する所有者。全ファイルをdaiksudが所有する | PRレビュー | `.github/CODEOWNERS` |
| 自動Approve | 所有者本人の最新PRが必須検証を通ったことに基づくBotの承認。独立した内容レビューを意味しない | PRレビュー | `Owner approval`、`approve.sh` |
| 必須チェック | 成功しない限りmainへ統合できない検証結果 | PR統合 | `verify`、`.github/required-checks.json` |
| 古い承認の無効化 | 新しい変更に以前の承認を引き継がせないGitHubの保護 | main保護 | `dismiss_stale_reviews_on_push` |
| Worker | Cloudflareがrepository importで作成する静的サイトの配信先 | apex配信 | Wrangler `apex` |
| Worker Preview | 同じWorker内でbranchごとに更新される検証環境 | apex配信 | `previews`、Cloudflareの`wrangler preview` |
| Workers Builds | Git pushからbuild・productionまたはPreview配信を行うCloudflareの標準機能 | apex配信 | DashboardのBuild設定 |

配信の管理責任は[管理契約ADR](adr/0001-delivery-ownership.md)に記録する。
