import { mkdir } from 'node:fs/promises';
import asc from 'assemblyscript/asc';

const outputDirectory = new URL('../src/cpr/generated/', import.meta.url);
const outputFile = new URL('cpr.wasm', outputDirectory);

await mkdir(outputDirectory, { recursive: true });

const { error, stderr } = await asc.main([
  'assembly/cpr.ts',
  '--config',
  'ascconfig.json',
  '--outFile',
  outputFile.pathname,
  '--optimize',
  '--bindings',
  'esm',
  '--exportRuntime',
]);

if (error) {
  process.stderr.write(stderr.toString());
  throw error;
}
