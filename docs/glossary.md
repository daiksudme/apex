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
| ローカルプレビュー | ビルド済みの静的配信物を開発環境で確認するためのサーバー | apexの検証 | `npm run preview` |
