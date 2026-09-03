import { defineConfig } from 'vite';
import { repackageCprUrls } from './scripts/repackage-cpr-urls.mjs';

export default defineConfig({
  plugins: [repackageCprUrls()],
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    minify: false,
    sourcemap: false,
    lib: {
      entry: {
        index: 'src/cpr/index.ts',
        'cpr-worker': 'src/cpr/cpr-worker.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [/^node:/],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
      },
    },
  },
});
