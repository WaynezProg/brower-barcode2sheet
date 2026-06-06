import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'web',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'web/src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['../tests/**/*.test.js'],
  },
});
