import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/tomari-guruguru/' : '/',
  plugins: [react()],
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
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        guruguru: resolve(import.meta.dirname, 'guruguru.html'),
        talk: resolve(import.meta.dirname, 'talk.html'),
      },
    },
  },
}));
