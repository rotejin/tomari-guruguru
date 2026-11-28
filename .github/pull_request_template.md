## 変更の内容 / Summary

<!-- 何を、なぜ変えたか / What changed and why -->

関連する Issue / Related issue: #

## 確認したこと / Checklist

- [ ] `npm run build` と `npm run verify:pages` が通り、`npm audit` に脆弱性が出なかった / Build, Pages verification and `npm audit` pass
- [ ] 画面や動きを変えた場合、`talk.html`・`guruguru.html` で、マイク・音声ファイル・マウス追従を確かめた / For UI or behaviour changes, tried the microphone, an audio file and mouse following
- [ ] 依存パッケージを変えた場合、`package.json` と `package-lock.json` の両方を含めた / For dependency changes, both `package.json` and `package-lock.json` are included
- [ ] 開発用サーバーの待ち受け先（`server.host: '127.0.0.1'`）を変えていない / Did not change where the development server listens
- [ ] 外のサイトからの読み込みを足していない / No new loads from other sites
- [ ] トマリの画像・音声の変更を含まない / No changes to Tomari's images or audio
- [ ] 送った内容が MIT License で公開されることに同意する / I agree that this contribution is published under the MIT License
