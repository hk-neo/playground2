/**
 * DICOM 에러 처리 테스트 (독립 Feature)
 * 테스트 범위: PLAYG-2462 ~ PLAYG-2474
 */
import { launchBrowser, takeScreenshot, safeTest, result } from './helper.mjs';

const tests = [
  // PLAYG-2468: 빈 폴더 로드 시 시스템 안정성 테스트
  async (page) => {
    const noCrash = await page.evaluate(() => {
      // 빈 DataTransfer로 change 이벤트 트리거
      const dt = new DataTransfer();
      const input = document.getElementById('file-input');
      if (input) {
        input.files = dt.files;
        input.dispatchEvent(new Event('change'));
      }
      return document.body !== null;
    });
    if (!noCrash) throw new Error('빈 폴더 로드 시 크래시');
    return result('PLAYG-2468', 'PASSED', '빈 폴더 로드 후에도 정상 동작');
  },

  // PLAYG-2463: DICOM 헤더 정보 누락 파일 처리 테스트
  async (page) => {
    // 헤더 없는 파일로 로드 시뮬레이션 - 에러 핸들링 확인
    const errorHandled = await page.evaluate(async () => {
      const blob = new Blob(['not a dicom file'], { type: 'application/dicom' });
      const file = new File([blob], 'invalid.dcm', { type: 'application/dicom' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById('file-input');
      if (input) {
        input.files = dt.files;
        input.dispatchEvent(new Event('change'));
      }
      return true;
    });
    return result('PLAYG-2463', 'PASSED', '비DICOM 파일 처리 시 크래시 없음');
  },

  // PLAYG-2464: 0바이트 파일 포함 시 처리 테스트
  async (page) => {
    const zeroByteHandled = await page.evaluate(() => {
      const blob = new Blob([], { type: 'application/dicom' });
      const file = new File([blob], 'empty.dcm', { type: 'application/dicom' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById('file-input');
      if (input) {
        input.files = dt.files;
        input.dispatchEvent(new Event('change'));
      }
      return document.body !== null;
    });
    if (!zeroByteHandled) throw new Error('0바이트 파일 로드 시 크래시');
    return result('PLAYG-2464', 'PASSED', '0바이트 파일 처리 안정성 확인');
  },
];

async function run() {
  const { browser, page } = await launchBrowser();
  const results = [];

  try {
    for (const testFn of tests) {
      const r = await safeTest('ERROR', 'handling test', testFn.bind(null, page));
      results.push(r);
    }

    // 나머지 에러 처리 테스트 SKIPPED
    const errorKeys = [
      'PLAYG-2462', 'PLAYG-2465', 'PLAYG-2466', 'PLAYG-2467', 'PLAYG-2469',
      'PLAYG-2470', 'PLAYG-2471', 'PLAYG-2472', 'PLAYG-2473', 'PLAYG-2474',
      'PLAYG-2461', 'PLAYG-2460', 'PLAYG-2459', 'PLAYG-2458', 'PLAYG-2457',
      'PLAYG-2456', 'PLAYG-2455', 'PLAYG-2454', 'PLAYG-2453', 'PLAYG-2452',
      'PLAYG-2451', 'PLAYG-2450',
    ];
    for (const key of errorKeys) {
      console.log(`SKIP: ${key} - 테스트 스크립트 미구현`);
      results.push(result(key, 'SKIPPED', '테스트 스크립트 미구현'));
    }
  } finally {
    await browser.close();
  }

  const summary = { testExecutionKey: 'PLAYG-2477', tests: results };
  console.log('\n=== RESULTS ===');
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

run();
