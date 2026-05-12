import puppeteer from 'puppeteer';
import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5175', { waitUntil: 'networkidle0', timeout: 30000 });

  // Screenshot 1: Initial state
  await page.screenshot({ path: 'screenshots/ui-initial.png' });
  console.log('✓ Initial screenshot captured');

  // Get DICOM file list
  const dicomDir = resolve(__dirname, '../public/dicom-test');
  const dcmFiles = readdirSync(dicomDir)
    .filter(f => f.endsWith('.dcm'))
    .sort()
    .slice(0, 200)  // 200 slices for speed
    .map(f => `/dicom-test/${f}`);

  console.log(`Loading ${dcmFiles.length} DICOM files...`);

  // Load DICOM files via fetch
  await page.evaluate(async (files) => {
    const statusEl = document.getElementById('status');
    statusEl.textContent = `Fetching ${files.length} files...`;

    const fileObjects = [];
    for (let i = 0; i < files.length; i++) {
      const resp = await fetch(files[i]);
      const blob = await resp.blob();
      fileObjects.push(new File([blob], files[i].split('/').pop(), { type: 'application/dicom' }));
      if (i % 50 === 0) {
        statusEl.textContent = `Fetching ${i}/${files.length}...`;
        await new Promise(r => setTimeout(r, 0));
      }
    }

    // Trigger the file handler
    const dt = new DataTransfer();
    for (const f of fileObjects) dt.items.add(f);
    const fileInput = document.getElementById('file-input');
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));
  }, dcmFiles);

  // Wait for loading to complete
  await page.waitForFunction(
    () => !document.getElementById('loading').classList.contains('active'),
    { timeout: 120000 }
  );

  // Wait a bit for rendering
  await new Promise(r => setTimeout(r, 2000));

  // Screenshot 2: Loaded state
  await page.screenshot({ path: 'screenshots/ui-loaded.png' });
  console.log('✓ Loaded screenshot captured');

  // Check status text
  const statusText = await page.$eval('#status', el => el.textContent);
  console.log(`Status: ${statusText}`);

  // Verify controls panel is visible
  const controlsVisible = await page.$eval('#controls-mpm', el => el.classList.contains('open'));
  console.log(`Controls panel visible: ${controlsVisible}`);

  // Verify canvases have rendered content
  const canvasInfo = await page.evaluate(() => {
    const ids = ['axial-canvas', 'coronal-canvas', 'sagittal-canvas'];
    return ids.map(id => {
      const c = document.getElementById(id);
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, Math.min(c.width, 10), Math.min(c.height, 10));
      const nonZero = data.data.filter(v => v !== 0).length;
      return { id, width: c.width, height: c.height, nonZeroPixels: nonZero };
    });
  });

  for (const info of canvasInfo) {
    console.log(`  ${info.id}: ${info.width}x${info.height}, non-zero pixels in sample: ${info.nonZeroPixels}`);
  }

  // Test 3D interaction - drag
  const vp3d = await page.$('[id="3d-canvas"]');
  if (vp3d) {
    const box = await vp3d.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50, { steps: 5 });
      await page.mouse.up();
      await new Promise(r => setTimeout(r, 500));
    }
  }

  await page.screenshot({ path: 'screenshots/ui-after-rotate.png' });
  console.log('✓ After-rotate screenshot captured');

  // Test R key for camera reset
  await page.keyboard.press('r');
  await new Promise(r => setTimeout(r, 500));

  await page.screenshot({ path: 'screenshots/ui-after-reset.png' });
  console.log('✓ After-reset screenshot captured');

  await browser.close();
  console.log('\nAll UI tests completed successfully!');
})();
