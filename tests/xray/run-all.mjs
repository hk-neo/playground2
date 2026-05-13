/**
 * Xray Test Execution 마스터 러너
 * 모든 카테고리 테스트를 실행하고 통합 결과를 출력
 *
 * 사용법: node tests/xray/run-all.mjs [--execution PLAYG-XXXX]
 */
import { execSync } from 'child_process';
import fs from 'fs';

const executionKey = process.argv.find(a => a.startsWith('PLAYG')) || 'PLAYG-2477';

const testFiles = [
  'tests/xray/dicom-load.mjs',
  'tests/xray/ui-shell.mjs',
  'tests/xray/new-tests.mjs',
  'tests/xray/extra-tests.mjs',
];

const allResults = [];

for (const file of testFiles) {
  if (!fs.existsSync(file)) {
    console.log(`SKIP: ${file} not found`);
    continue;
  }
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Running: ${file}`);
  console.log('='.repeat(50));

  try {
    const output = execSync(`node ${file}`, { timeout: 180000, encoding: 'utf-8' });
    console.log(output);

    // Parse RESULTS section
    const match = output.match(/=== RESULTS ===\n([\s\S]*)$/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (parsed.tests) allResults.push(...parsed.tests);
      } catch (e) {
        console.log(`Warning: could not parse results from ${file}`);
      }
    }
  } catch (e) {
    console.log(`FAIL: ${file} - ${e.message.slice(0, 200)}`);
  }
}

// Summary
const passed = allResults.filter(r => r.status === 'PASSED').length;
const failed = allResults.filter(r => r.status === 'FAILED').length;
const skipped = allResults.filter(r => r.status === 'SKIPPED').length;

console.log(`\n${'='.repeat(50)}`);
console.log(`TEST EXECUTION SUMMARY: ${executionKey}`);
console.log('='.repeat(50));
console.log(`PASSED:  ${passed}`);
console.log(`FAILED:  ${failed}`);
console.log(`SKIPPED: ${skipped}`);
console.log(`TOTAL:   ${allResults.length}`);

// Output Xray import format
const xrayPayload = JSON.stringify({
  testExecutionKey: executionKey,
  tests: allResults,
}, null, 2);

const resultFile = `tests/xray/results-${executionKey}.json`;
fs.writeFileSync(resultFile, xrayPayload);
console.log(`\nResults saved: ${resultFile}`);
console.log('\nImport to Xray:');
console.log(`python3 AutoDevAgent/goose_assets/runner/xray_toolkit.py import_results --results-file ${resultFile}`);
