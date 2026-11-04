import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/case-bearing-demo/',
  plugins: [svelte()],
  worker: { format: 'es' },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      // independent pages: the bearing case study, the Signals & Data lab and the sensor-fusion lab
      input: {
        main: resolve(__dirname, 'index.html'),
        signals: resolve(__dirname, 'signals/index.html'),
        fusion: resolve(__dirname, 'fusion/index.html'),
      },
    },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
