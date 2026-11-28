# 変更履歴 / Changelog

このリポジトリの主な変更を記録します。
Notable changes to this repository are recorded here.

## Unreleased

### 修正 / Fixed

- トーク版で、「マイク開始」をマイクの許可を待つ間にもう一度押すと、マイクを 2 本取り、1 本目が「マイク停止」でも止まらず録音が続いていた。今は、許可を待つ間はボタンを無効にし、始めている途中の 2 回目は何もしない。許可の後の準備で失敗した時も、取ったマイクを止める。
- 音声エンジンを `src/audio-engine.js` に分け、マイクの開始・停止の検査（`npm test`、node だけで動く）を足した。公開のワークフローでも、ビルドの前に走らせる。
- トーク版で、音声ファイルの再生バーが右下の Tweaks のボタンに重なり、パネルを開くと隠れていた（幅が狭いと、中央の操作バーにも重なっていた）。今は、操作バーのすぐ上の中央に出す。マイクのエラーの文は、その上に出す。
- トーク版で、音声ファイルを選び直しても、前のファイルの URL を放していなかった（ページを閉じるまでメモリに残っていた）。
- ぐるぐる版で、向きごとに最初のまばたきが抜けていた（目閉じの絵を、まばたきの時に初めて読み込んでいたため、間に合わなかった）。今は、目閉じの 25 枚も最初に読み込んでおく。

In the talk page, pressing "マイク開始" again while the browser was still asking for microphone access opened a second microphone stream, and the first one kept recording even after "マイク停止". The button is now disabled while waiting, a second start is ignored, and a stream is stopped if setting it up fails. The audio engine now lives in `src/audio-engine.js`, with microphone start/stop tests (`npm test`, node only) that also run in the Pages workflow before the build.

In the talk page, the audio file player sat in the bottom-right corner under the Tweaks button and was hidden when the panel was open (and on narrow windows it also covered the control bar). It is now centered just above the control bar, with the microphone error message above it. Choosing another audio file now releases the object URL of the previous one.

In the guruguru page, the first blink in each direction was often missing, because the eyes-closed image was only loaded when the blink started. The 25 eyes-closed images are now loaded up front.

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
