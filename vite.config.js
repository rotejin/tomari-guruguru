import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// フォント（Zen Maru Gothic、SIL OFL 1.1。@fontsource/zen-maru-gothic）を、自分のサイトから配るための手当て。
// （前は Google Fonts から読み、ページを開いた人の IP が Google に伝わっていた）
function selfHostedFont() {
  const license = resolve(import.meta.dirname, 'node_modules/@fontsource/zen-maru-gothic/LICENSE');
  return {
    name: 'tomari-self-hosted-font',
    enforce: 'pre',
    // Fontsource の CSS は、woff2 と woff を並べて書いている。今のブラウザは woff2 だけを使うので、
    // woff は外す（外さないと、使われない woff が 8MB ほど公開物に入る）。
    transform(code, id) {
      if (!/[\\/]@fontsource[\\/]zen-maru-gothic[\\/][^\\/]+\.css$/.test(id.split('?')[0])) return null;
      return { code: code.replace(/,\s*url\([^)]+\.woff\)\s*format\('woff'\)/g, ''), map: null };
    },
    // フォントを配るので、ライセンスの文（著作権の表示を含む）を、同じ所に置く（OFL の条件）
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'licenses/zen-maru-gothic-OFL.txt', source: readFileSync(license, 'utf8') });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/tomari-guruguru/' : '/',
  plugins: [selfHostedFont(), react()],
  server: {
    host: '127.0.0.1',
    open: '/talk.html',
  },
  preview: {
    // 書かないと server.open（'/talk.html'）を引き継ぎ、ベースパス（/tomari-guruguru/）の
    // 外を開いて 404 になる。相対で書くと、ベースパスの下の talk.html を開く。
    open: 'talk.html',
  },
  build: {
    // 小さなフォントのファイルを CSS に埋め込まない（埋め込むと、使わない文字の分まで、
    // 毎回 CSS と一緒に読むことになる。フォントは、要る文字の分だけ別に読ませる）
    assetsInlineLimit: (file) => (file.endsWith('.woff2') ? false : undefined),
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        guruguru: resolve(import.meta.dirname, 'guruguru.html'),
        talk: resolve(import.meta.dirname, 'talk.html'),
      },
    },
  },
}));
