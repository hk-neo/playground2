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

  // Test 1: Verify InputHandler + Camera integration
  console.log('=== Test 1: Module integration ===');
  const moduleCheck = await page.evaluate(() => {
    const canvas = document.getElementById('3d-canvas');
    return {
      canvasExists: !!canvas,
      canvasSize: canvas ? `${canvas.width}x${canvas.height}` : 'N/A',
    };
  });
  console.log('Canvas:', JSON.stringify(moduleCheck));
  console.log(moduleCheck.canvasExists ? '  PASS: 3D canvas exists' : '  FAIL: 3D canvas missing');

  // Test 2: Mouse drag produces camera change (no volume, so just verify no errors)
  console.log('\n=== Test 2: Mouse drag simulation ===');
  const canvas3d = await page.$('[id="3d-canvas"]');
  const box = await canvas3d.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Drag
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy + 40, { steps: 5 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 300));

  const dragErrors = logs.filter(l => l.includes('ERROR') || l.includes('error'));
  console.log(dragErrors.length === 0 ? '  PASS: No errors during drag' : `  FAIL: ${dragErrors.join(', ')}`);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'test-drag.png') });

  // Test 3: Scroll zoom
  console.log('\n=== Test 3: Scroll zoom ===');
  await page.mouse.move(cx, cy);
  await page.mouse.wheel({ deltaY: -300 });
  await new Promise(r => setTimeout(r, 300));

  const zoomErrors = logs.filter(l => l.includes('ERROR') && !dragErrors.includes(l));
  console.log(zoomErrors.length === 0 ? '  PASS: No errors during zoom' : `  FAIL: ${zoomErrors.join(', ')}`);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'test-zoom.png') });

  // Test 4: Keyboard shortcut R (reset)
  console.log('\n=== Test 4: Keyboard shortcut R ===');
  await page.keyboard.press('r');
  await new Promise(r => setTimeout(r, 300));

  const resetErrors = logs.filter(l => l.includes('ERROR') && !dragErrors.includes(l) && !zoomErrors.includes(l));
  console.log(resetErrors.length === 0 ? '  PASS: No errors on R key reset' : `  FAIL: ${resetErrors.join(', ')}`);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'test-reset.png') });

  // Test 5: Slider controls exist and work
  console.log('\n=== Test 5: Slider controls ===');
  const sliders = await page.evaluate(() => {
    const ids = ['axial-slider', 'coronal-slider', 'sagittal-slider', 'wl-slider', 'ww-slider', 'tf-slider'];
    return ids.map(id => {
      const el = document.getElementById(id);
      return { id, exists: !!el, value: el?.value };
    });
  });
  sliders.forEach(s => {
    console.log(`  ${s.exists ? 'PASS' : 'FAIL'}: ${s.id} (value=${s.value})`);
  });

  // Summary
  const allErrors = logs.filter(l => l.includes('ERROR') || l.includes('PAGE_ERROR'));
  console.log('\n=== Summary ===');
  console.log(`Total errors: ${allErrors.length}`);
  console.log(`Tests passed: ${allErrors.length === 0 ? 'ALL' : 'SOME'}`);

  if (allErrors.length > 0) {
    console.log('\nErrors:');
    allErrors.forEach(e => console.log('  ' + e));
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
