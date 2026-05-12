/**
 * Xray 테스트 공통 유틸리티
 * Puppeteer 기반 CBCT Viewer 자동화 테스트
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5175';
const SCREENSHOT_DIR = 'tests/xray/screenshots';

export async function launchBrowser(viewport = { width: 1440, height: 900 }) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle'],
    defaultViewport: viewport,
  });
  const page = await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
  return { browser, page };
}

export async function loadDICOM(page, fileCount = 200) {
  // public/dicom-test/의 파일을 HTTP fetch로 로드
  const files = [];
  for (let i = 1; i <= fileCount; i++) {
    files.push(`/dicom-test/IM_${String(i).padStart(4, '0')}.dcm`);
  }

  await page.evaluate(async (fileList) => {
    const fileObjects = [];
    for (const p of fileList) {
      try {
        const resp = await fetch(p);
        if (!resp.ok) continue;
        const blob = await resp.blob();
        fileObjects.push(new File([blob], p.split('/').pop(), { type: 'application/dicom' }));
      } catch (e) { continue; }
    }
    if (fileObjects.length === 0) return 0;

    const dt = new DataTransfer();
    for (const f of fileObjects) dt.items.add(f);
    const input = document.getElementById('file-input');
    if (input) {
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    }
    return fileObjects.length;
  }, files);

  // 로딩 완료 대기
  try {
    await page.waitForFunction(
      () => !document.getElementById('loading')?.classList.contains('active'),
      { timeout: 120000 }
    );
  } catch (e) {
    // 로딩 타임아웃 - 계속 진행
  }
}

export async function waitForVolumeLoaded(page, timeout = 120000) {
  await page.waitForFunction(
    () => !document.getElementById('loading')?.classList.contains('active'),
    { timeout }
  );
}

export async function takeScreenshot(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath });
  return filePath;
}

export function result(testKey, status, comment = '') {
  return { testKey, status, comment };
}

export async function safeTest(key, name, testFn) {
  try {
    const res = await testFn();
    console.log(`${res.status === 'PASSED' ? 'PASS' : 'FAIL'}: ${key} - ${name}`);
    return res;
  } catch (e) {
    console.log(`FAIL: ${key} - ${name} | ${e.message}`);
    return { key, status: 'FAILED', comment: e.message.slice(0, 200) };
  }
}
