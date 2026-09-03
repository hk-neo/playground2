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
 *
 * Shared by `vite.lib.config.ts` (package build) and
 * `scripts/benchmark-cpr.mjs` (Node benchmark bundle). Both guards call
 * `this.error` so any drift in the replaced source fails the build loudly.
 */
export function repackageCprUrls() {
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
