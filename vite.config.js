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
