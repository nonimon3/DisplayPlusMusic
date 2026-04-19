# DisplayPlusMusic (nonimon3 fork) — 開発メモ

EVEN Realities G1 グラスで Spotify 曲情報 + 歌詞を表示する ehpk。本 fork は個人用に UI / 歌詞マッチ / 認証フローを改修したもの。

## アーキテクチャ

### ランタイム構成

```
┌─────────────────────────┐     ┌───────────────────┐
│ EVEN Hub (iOS/Android)  │ BLE │ G1 Glasses        │
│ ├ WebView (127.0.0.1)   │◄───►│ (text/list UI)    │
│ │  └ ehpk HTML/JS       │     └───────────────────┘
│ └ EvenAppBridge (Flutter)     
└───────────┬─────────────┘     
            │ HTTPS             
            ▼                    
  api.spotify.com               
  lrclib.net                    
```

EVEN Hub が ehpk 内容を WebView 内のローカル HTTP サーバ (`http://127.0.0.1:<random-port>/`) で配信、JS が bridge 経由で glasses へ描画コマンドを送る。

### ファイル配置

| Path | 役割 |
|---|---|
| `index.html` | Phone 側 UI (ダーク、最小化)。glasses とは別の画面 |
| `src/Main.ts` | エントリポイント。init 順序を制御 |
| `src/model/spotifyAuthModel.ts` | OAuth (/authorize, /api/token) |
| `src/model/spotifyModel.ts` | SDK 初期化、曲 poll、再生制御 |
| `src/model/lyricsModel.ts` | LRCLIB /api/get + /api/search fallback |
| `src/model/songModel.ts` | Song data class + playback bar 生成 |
| `src/model/imageModel.ts` | 画像 DL (現状は HTML アートワーク用のみ) |
| `src/presenter/pollingPresenter.ts` | 1s API poll + 10ms UI tick |
| `src/presenter/spotifyPresenter.ts` | `spotifyModel` を包んだ制御層 |
| `src/presenter/lyricsPresenter.ts` | 歌詞 4 行 window + 現在行マーキング |
| `src/presenter/viewPresenter.ts` | phone UI 更新、OAuth 開始 |
| `src/presenter/eventPresenter.ts` | glasses の swipe/click 受信 |
| `src/presenter/uiState.ts` | glasses 選択ボタン共有 state |
| `src/view/GlassesView.ts` | glasses 描画 (songInfo / lyrics / buttons) |
| `src/utils/storage.ts` | Bridge + localStorage dual-write |
| `src/Scripts/debugBanner.ts` | phone 画面上部の on-screen log |
| `src/Scripts/formatTime.ts` | mm:ss zero-pad |
| `src/personal-creds.ts` | **local only (skip-worktree)**, embedded Spotify 資格 |
| `scripts/bump-id.js` | pack 毎に `package_id` タイムスタンプ更新 |
| `app.json` | ehpk メタ。`package_id` は bump-id で毎回書換 |
| `vite.config.ts` | `mode=evenhub` で singlefile + 相対 base |
| `package.json` | `pack` script: bump-id → `vite build --mode evenhub` → `evenhub pack` |

## Auth 設計

### 採用フロー: 事前取得 refresh_token 埋め込み

通常の OAuth Authorization Code Flow は:
1. `/authorize` に遷移 (外部)
2. ユーザ承認
3. redirect_uri に `?code=` 付きでリダイレクト
4. `/api/token` で code → access + refresh token

**問題**: ehpk の WebView origin は `http://127.0.0.1:<random-port>`。これを redirect_uri として Spotify Dashboard に登録するのは不可能 (random port)。hardcode で `https://nonimon3.github.io/DisplayPlusMusic/` を送っても、EVEN Hub の WebView が外部 URL 遷移 (accounts.spotify.com) を素直に処理できないケースがある。

**解決**: **sim で 1 回だけ auth 完了 → refresh_token を取得 → `src/personal-creds.ts` に埋め込む → ehpk は起動時に refresh_token → access_token の /api/token だけ叩く**。外部遷移ゼロ。

### `src/personal-creds.ts`

```ts
export const PERSONAL_CREDS = {
    SPOTIFY_CLIENT_ID: '<32文字>',
    SPOTIFY_CLIENT_SECRET: '<32文字>',
    SPOTIFY_REFRESH_TOKEN: '<Spotify発行、数百文字>',
};
```

- このファイルは **git skip-worktree** で扱う (リポには空テンプレ commit 済、ローカルに実値、変更は git に見えない)
- 新規クローン時: テンプレそのまま。値を埋めて `git update-index --skip-worktree src/personal-creds.ts` を実行
- 空のまま build したら popup + 外部 OAuth フローにフォールバック (deploy 版はそのモード)

### refresh_token が失効した時の更新手順

Spotify が refresh_token を revoke する状況:
- パスワード変更
- Developer Dashboard でアプリ削除 / 認可解除
- Spotify 側のセキュリティスイープ (稀)

通常は長寿命 (年単位) + ehpk 実行時に rotation された場合は `src/model/spotifyModel.ts` で `storage` 側に新しいトークン保存されるので、**動いてる限りは再取得不要**。

再取得が必要になった場合:

```bash
# 1. sim を起動
npx evenhub-simulator https://nonimon3.github.io/DisplayPlusMusic/

# 2. sim 画面で auth フロー完了 (Save & Auth → Spotify 承認)
# 3. sim 画面上部の dbg バナーに "TOKEN <文字列>" が表示される
# 4. その文字列を src/personal-creds.ts の SPOTIFY_REFRESH_TOKEN に貼る
# 5. rebuild
npm run pack
# 6. 新 out.ehpk を EVEN Hub にインストール
```

### auth 関連のコード分岐

`spotifyModel.initSpotify()`:

```
START
  ↓
PERSONAL_CREDS.client_id/secret があれば storage に seed
  ↓
storage から refresh_token 読む
  ↓
refresh_token 無くて PERSONAL_CREDS.refresh_token あるなら使う (rotation 考慮で storage 優先)
  ↓
dbg "TOKEN <…>" でバナーに出す
  ↓
┌─ ?code= が URL にある → checkForAuthCode (deploy 側のみ)
├─ refresh_token あり → /api/token で access_token 取得 (ehpk 通常ルート)
├─ PERSONAL_CREDS あり → generateAuthUrl (外部 OAuth、fallback)
└─ else → popup 表示
  ↓
SDK init → polling 開始
```

## Build / Pack

### 通常ビルド (web deploy 用)

`npm run build` — Vite が `/DisplayPlusMusic/` base で dist 吐く。GitHub Pages 用。

### ehpk 用ビルド

`npm run pack`:
1. `node scripts/bump-id.js` — `app.json` の `package_id` に新タイムスタンプ付ける (EVEN Hub のインストールキャッシュ回避)
2. `vite build --mode evenhub` — `vite.config.ts` の evenhub 分岐が `base: './'` + `vite-plugin-singlefile` で **JS を HTML にインライン化**。`/DisplayPlusMusic/assets/...` 参照が発生しないので、WebView がどの URL から配信してても JS 確実にロード
3. `evenhub pack app.json dist` — `out.ehpk` 生成

### なぜ singlefile (`--mode evenhub`) が必須か

通常の vite build は `<script src="/DisplayPlusMusic/assets/index-XXX.js">` を HTML に入れる。これは GitHub Pages 上では正しく解決するが、ehpk 内の 127.0.0.1 サーバでは該当パスが存在せず JS が 404 になる → 何も動かない。singlefile で HTML 一枚に JS を内容埋め込みすれば解決。

### なぜ bump-id で毎回 package_id 変えるか

EVEN Hub は同一 `package_id` の再インストール時に古いキャッシュを使い続けることがある (厳密な挙動は不明だが経験的にそう)。毎 pack で `com.nonimon3.splyric.tNNNN` と末尾タイムスタンプ変えることで別アプリ扱いにして確実に新ビルドをロードさせる。

副作用: 新 package_id は EVEN Hub の native storage 名前空間を分離するので、refresh_token やクライアント資格が前の install から引き継がれない。**これを補うのが PERSONAL_CREDS 埋め込み** (code 側に値があるので storage を新たに埋め戻せる)。

## UI 設計

### Glasses 画面 (576×288)

```
┌─────────────────────────────────────────┐
│ Title / Artist          |<<[>||]>>|     │ ← TOP (y=0..32)
├─────────────────────────────────────────┤
│                                         │
│   previous lyric                         │
│ ● current lyric (highlighted)            │ ← LYRICS (y=40..240)
│   next lyric                             │
│   next+1 lyric                           │
│                                         │
└─────────────────────────────────────────┘
│ 選択 4 番目 (Ｘ) にカーソル = songInfo と buttons を空にして歌詞だけ表示 │
```

### 歌詞マッチ (lyricsModel.ts)

Spotify の日本語ロケールはアーティスト名をカタカナ化 (例「エド・シーラン」) するので LRCLIB `/api/get` の厳密一致では大半ミスる。カスケード検索:

1. `/api/get` (track + artist + album + duration) — 完全一致試行
2. `/api/search` (track + artist) — fuzzy
3. `/api/search` (track のみ) — 最終。カタカナ↔英語不一致を救う
4. `pickBest()` で duration ±5 秒 + synced 歌詞優先で best 選出

## Phone UI

auth 済み状態では最小化 (`Logout` ボタン + 接続中ステータス + クレジット)。setup popup は auth 未完了時のみ (現状の埋め込みフローでは基本出ない)。

## トラブルシューティング

### 実機 ehpk で JS が何も動かない (dbg バナー何も出ない)

→ `--mode evenhub` 無しでビルドした可能性。`package.json` の `pack` script 確認。

### dbg に `view.create: 0` は出るが glasses 何も出ない

→ `view.create: 0` は SDK 成功応答。**glasses 接続 / Bluetooth ペアリング確認**。bridge コールは通っても物理接続ないと描画されない。

### `exchange: HTTP 400 body={"error":"invalid_client"}`

→ refresh_token 失効 or client_id/secret 不一致。sim で再取得 → `personal-creds.ts` 更新 → rebuild。

### EVEN Hub が新 ehpk を反映しない (旧版が起動)

→ `npm run pack` が毎回 `package_id` 更新してるはず。もし意図せず同じ id になってるなら `scripts/bump-id.js` 動いてるか確認。

### 歌詞に中国語歌詞など変なのが出る

→ LRCLIB の他曲マッチ。`lyricsModel.ts` の duration drift や artist filter を厳しくすると減らせる (現状は ±5 秒、synced 優先)。

## 動作確認

### PC 簡易確認 (ehpk インストール不要)

```bash
# deploy 版を sim で確認 (bridge モック)
npx evenhub-simulator https://nonimon3.github.io/DisplayPlusMusic/

# ローカル dev (QR で phone 接続)
npm run dev
```

### 実機確認 (グラス必要)

```bash
npm run pack
# out.ehpk を EVEN Hub にインポート
```

## 元プロジェクトとの関係

Fork 元: `Oliemanq/DisplayPlusMusic` (ライセンス明記なし = デフォルト全権保持)。本 fork は個人利用のみ、hub 掲載は見送り。

## 履歴要点 (2026-04-19 改修)

- アートワーク grayscale PNG 生成廃止 (Bluetooth 転送負荷大)
- グラス UI 再構成: 横ボタン (4 つ目 `Ｘ` で歌詞専用モード)
- 歌詞 4 行 window + 現在行マーキング
- lyrics mode 冒頭の `[mm:ss]` 削除
- LRCLIB `/api/search` fallback 追加 (カタカナ対策)
- Phone UI ダークテーマ化 + 最小化 (auth 後は logout とステータスのみ)
- Spotify Auth: 外部遷移問題を受けて refresh_token embed 方式に変更
- Build: `--mode evenhub` singlefile 強制、bump-id で毎回 `package_id` rotation
