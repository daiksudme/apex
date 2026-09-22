---
type: Feature
title: 検証済みの静的配信物をWorkersへ届ける
description: 運用担当者がWranglerだけで初期化、配信、復旧し、同じ配信物を検証する条件。
---

## 機能: 静的配信を自己完結させる

運用担当者は、mainで検証した配信物を再ビルドせずにapex Workerへ配信し、失敗時には指定したVersionへ復旧できる。

### シナリオ: 初回Workerを初期化する

- 前提: `apex` Workerが存在せず、Custom Domainも接続していない
- もし: 保護された手動bootstrapが最新mainの検証済みartifactを受け取る
- ならば: Wranglerが`apex` Workerを作成してartifactを配信する
- かつ: workers.devのHTTP、配信SHA、noindexを確認して成功記録を保存する

### シナリオ: 通常の配信を許可する

- 前提: mainの検証runが成功し、artifactのSHAとハッシュが一致する
- かつ: `apex` Workerが既に存在する
- もし: `apex-delivery`の排他を取得し、変更直前に最新mainを確認する
- ならば: Wranglerが同じartifactを配信する
- かつ: HTTP検証後にSHA・ハッシュ・Version・Deployment・run IDを記録する

### シナリオ: Workerが不明な通常配信を拒否する

- 前提: `apex` Workerが存在しない、複数ある、または取得できない
- もし: 通常の配信または復旧を実行する
- ならば: Wranglerを実行せず失敗する
- かつ: bootstrapだけが初回作成を扱う

### シナリオ: 指定したVersionへ復旧する

- 前提: 成功記録のrun IDとVersion IDが一致する
- もし: 保護された手動復旧を実行する
- ならば: Wrangler標準rollbackで指定Versionを配信する
- かつ: 通常配信と同じ最新main・排他・HTTP検証を使う

Terraform、state、R2 state資格情報、`.infra`は配信経路に含めない。workers.devにだけ`X-Robots-Tag: noindex`を付ける。Custom Domain接続と正式リリースは後続の移行単位で扱う。
