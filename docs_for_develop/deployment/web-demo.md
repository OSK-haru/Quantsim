# Web デモ公開手順（フロント: Cloudflare Workers / API: Render）

このドキュメントは、`frontend/`（React+Vite製アプリ）と `api/main.py`（FastAPI）を
別ホストにデプロイし、公式ドキュメントサイト（`formalweb/website`, 既に
Cloudflare で公開中）とは別 URL で「ブラウザから触れる」Web デモを公開するための
手順です。デスクトップインストール版（`desktop_app.py`）はこの手順の対象外です。

## 全体構成

- ドキュメントサイト: `yuragi-strider.pages.dev`（既存、変更なし）
- アプリ（フロント）: 新規 Cloudflare Worker（静的アセット配信）、`frontend/wrangler.jsonc`
- API（バックエンド）: 新規 Render Web Service、リポジトリ直下の `Dockerfile` / `render.yaml`

フロントとAPIは別オリジンになるため、フロントは `VITE_API_BASE_URL` で API の
URL を指定し、API 側は `ALLOWED_ORIGINS` でフロントのオリジンを許可します。

## 1. バックエンド（Render）をデプロイする

1. https://render.com でアカウント作成し、GitHub アカウントを連携する。
2. Render ダッシュボードで **New > Blueprint** を選び、この Quantum-sim
   リポジトリを選択する。リポジトリ直下の `render.yaml` が自動検出される。
3. `render.yaml` の内容通りに `yuragi-strider-api` サービスが作成される
   （`Dockerfile` からビルド、無料プラン、`/api/health` をヘルスチェックに使用）。
4. デプロイが終わったら、割り当てられた URL（例:
   `https://yuragi-strider-api.onrender.com`）を控える。
5. `PUBLIC_MAX_LOGICAL_QUBITS`（デフォルト10）は密行列計算のメモリ消費を
   抑えるための公開デモ専用の上限。必要ならRenderの環境変数から調整できる
   （ローカル/デスクトップ版の18qubit上限には影響しない）。

補足: 無料プランは一定時間アクセスがないとスリープし、次のリクエストで
数十秒のコールドスタートが発生する。デモ当日に備えて、発表直前に一度
`/api/health` を叩いて起こしておくと良い。

## 2. フロントエンド（Cloudflare Workers）をデプロイする

ドキュメントサイトと同じ Cloudflare アカウント・同じ Workers 静的アセット方式
（`wrangler.jsonc` + `assets.directory`）を使う。

```sh
cd frontend
npm ci
VITE_API_BASE_URL=https://yuragi-strider-api.onrender.com npm run build
npx wrangler login   # 未ログインの場合のみ
npx wrangler deploy
```

初回 `wrangler deploy` の出力に、実際に割り当てられた URL が表示される
（`https://yuragi-strider-app.<あなたのworkers.devサブドメイン>.workers.dev`、
または既存の Cloudflare カスタムドメインを紐付けていればそちら）。

## 3. 実URLで2箇所を更新する

手順1・2はプレースホルダー URL (`yuragi-strider-app.workers.dev` /
`yuragi-strider-api.onrender.com`) で書かれているので、実際の値が判明したら
以下を更新してコミットする。

- `render.yaml` の `ALLOWED_ORIGINS` → 実際のフロントURL
  （Renderのダッシュボードでも直接上書き可能。両方揃える）
- `formalweb/website/docusaurus.config.ts` の `アプリを試す` リンクの `href`
  → 実際のフロントURL

更新後、Render は環境変数変更時に自動再デプロイされる。ドキュメントサイトは
既存の手順（`docusaurus deploy` もしくは `wrangler deploy`）で再公開する。

## 4. 動作確認チェックリスト

- [ ] フロントURLを直接開いて `Simulate` ページが動く（`/api/simulate` が
      別オリジンのRenderに到達し、CORSエラーが出ない）
- [ ] `Circuit Studio` で回路を組んで実行できる
- [ ] `Pulse Lab` が動く（同時実行数2・タイムアウト90秒の既存の制限はローカルと同じ）
- [ ] 意図的に `PUBLIC_MAX_LOGICAL_QUBITS` を超えるqubit数を指定すると
      422エラーで拒否される
- [ ] ドキュメントサイトのナビバー「アプリを試す」から実際にアプリへ遷移する
