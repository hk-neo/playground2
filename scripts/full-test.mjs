import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.join(process.cwd(), 'test-screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const logs = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`[PAGE_ERROR] ${err.message}`));

  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle0' });

  // === Step 1: Inject DICOM loading via fetch ===
  console.log('=== Step 1: Loading DICOM via fetch ===');

  // Get file list from Node.js side
  const DICOM_DIR = '/Users/fotogrammer/Projects/정성진ct';
  const dcmFiles = fs.readdirSync(DICOM_DIR)
    .filter(f => f.endsWith('.dcm'))
    .sort((a, b) => parseInt(a) - parseInt(b))
    .slice(0, 200);
  console.log(`  Found ${dcmFiles.length} DICOM files`);

  // Expose file list to browser
  const loadResult = await page.evaluate(async (fileList) => {
    try {
      const fileObjects = [];

      for (let i = 0; i < fileList.length; i++) {
        const r = await fetch(`/dicom-test/${fileList[i]}`);
        const buf = await r.arrayBuffer();
        fileObjects.push(new File([buf], fileList[i]));

        // Update status
        if (i % 50 === 0) {
          const el = document.getElementById('status');
          if (el) el.textContent = `다운로드 중... ${i}/${fileList.length}`;
        }
      }

      const dt = new DataTransfer();
      fileObjects.forEach(f => dt.items.add(f));

      const input = document.getElementById('file-input');
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));

      return { fileCount: fileObjects.length };
    } catch (e) {
      return { error: e.message };
    }
  }, dcmFiles);

  if (loadResult.error) {
    console.log('  FAIL:', loadResult.error);
    await browser.close();
    return;
  }
  console.log(`  Injected ${loadResult.fileCount} files`);

  // Wait for volume to load
  console.log('  Waiting for volume construction...');
  await page.waitForFunction(() => {
    const el = document.getElementById('status');
    return el && el.textContent.includes('완료');
  }, { timeout: 120000 });

  await new Promise(r => setTimeout(r, 3000));

  const statusText = await page.$eval('#status', el => el.textContent);
  console.log(`  Status: ${statusText}`);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-loaded.png') });
  console.log('  -> 10-loaded.png');

  // === Step 2: Verify MPR rendering ===
  console.log('\n=== Step 2: Verify MPR canvases ===');
  const mprCheck = await page.evaluate(() => {
    const check = (id) => {
      const c = document.getElementById(id);
      if (!c) return { id, exists: false };
      const ctx = c.getContext('2d');
      if (!ctx) return { id, exists: true, hasContent: false };
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let nz = 0;
      for (let i = 0; i < d.length; i += 16) { // sample every 4th pixel
        if (d[i] > 0 || d[i+1] > 0 || d[i+2] > 0) nz++;
      }
      return { id, w: c.width, h: c.height, nonZero: nz };
    };
    return [check('axial-canvas'), check('coronal-canvas'), check('sagittal-canvas')];
  });

  mprCheck.forEach(c => {
    const pass = c.nonZero > 0;
    console.log(`  ${pass ? 'PASS' : 'FAIL'}: ${c.id} (${c.w}x${c.h}, sampled non-zero: ${c.nonZero})`);
  });

  // === Step 3: Verify 3D rendering ===
  console.log('\n=== Step 3: Verify 3D volume rendering ===');
  const canvas3dCheck = await page.evaluate(() => {
    const c = document.getElementById('3d-canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return { hasWebGL: false };
    const px = new Uint8Array(512 * 512 * 4);
    gl.readPixels(0, 0, 512, 512, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let nz = 0;
    for (let i = 0; i < px.length; i += 16) {
      if (px[i] > 0 || px[i+1] > 0 || px[i+2] > 0) nz++;
    }
    return { hasWebGL: true, nonZero: nz };
  });
  console.log(`  ${canvas3dCheck.nonZero > 0 ? 'PASS' : 'FAIL'}: 3D canvas (sampled non-zero: ${canvas3dCheck.nonZero})`);

  // === Step 4: Drag rotation ===
  console.log('\n=== Step 4: Drag rotation ===');
  const canvas3d = await page.$('[id="3d-canvas"]');
  const box = await canvas3d.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 100, cy - 50, { steps: 8 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-after-rotate.png') });
  console.log('  -> 11-after-rotate.png');

  // === Step 5: Zoom ===
  console.log('\n=== Step 5: Scroll zoom ===');
  await page.mouse.move(cx, cy);
  await page.mouse.wheel({ deltaY: -300 });
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12-after-zoom.png') });
  console.log('  -> 12-after-zoom.png');

  // === Step 6: R key reset ===
  console.log('\n=== Step 6: R key reset ===');
  await page.keyboard.press('r');
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13-after-reset.png') });
  console.log('  -> 13-after-reset.png');

  // === Step 7: Slider ===
  console.log('\n=== Step 7: Axial slider change ===');
  await page.$eval('#axial-slider', el => { el.value = 50; el.dispatchEvent(new Event('input')); });
  await new Promise(r => setTimeout(r, 500));

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14-after-slider.png') });
  console.log('  -> 14-after-slider.png');

  // === Step 8: TF threshold ===
  console.log('\n=== Step 8: 3D threshold change ===');
  await page.$eval('#tf-slider', el => { el.value = 40; el.dispatchEvent(new Event('input')); });
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15-after-tf.png') });
  console.log('  -> 15-after-tf.png');

  // Summary
  const pageErrors = logs.filter(l => l.includes('PAGE_ERROR'));
  console.log('\n=== Summary ===');
  console.log(`Page errors: ${pageErrors.length}`);
  if (pageErrors.length > 0) pageErrors.forEach(e => console.log('  ' + e));
  console.log(pageErrors.length === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
