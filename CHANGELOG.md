# 変更履歴 / Changelog

このリポジトリの主な変更を記録します。
Notable changes to this repository are recorded here.

## Unreleased

### 追加 / Added

- 背景色に、OBS などのクロマキーで抜くためのグリーン（`#00FF00`）を足した（両方のページ）。README は「クロマキーしやすい色に」と案内していたが、選べる 4 色にグリーン・ブルーが無かった。

A green background (`#00FF00`) for chroma keying in OBS and similar tools can now be chosen on both pages; the README suggested a chroma-key color, but none of the four colors was one.

### 変更 / Changed

- フォント（Zen Maru Gothic）を、Google Fonts から読まず、このサイトから配るようにした（`@fontsource/zen-maru-gothic`、SIL OFL 1.1）。ページを開いた人の IP アドレスなどが Google に伝わらなくなり、外のサイトとの通信は無くなった。配るのは使う太さ（500・700）の woff2 だけで、文字の範囲ごとに分かれているので、読み込むのは画面に出る文字の分だけ（前と同じ）。ライセンスの文は、公開ページの `licenses/zen-maru-gothic-OFL.txt` に置く。公開用のビルドの検査で、外からの読み込みが無いこと・ライセンスの文があることも確かめる。

The font (Zen Maru Gothic) is now served from this site instead of Google Fonts (`@fontsource/zen-maru-gothic`, SIL OFL 1.1), so opening the pages no longer sends anything to Google and the pages make no connections to other sites. Only the woff2 files of the two weights in use (500 and 700) are published, split by character range as before, and the license text is published at `licenses/zen-maru-gothic-OFL.txt`. The Pages build check now fails on any load from another site or a missing font license.

### 修正 / Fixed

- トーク版で、「マイク開始」をマイクの許可を待つ間にもう一度押すと、マイクを 2 本取り、1 本目が「マイク停止」でも止まらず録音が続いていた。今は、許可を待つ間はボタンを無効にし、始めている途中の 2 回目は何もしない。許可の後の準備で失敗した時も、取ったマイクを止める。
- 音声エンジンを `src/audio-engine.js` に分け、マイクの開始・停止の検査（`npm test`、node だけで動く）を足した。公開のワークフローでも、ビルドの前に走らせる。
- トーク版で、音声ファイルの再生バーが右下の Tweaks のボタンに重なり、パネルを開くと隠れていた（幅が狭いと、中央の操作バーにも重なっていた）。今は、操作バーのすぐ上の中央に出す。マイクのエラーの文は、その上に出す。
- トーク版で、音声ファイルを選び直しても、前のファイルの URL を放していなかった（ページを閉じるまでメモリに残っていた）。
- ぐるぐる版で、向きごとに最初のまばたきが抜けていた（目閉じの絵を、まばたきの時に初めて読み込んでいたため、間に合わなかった）。今は、目閉じの 25 枚も最初に読み込んでおく。
- 自分のキャラを作る道具（`tools/slice_character_sheets.py`）が、`--quality` を使わず、いつも可逆の WebP で書き出していた（イラストでは、公開中の画像の約 4 倍の大きさ）。今は、公開中の画像と同じ非可逆（既定の品質 92）で書き出し、可逆にしたい時は `--lossless` を付ける。
- 同じ道具で: ffmpeg・ffprobe が失敗した時に、理由が表示されなかった → 表示する。見つからない時は、最初に止まって知らせる。`--source` と `--uploads-out` が同じフォルダだと、自分自身へのコピーで止まっていた（Windows では PermissionError）→ コピーを飛ばす。シートの候補が 2 つ以上あると黙って 1 つ目を使い、`ABC.png` のような別のファイルを A のシートとして拾うことがあった → 止めて候補を出す・拾わない。`--no-component-mode` では灰色のゴミを取らないことを知らせる。
- 同じ道具の検査（`tests/test_slice_character_sheets.py`、標準ライブラリだけ）を足し、公開のワークフローでも走らせる。
- トーク版のマイク: 始められなかった時、何が原因でも「権限を確認してください」と出し、コンソールにも何も出していなかった → 許可されていない・マイクが見つからない・ほかのアプリが使っている・このページでは使えない、を分けて出し、コンソールにも出す。動いているマイクが向こうの都合で切れた時（抜いた など）、「マイク停止」の表示のまま残っていた → 止めて「マイク開始」に戻し、知らせる。
- トーク版の音声ファイル: 同じファイルを選び直すと、読み込み直さなかった → 読み込み直す。再生バーから再生した時に、音の処理（AudioContext）を動かし直すようにした。
- トーク版の調整: 「しきい値（はんびらき）」を「ぜんかい」以上にすると、はんびらきの口が一度も出なくなっていた → 片方を動かすと、もう片方を 1 目盛りずらして、はんびらき < ぜんかい を保つ。
- トーク版の画面: 「♪ 音声ファイル」をボタンにして、キーボード（Tab・Enter）でも選べるようにした。マイクのエラーの文を読み上げの対象（role="alert"）にし、暗い背景では明るい赤にした（前はコントラスト比 2.2:1）。
- 調整パネル（Tweaks）を、見出しでつかんで動かす途中にほかの窓へ切り替えると、戻った後、ボタンを押していないのにパネルがマウスに付いてきた → 窓から外れた時・パネルを閉じた時にも、つかむのを終える。
- 追従の速さ・口を閉じる速さが、モニターのリフレッシュレートで変わっていた（毎フレーム同じ割合で近づけていたので、144Hz では 60Hz の 2 倍以上の速さ）→ 実際のフレームの間隔に合わせる。60Hz の画面では、前と同じ動き。
- トーク版の下の操作バーが、幅 940px くらいより狭いと縮み、「マイク開始」「音声ファイル」の字が 1 文字ずつ折り返していた（画面の半分の幅までしか広がれなかった）。360px くらいでは、右下の Tweaks のボタンとも重なっていた → 中身の幅まで広がり、入りきらない時はボタンごと 2 段にする。幅 660px 以下では、Tweaks のボタンの上に出す。

In the talk page, pressing "マイク開始" again while the browser was still asking for microphone access opened a second microphone stream, and the first one kept recording even after "マイク停止". The button is now disabled while waiting, a second start is ignored, and a stream is stopped if setting it up fails. The audio engine now lives in `src/audio-engine.js`, with microphone start/stop tests (`npm test`, node only) that also run in the Pages workflow before the build.

In the talk page, the audio file player sat in the bottom-right corner under the Tweaks button and was hidden when the panel was open (and on narrow windows it also covered the control bar). It is now centered just above the control bar, with the microphone error message above it. Choosing another audio file now releases the object URL of the previous one.

In the guruguru page, the first blink in each direction was often missing, because the eyes-closed image was only loaded when the blink started. The 25 eyes-closed images are now loaded up front.

The character sheet tool (`tools/slice_character_sheets.py`) ignored `--quality` and always wrote lossless WebP, about 4 times the size of the published frames for illustrations. It now writes lossy WebP like the published frames (quality 92 by default); `--lossless` keeps the old output. It also shows why ffmpeg or ffprobe failed and stops early when they are missing, skips copying a sheet onto itself (same `--source` and `--uploads-out`), stops instead of silently picking one when a sheet has several candidates or would match an unrelated file such as `ABC.png`, and notes that `--no-component-mode` does not remove gray residue. The tool now has standard-library tests that also run in the Pages workflow.

In the talk page, a microphone that could not start always showed "check the permission" and logged nothing; the message now tells apart a denied permission, a missing microphone, a microphone used by another app and a page where microphones are unavailable, and the error is logged to the console. When a running microphone ends on its own (for example, it was unplugged), the page now stops it and shows "マイク開始" again instead of staying on "マイク停止". Choosing the same audio file again now reloads it, playing from the player resumes the audio context, and the two mouth thresholds are kept in order (half-open below fully open). The audio file control is now a button that can be used with the keyboard, and the microphone error is announced (role="alert") and shown in a lighter red on the dark background.

Dragging the Tweaks panel by its header and switching to another window before releasing the button left the panel following the mouse afterwards; the drag now also ends when the window loses focus or the panel closes.

Following and mouth closing ran faster on high refresh rate monitors (more than twice as fast at 144 Hz), because every frame moved by the same fraction. They now follow the real frame interval, so 120 Hz and 144 Hz screens move like 60 Hz ones; on a 60 Hz screen nothing changes.

The control bar of the talk page could only be half as wide as the window, so below about 940 px its buttons wrapped one character per line, and around 360 px it also ran under the Tweaks button. It now grows to its content width, wraps whole buttons onto a second row when it has to, and sits above the Tweaks button on windows 660 px wide or narrower.

### そのほか / Other

- 自分のキャラを作る道具（`tools/slice_character_sheets.py`）の画素の走査を速くした（画素ごとに Python の関数を呼んでいたのを、行ごとに `bytes.translate`・`find` で数える。結果は前と同じ）。試験用のシート 6 枚で、可逆の書き出しで 29 秒 → 10 秒、`--no-component-mode` では 49 秒 → 9 秒。既定の非可逆の書き出しは、ffmpeg の圧縮に時間がかかるので 107 秒 → 89 秒。
- 両方のページで同じだった、マウス追従・5×5 の向き・自動まばたきの計算を、`src/motion.js` にまとめ、検査（`tests/motion.test.mjs`、`npm test`）を足した。
- 調整パネルの部品（`src/tweaks-panel.jsx`）を、`window` に置かず、使う側が import するようにした（HTML の読み込みが 1 つ減り、使っていない部品がビルドから消えた）。`start.bat` は `npm run dev` で起動する（`node_modules` が欠けていた時に、`npx` が最新の vite を取ってこないように）。
- React を 18.3.1 から 19.3.1 に上げた（react・react-dom）。コードの変更は無し。React を含むファイルは、圧縮して約 50KB → 約 73KB。
- `npm run preview` が、ベースパス（`/tomari-guruguru/`）の外の `/talk.html` を開いて 404 になっていた → ベースパスの下の `talk.html` を開く。
- 公開用のビルドの検査（`scripts/verify-pages-build.mjs`）が `slices2`・`webp` を決め打ちしていて、`src/character-config.js` の `basePath` を変えても、古い `slices2` を見て合格にしていた → `character-config.js` を読んで確かめる。
- 新キャラの手順書: 生成のコマンドは `public/slices2` に上書きするので `basePath` は変えなくてよいこと、別のフォルダにする時は `.gitignore` も直すこと、確認の URL を `127.0.0.1` に。README: 構成図に `src/audio-engine.js`・`tests/`、新キャラの道具に要る物。SECURITY.md: 調整パネルのやり取りの説明を、実際に合わせた。

The character sheet tool now scans pixels with `bytes.translate` and `find` per row instead of a Python call per pixel, with the same results; on six test sheets, lossless output went from 29 s to 10 s and `--no-component-mode` from 49 s to 9 s (the default lossy output, which is mostly ffmpeg compression, from 107 s to 89 s). The pointer following, 5×5 direction and auto-blink code that both pages repeated now lives in `src/motion.js`, with tests (`tests/motion.test.mjs`, `npm test`). The Tweaks controls are now imported as ES modules instead of being put on `window` (one script tag less, and unused controls are left out of the build), and `start.bat` starts the server with `npm run dev` so that `npx` never fetches an unpinned vite. React is now 19.3.1 (was 18.3.1), with no code changes; the bundle that contains React grew from about 50 KB to about 73 KB gzipped. `npm run preview` opened `/talk.html` outside the base path (a 404); it now opens `talk.html` under `/tomari-guruguru/`. The Pages build check reads `basePath` and `ext` from `src/character-config.js` instead of always checking `slices2` (which let a changed `basePath` pass). The new-character guide now says that the generation command overwrites `public/slices2` (so `basePath` can stay), that another folder also needs a `.gitignore` entry, and uses `127.0.0.1`; the README lists `src/audio-engine.js`, `tests/` and the tool's requirements; SECURITY.md describes the Tweaks messages as they work.

## v1.0.0 - 2026-11-28

### セキュリティ / Security

- 開発用の依存の脆弱性を直した: vite 8.4.0・@vitejs/plugin-react 6.3.0・postcss 8.5.34・source-map-js 1.2.4（どれも開発とビルドの時だけに使う物で、公開しているページには入らない）。
- GitHub Pages に公開するワークフローを堅くした: ビルドする仕事は読み取りの権限だけにし、公開の権限は公開する仕事だけに渡す。Actions をコミットの SHA で固定。ビルドのたびに `npm audit` で調べる。

### そのほか / Other

- `ASSET_LICENSE.md` の、対象の素材の置き場所の例を今の場所（`public/slices2/`・`docs/`）に合わせ、`guruguru.gif` を足し、権利者（ろてじん）を書いた。条件は変えていない。
- セキュリティポリシー・サポートの案内・開発への参加の案内・Issue と Pull Request のテンプレート・Dependabot・`.editorconfig` を足した。

Fixed vulnerabilities in the development dependencies (vite 8.4.0, @vitejs/plugin-react 6.3.0, postcss 8.5.34, source-map-js 1.2.4; none of them is part of the published page). Hardened the GitHub Pages workflow: the build job is read-only, only the deploy job may publish, actions are pinned by commit SHA, and `npm audit` runs on every build. Updated the asset paths in `ASSET_LICENSE.md` to the current locations and named the rights holder (the terms are unchanged). Added the security policy, support and contributing guides, issue and pull request templates, Dependabot and `.editorconfig`.

## 2026-06-14

- 最初の公開。Vite 8 + React 18 に移行し、GitHub Pages（<https://rotejin.github.io/tomari-guruguru/>）で公開した。 / First public release, moved to Vite 8 + React 18 and published on GitHub Pages.
