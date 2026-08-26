# Web デモ公開手順（フロント: Cloudflare Workers / API: Render）

このドキュメントは、`frontend/`（React+Vite製アプリ）と `api/main.py`（FastAPI）を
別ホストにデプロイし、公式ドキュメントサイト（`formalweb/website`, 既に
Cloudflare で公開中）とは別 URL で「ブラウザから触れる」Web デモを公開するための
手順です。デスクトップインストール版（`desktop_app.py`）はこの手順の対象外です。

## 全体構成

- ドキュメントサイト: `yuragi-strider.pages.dev`（既存、変更なし）
- アプリ（フロント）: `https://yuragi-strider-app.23sam55781.workers.dev`
  （Cloudflare Worker、静的アセット配信、`frontend/wrangler.jsonc`）
- API（バックエンド）: `https://quantsim-vjul.onrender.com`
  （Render Web Service、リポジトリ直下の `Dockerfile`）

フロントとAPIは別オリジンになるため、フロントは `VITE_API_BASE_URL` で API の
URL を指定し、API 側は `ALLOWED_ORIGINS` でフロントのオリジンを許可します。

## 1. バックエンド（Render）をデプロイする

1. https://render.com でアカウント作成し、GitHub アカウントを連携する。
2. Render ダッシュボードで **New > Blueprint** を選び、この Quantum-sim
   リポジトリを選択する。リポジトリ直下の `render.yaml` が自動検出される。
3. `render.yaml` の内容通りに `yuragi-strider-api` サービスが作成される
   （`Dockerfile` からビルド、無料プラン、`/api/health` をヘルスチェックに使用）。
4. デプロイが終わったら、割り当てられた URL を控える。
   （このプロジェクトでは `https://quantsim-vjul.onrender.com` で公開済み）
5. `PUBLIC_MAX_LOGICAL_QUBITS`（公開 Web アプリでは最大8）は密行列計算のメモリ消費を
   抑えるための公開デモ専用の上限。必要ならRenderの環境変数からさらに下げられる
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
VITE_API_BASE_URL=https://quantsim-vjul.onrender.com npm run build
npx wrangler login   # 未ログインの場合のみ
npx wrangler deploy
```

## 3. Renderで ALLOWED_ORIGINS をフロントの実URLに設定する

このプロジェクトの `yuragi-strider-api`（Render上の表示名は `quantsim-vjul`）は
Blueprintではなく **New Web Service** から手動作成されたため、`render.yaml` は
自動適用されない。Renderダッシュボードのサービス画面 → **Environment** タブで
以下を手動追加する（末尾にスラッシュを付けない）。

| Key | Value |
| --- | --- |
| `ALLOWED_ORIGINS` | `https://yuragi-strider-app.23sam55781.workers.dev` |
| `PUBLIC_MAX_LOGICAL_QUBITS` | `8` |

保存すると自動的に再デプロイされる。`docusaurus.config.ts` と `render.yaml` は
既にこのURLで更新済み。

## 4. 新機能を追加した後の反映方法

バックエンドとフロントエンドで挙動が違うので注意。

- **`api/` または `core/` を変更した場合**: `master` に push すれば Render が
  自動で再ビルド・再デプロイする（Renderダッシュボードのサービス設定で
  GitHub連携時に有効化される既定の動作。Settings > Build & Deploy で
  Auto-Deploy が有効かどうか、どのブランチを見ているかは確認しておく）。
- **`frontend/` を変更した場合**: `.github/workflows/deploy-frontend.yml` が
  `master` への push（`frontend/**` の変更を含むもの）を検知して、
  ビルドしてから `wrangler deploy` を自動実行する。手動での
  `npm run build && npx wrangler deploy` はもう不要（GitHub Actionsの
  **Actions** タブから `workflow_dispatch` で手動実行も可能）。

このワークフローを動かすには、GitHubリポジトリの **Settings > Secrets and
variables > Actions** に以下2つのRepository secretを一度だけ登録する。

| Secret名 | 値の取得方法 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflareダッシュボード → 右上のアイコン →
  **My Profile > API Tokens > Create Token** → テンプレート「Edit Cloudflare
  Workers」を使用して発行 |
| `CLOUDFLARE_ACCOUNT_ID` | `frontend/` で `npx wrangler whoami` を実行すると
  表示される、またはCloudflareダッシュボードの右サイドバーに表示される |

登録後は、`frontend/` 配下を変更して `master` に push するだけで自動反映される。

## 5. 動作確認チェックリスト

- [ ] フロントURLを直接開いて `Simulate` ページが動く（`/api/simulate` が
      別オリジンのRenderに到達し、CORSエラーが出ない）
- [ ] `Circuit Studio` で回路を組んで実行できる
- [ ] `Pulse Lab` が動く（同時実行数2・タイムアウト90秒の既存の制限はローカルと同じ）
- [ ] 意図的に `PUBLIC_MAX_LOGICAL_QUBITS` を超えるqubit数を指定すると
      422エラーで拒否される
- [ ] ドキュメントサイトのナビバー「アプリを試す」から実際にアプリへ遷移する
