---
type: Guide
title: apex site build
description: Astroで作る静的サイトの概要とビルド方法。
---

## apex

Astroで構築した静的サイトです。出力先は `dist/` です。Cloudflareの配信設定は [wrangler.jsonc](wrangler.jsonc) で管理します。

### ビルド

Node.js `24.21.0` と pnpm `12.5.1` を使用します。バージョンは [mise.toml](mise.toml) と [package.json](package.json) で固定しています。

```sh
mise trust mise.toml
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm run build
```
