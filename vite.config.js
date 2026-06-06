import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/brower-barcode2sheet/' : '/',
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
