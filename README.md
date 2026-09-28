---
type: Guide
title: apex site build
description: Astroで作る静的サイトの概要とテスト・ビルド方法。
---

## apex

Astroで構築した静的サイトです。出力先は `dist/` です。Cloudflareの配信設定は [wrangler.jsonc](wrangler.jsonc) で管理します。

公開中のサイトは <https://apex.daiksud-a1f.workers.dev/> で確認できます。

### テストとビルド

Node.js `26.10.0` と pnpm `12.6.0` を使用します。バージョンは [mise.toml](mise.toml) と [package.json](package.json) で固定しています。Cloudflare Workers Builds が参照する [.node-version](.node-version) も、同じ Node.js バージョンに揃えます。

```sh
mise trust mise.toml
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm test
mise exec -- pnpm run build
```

### Cloudflare デプロイの記録

Cloudflare Workers Builds の `Workers Builds: apex` Check が成功すると、[同期 Workflow](.github/workflows/cloudflare-check-probe.yml) がその Check の SHA で GitHub Deployment と `success` Status を記録します。Check Suite のブランチが `main` なら `production`、それ以外の空でないブランチなら `preview` に記録します。実際のデプロイは Cloudflare Workers Builds が実行します。

同期が失敗した場合は、GitHub Actions の「Record Cloudflare deployment」Workflow の実行ログで、Check Suite の取得、Deployment 作成、Status 作成のどこで失敗したかを確認してください。初期版は成功した Check だけを記録し、再実行による重複や途中失敗で残る未完了の Deployment は自動で修復しません。
