import { defineConfig } from 'vite';
import { resolve } from 'path';
import { localApiPlugin } from './server/vite-plugin-local-api.js';

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
  plugins: process.env.LOCAL_SERVER ? [localApiPlugin()] : [],
  server: {
    host: process.env.LOCAL_SERVER ? '0.0.0.0' : true,
  },
  test: {
    environment: 'jsdom',
    include: ['../tests/**/*.test.js'],
  },
});
