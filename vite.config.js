import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        guruguru: resolve(import.meta.dirname, 'トマリぐるぐる.html'),
        talk: resolve(import.meta.dirname, 'トマリトーク.html'),
      },
    },
  },
});
