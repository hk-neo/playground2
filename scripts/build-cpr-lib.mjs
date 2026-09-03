import { execFileSync } from 'node:child_process';
import { copyFile, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rootUrl = new URL('../', import.meta.url);
const rootDir = fileURLToPath(rootUrl);
const distUrl = new URL('dist/', rootUrl);
const generatedWasmUrl = new URL('src/cpr/generated/cpr.wasm', rootUrl);

if (!existsSync(fileURLToPath(generatedWasmUrl))) {
  console.error(
    'src/cpr/generated/cpr.wasm is missing. Run "npm run build:wasm" first: '
    + 'the AssemblyScript kernel is compiled locally and is not checked into git.',
  );
  process.exit(1);
}

console.log('[build:lib] bundling ESM entry + worker (vite lib mode)');
const { build } = await import('vite');
await build({ configFile: fileURLToPath(new URL('vite.lib.config.ts', rootUrl)), mode: 'production' });

console.log('[build:lib] emitting type declarations (tsc)');
execFileSync('npx', ['tsc', '-p', 'tsconfig.lib.json'], { cwd: rootDir, stdio: 'inherit' });

console.log('[build:lib] writing dist/index.d.ts shim');
await writeFile(
  new URL('index.d.ts', distUrl),
  "export * from './cpr/index';\n",
  'utf8',
);

console.log('[build:lib] copying cpr.wasm into dist');
await copyFile(generatedWasmUrl, new URL('cpr.wasm', distUrl));

const distFiles = await readdir(fileURLToPath(distUrl));
for (const required of ['index.js', 'index.d.ts', 'cpr.wasm', 'cpr-worker.js']) {
  if (!distFiles.includes(required)) {
    console.error(`[build:lib] expected dist/${required} was not produced`);
    process.exit(1);
  }
}

let wasmLoaderFile;
let workerUrlFile;
for (const file of distFiles.filter((name) => name.endsWith('.js'))) {
  const source = await readFile(new URL(file, distUrl), 'utf8');
  if (source.includes("'./cpr-worker.ts'") || source.includes('"./cpr-worker.ts"')) {
    console.error(`[build:lib] dist/${file} still references the TypeScript worker source`);
    process.exit(1);
  }
  if (source.includes('data:video/mp2t') || source.includes('data:text/typescript')) {
    console.error(`[build:lib] dist/${file} inlined the worker source as a data URL`);
    process.exit(1);
  }
  if (source.includes('data:application/wasm;base64')) {
    console.error(`[build:lib] dist/${file} inlined the wasm binary as a data URL`);
    process.exit(1);
  }
  if (source.includes('new Worker') && source.includes('worker.js') && source.includes('import.meta.url')) {
    workerUrlFile = file;
  }
  if (source.includes('"cpr.wasm"') && source.includes('import.meta.url')) {
    wasmLoaderFile = file;
  }
}
if (!workerUrlFile) {
  console.error('[build:lib] no dist chunk references the bundled ./cpr-worker.js');
  process.exit(1);
}
if (workerUrlFile.includes('/')) {
  console.error(`[build:lib] worker reference in ${workerUrlFile} must sit next to dist/cpr-worker.js`);
  process.exit(1);
}
if (!wasmLoaderFile) {
  console.error('[build:lib] no dist chunk resolves cpr.wasm relative to itself');
  process.exit(1);
}
if (wasmLoaderFile.includes('/')) {
  console.error(`[build:lib] wasm loader chunk ${wasmLoaderFile} must sit next to dist/cpr.wasm`);
  process.exit(1);
}

console.log(`[build:lib] done: ${distFiles.sort().join(', ')}`);
