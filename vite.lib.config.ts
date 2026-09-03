import { defineConfig, type Plugin } from 'vite';

/**
 * Repoints runtime asset URLs for the packaged library:
 * - The default worker factory must load the bundled `dist/cpr-worker.js`
 *   instead of the TypeScript source used in development.
 * - The generated WASM bindings must keep `new URL("cpr.wasm", import.meta.url)`
 *   so the packaged entry resolves `dist/cpr.wasm` at runtime instead of
 *   letting Vite inline the binary as a data URL.
 *
 * Both replacements deliberately break Vite's static `new Worker(new URL(...))`
 * and `new URL('literal', import.meta.url)` detection so the lib build emits
 * runtime-resolved URLs.
 */
function repackageCprUrls(): Plugin {
  return {
    name: 'cpr:repackage-urls',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('src/cpr/worker-engine.ts')) {
        const original =
          "const worker = new Worker(new URL('./cpr-worker.ts', import.meta.url), { type: 'module' });";
        if (!code.includes(original)) {
          this.error('worker-engine.ts no longer constructs the default worker inline');
        }
        const rewritten = code.replace(
          original,
          'const worker = new Worker(bundledCprWorkerUrl(), { type: \'module\' });',
        );
        return `${rewritten}\nfunction bundledCprWorkerUrl(): URL {\n`
          + "  return new URL('./cpr-' + 'worker.js', import.meta.url);\n}\n";
      }
      if (id.includes('src/cpr/generated/cpr.js')) {
        const original = 'new URL("cpr.wasm", import.meta.url)';
        if (!code.includes(original)) {
          this.error('generated cpr.js no longer resolves cpr.wasm relative to itself');
        }
        return code.replace(
          original,
          'new URL("cpr.wasm" /* resolved next to this chunk */, import.meta.url)',
        );
      }
      return undefined;
    },
  };
}

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
