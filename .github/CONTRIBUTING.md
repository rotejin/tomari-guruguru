# 開発への参加 / Contributing

> English follows the Japanese.

不具合の報告や改善の提案を歓迎します。個人で作っているプロジェクトのため、返事や取り込みは できる範囲で行います。

## Issue

- 不具合・要望は、[Issue のテンプレート](https://github.com/rotejin/tomari-guruguru/issues/new/choose) から書いてください（書いてほしいことは [SUPPORT.md](SUPPORT.md)）。
- 脆弱性は公開の Issue に書かず、[SECURITY.md](SECURITY.md) の方法で報告してください。

## Pull Request

大きな変更は、先に Issue で相談してください。小さな修正（誤字、文書の改善、明らかな不具合の修正）はそのまま送ってかまいません。

送る前に確かめてほしいこと:

- `npm ci` のあと、`npm test`・`npm run build`・`npm run verify:pages` が通る。`npm audit` に既知の脆弱性が出ない。
- 画面や動きを変えたら、`npm run dev` で `talk.html`・`guruguru.html` を開いて確かめる（マイク・音声ファイル・マウス追従・まばたき）。
- 依存パッケージを変えたら、`package.json` と `package-lock.json` の両方を送る。
- **開発用サーバーの待ち受け先（`vite.config.js` の `server.host: '127.0.0.1'`）は変えない。** 変えると、同じネットワークのほかの機器から届くようになります。
- 外のサイトからの読み込みを増やさない（今は Google Fonts だけです）。

## 画像・音声について

- 不具合の説明のために、スクリーンショットを添えるのはかまいません。他人のキャラクターや、使ってよいか分からない画像は含めないでください。
- トマリの画像（`public/slices2/` など）・音声を変える Pull Request は、受け付けていません。トマリの画像・音声は MIT License の対象外です（[ASSET_LICENSE.md](../ASSET_LICENSE.md)）。

## ライセンス

送ってもらったコード・文書は、このリポジトリと同じ [MIT License](../LICENSE) で公開されます。

---

## English

Bug reports and suggestions are welcome. This is a personal project, so replies and merges are best-effort.

### Issues

- Use the [issue templates](https://github.com/rotejin/tomari-guruguru/issues/new/choose) for bugs and feature requests ([SUPPORT.md](SUPPORT.md) lists what to include).
- Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md), not in public issues.

### Pull requests

Please open an issue first for larger changes. Small fixes (typos, documentation, obvious bugs) can be sent directly.

Before sending:

- After `npm ci`, `npm test`, `npm run build` and `npm run verify:pages` pass and `npm audit` reports no known vulnerabilities.
- If you changed the UI or behaviour, open `talk.html` and `guruguru.html` with `npm run dev` and try the microphone, an audio file, mouse following and blinking.
- If you changed dependencies, send both `package.json` and `package-lock.json`.
- **Do not change where the development server listens (`server.host: '127.0.0.1'` in `vite.config.js`).** Otherwise other devices on the same network can reach it.
- Do not add loads from other sites (Google Fonts is the only one).

### Images and audio

- Screenshots that explain a bug are fine. Do not include other people's characters or images you may not share.
- Pull requests that change Tomari's images (such as `public/slices2/`) or audio are not accepted. They are not covered by the MIT License ([ASSET_LICENSE.md](../ASSET_LICENSE.md)).

### License

Code and documents you contribute are published under the same [MIT License](../LICENSE) as this repository.
