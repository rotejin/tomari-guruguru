# セキュリティポリシー / Security Policy

## 対象のバージョン

`main` ブランチと、GitHub Pages で公開しているページ（<https://rotejin.github.io/tomari-guruguru/>）を対象に修正します。

## 脆弱性の報告

**脆弱性の詳しい内容を、公開の Issue に書かないでください。**

このリポジトリの **Security** タブ → **Report a vulnerability** から、非公開で報告してください（GitHub の Private vulnerability reporting）。

この方法が使えない場合は、作者の X（[@rotejin](https://x.com/rotejin)）に DM で連絡してください。

書いてほしいこと:

- 影響のあるファイルや機能
- 再現の手順
- 期待した動作と、実際の動作
- OS と、ブラウザのバージョン

## この仕組みの作り（安全面）

### ページ（`talk.html`・`guruguru.html`・`src/`）

- **外へ通信するのは、Google Fonts（Zen Maru Gothic）の読み込みだけです。** そのほかは、同じ場所に置いた画像とスクリプトだけを読み込みます。
- **マイク**の音は、ブラウザの中で音の大きさを測るためだけに使います。録音・保存・送信はしません。音を取り込むのは、「マイク開始」を押してから「マイク停止」を押すまでの間だけです。
- **音声ファイル**は、自分で選んだファイルを、ブラウザの中で再生するだけです。送信はしません。
- ブラウザに保存する物はありません（Cookie・localStorage を使いません）。
- 調整パネル（Tweaks）は、画面の設定の値（色・大きさ・感度など）を親のページに送ります。ほかのページに届くのは、このページがほかのページに埋め込まれている時だけです。ほかのページ（埋め込んだページや、このページを開いたページ）から受け取って変わるのは、パネルの開け閉めだけです。

### 手元の開発用サーバー（`start.bat`・`npm run dev`）

- Vite の開発用サーバーを、**この PC の中（127.0.0.1）からだけ**つながる形で起動します（`vite.config.js` の `server.host`）。
- `server.host` を `true` や `0.0.0.0` に変えると、同じネットワークのほかの機器から開発用サーバーに届くようになります。変えないでください。

### ビルドと公開（GitHub Actions）

- 依存のパッケージは `package-lock.json` で固定し、`npm ci` で入れます。ビルドのたびに `npm audit` で、既知の脆弱性がないかを調べます。
- ビルドする仕事は読み取りの権限だけで動き、GitHub Pages に公開する権限は、公開する仕事だけが持ちます。Actions は、コミットの SHA で固定しています。
- 依存はどれも、開発とビルドの時だけに使う物と、ページに入る React だけです。

### 自分のキャラクターを作る道具（`tools/slice_character_sheets.py`）

- 手元で、自分で用意したシート画像を切り分けるための道具です。`ffmpeg`・`ffprobe` を、シェルを通さずに起動します。通信はしません。

## English

Please do not post vulnerability details in public issues. Use **Security → Report a vulnerability** (GitHub private vulnerability reporting) in this repository. If that is not possible, send a direct message to [@rotejin](https://x.com/rotejin) on X.

The pages connect only to Google Fonts (Zen Maru Gothic); everything else is loaded from the same site. Microphone audio is used only inside the browser to measure volume; it is never recorded, stored or uploaded, and it is captured only between "マイク開始" (start) and "マイク停止" (stop). Audio files you choose are played in the browser only. Nothing is saved in the browser. The Tweaks panel posts its display settings (colors, sizes, sensitivity) to the parent page, which reaches another page only when this page is embedded; messages from other pages (an embedding page or the page that opened this one) can only open or close the panel. The local development server (`start.bat`, `npm run dev`) listens on 127.0.0.1 only; do not change `server.host` in `vite.config.js`. Dependencies are pinned in `package-lock.json`, installed with `npm ci` and checked with `npm audit` on every build; the build job is read-only and only the deploy job may publish to GitHub Pages, with actions pinned by commit SHA. `tools/slice_character_sheets.py` runs `ffmpeg` and `ffprobe` locally without a shell and makes no network connections.
