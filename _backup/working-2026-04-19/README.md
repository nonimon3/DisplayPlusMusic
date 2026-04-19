# 動作版バックアップ (2026-04-19)

コミット `6c57bdd` (Surface Spotify token endpoint response body in debug banner) 時点、
グラス表示改修（画像削除 / レイアウト刷新 / 歌詞 4 行化）を入れる直前の動作確認済み版。

## 含まれるファイル

- `src/view/GlassesView.ts`
- `src/presenter/lyricsPresenter.ts`
- `src/model/spotifyModel.ts`
- `src/model/songModel.ts`

## 戻し方

### A. ファイル単位で戻す（最小影響）

プロジェクトルートで:

```bash
cp _backup/working-2026-04-19/src/view/GlassesView.ts src/view/GlassesView.ts
cp _backup/working-2026-04-19/src/presenter/lyricsPresenter.ts src/presenter/lyricsPresenter.ts
cp _backup/working-2026-04-19/src/model/spotifyModel.ts src/model/spotifyModel.ts
cp _backup/working-2026-04-19/src/model/songModel.ts src/model/songModel.ts
```

### B. Git タグから戻す

```bash
# 個別ファイル
git checkout backup-working-pre-display-overhaul -- src/view/GlassesView.ts src/presenter/lyricsPresenter.ts src/model/spotifyModel.ts src/model/songModel.ts

# もしくは全ファイルまとめて
git checkout backup-working-pre-display-overhaul -- .
```

### C. コミット前なら git restore でも可

現在の変更 (改修分) が未コミットなら:

```bash
git restore src/view/GlassesView.ts src/presenter/lyricsPresenter.ts src/model/spotifyModel.ts src/model/songModel.ts
```

どれも動作版 (`6c57bdd`) と等価。
