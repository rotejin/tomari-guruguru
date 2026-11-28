# 変更履歴 / Changelog

このリポジトリの主な変更を記録します。
Notable changes to this repository are recorded here.

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
