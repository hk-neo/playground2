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

  // Collect console logs
  const logs = [];
  page.on('console', (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    logs.push(`[ERROR] ${err.message}`);
  });

  console.log('1. Loading page...');
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle0' });

  // Screenshot: initial state
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-initial.png') });
  console.log('  -> 01-initial.png');

  // Check for errors
  const errors = logs.filter(l => l.includes('[ERROR]'));
  if (errors.length > 0) {
    console.log('  Errors found:');
    errors.forEach(e => console.log('    ' + e));
  }

  // Verify canvas elements exist
  const canvases = await page.$$eval('canvas', els => els.map(e => ({ id: e.id, w: e.width, h: e.height })));
  console.log('  Canvases:', JSON.stringify(canvases));

  // Verify InputHandler is attached (check if 3d canvas has event listeners)
  const inputHandlerCheck = await page.evaluate(() => {
    const c = document.getElementById('3d-canvas');
    return c ? '3d-canvas exists' : '3d-canvas missing';
  });
  console.log('  ' + inputHandlerCheck);

  // Test mouse drag on 3D canvas
  console.log('2. Testing mouse drag on 3D canvas...');
  const canvas3d = await page.$('[id="3d-canvas"]');
  const box = await canvas3d.boundingBox();

  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Simulate drag
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 100, cy + 30, { steps: 5 });
    await page.mouse.up();

    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-after-drag.png') });
    console.log('  -> 02-after-drag.png');
  }

  // Test scroll zoom on 3D canvas
  console.log('3. Testing scroll zoom...');
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel({ deltaY: -200 });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-after-zoom.png') });
    console.log('  -> 03-after-zoom.png');
  }

  // Test keyboard shortcut 'r' (reset camera)
  console.log('4. Testing keyboard shortcut R (reset)...');
  await page.keyboard.press('r');
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-after-reset.png') });
  console.log('  -> 04-after-reset.png');

  // Print all console output
  if (logs.length > 0) {
    console.log('\nConsole output:');
    logs.forEach(l => console.log('  ' + l));
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to test-screenshots/');
}

main().catch(e => { console.error(e); process.exit(1); });
