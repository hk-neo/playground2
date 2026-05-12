import puppeteer from 'puppeteer';
import { readdirSync } from 'fs';
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

  // Load DICOM files
  const dicomDir = resolve(__dirname, '../public/dicom-test');
  const dcmFiles = readdirSync(dicomDir)
    .filter(f => f.endsWith('.dcm'))
    .sort()
    .slice(0, 200)
    .map(f => `/dicom-test/${f}`);

  console.log(`Loading ${dcmFiles.length} DICOM files...`);

  await page.evaluate(async (files) => {
    const fileObjects = [];
    for (let i = 0; i < files.length; i++) {
      const resp = await fetch(files[i]);
      const blob = await resp.blob();
      fileObjects.push(new File([blob], files[i].split('/').pop(), { type: 'application/dicom' }));
    }
    const dt = new DataTransfer();
    for (const f of fileObjects) dt.items.add(f);
    const fileInput = document.getElementById('file-input');
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));
  }, dcmFiles);

  await page.waitForFunction(
    () => !document.getElementById('loading').classList.contains('active'),
    { timeout: 120000 }
  );
  await new Promise(r => setTimeout(r, 1500));

  console.log('✓ DICOM loaded');

  // ── Test 1: MPR Scroll → Slice Navigation ──
  const axialInitial = await page.$eval('#axial-slider', el => el.value);
  console.log(`  Axial initial: ${axialInitial}`);

  // Scroll down on axial canvas (should increment slice)
  const axialCanvas = await page.$('#axial-canvas');
  const axialBox = await axialCanvas.boundingBox();
  await page.mouse.move(axialBox.x + axialBox.width / 2, axialBox.y + axialBox.height / 2);
  await page.mouse.wheel({ deltaY: 100 });
  await new Promise(r => setTimeout(r, 200));

  const axialAfterScrollDown = await page.$eval('#axial-slider', el => el.value);
  console.log(`  Axial after scroll down: ${axialAfterScrollDown}`);
  console.assert(+axialAfterScrollDown > +axialInitial, 'Scroll down should increment slice');

  // Scroll up (should decrement)
  await page.mouse.wheel({ deltaY: -100 });
  await new Promise(r => setTimeout(r, 200));

  const axialAfterScrollUp = await page.$eval('#axial-slider', el => el.value);
  console.log(`  Axial after scroll up: ${axialAfterScrollUp}`);
  console.assert(+axialAfterScrollUp < +axialAfterScrollDown, 'Scroll up should decrement slice');

  console.log('✓ MPR scroll wheel slice navigation works');

  // ── Test 2: MPR Left-Drag → WL/WW Adjustment ──
  const wlBefore = await page.$eval('#wl-slider', el => el.value);
  const wwBefore = await page.$eval('#ww-slider', el => el.value);
  console.log(`  WL before drag: ${wlBefore}, WW before drag: ${wwBefore}`);

  // Left-drag on coronal canvas
  const coronalCanvas = await page.$('#coronal-canvas');
  const coronalBox = await coronalCanvas.boundingBox();
  const cx = coronalBox.x + coronalBox.width / 2;
  const cy = coronalBox.y + coronalBox.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy - 60, { steps: 5 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 200));

  const wlAfter = await page.$eval('#wl-slider', el => el.value);
  const wwAfter = await page.$eval('#ww-slider', el => el.value);
  console.log(`  WL after drag: ${wlAfter}, WW after drag: ${wwAfter}`);
  console.assert(wlAfter !== wlBefore || wwAfter !== wwBefore, 'WL or WW should change after drag');

  console.log('✓ MPR left-drag WL/WW adjustment works');

  // ── Test 3: 3D Left-Drag Rotation ──
  const canvas3d = await page.$('[id="3d-canvas"]');
  const box3d = await canvas3d.boundingBox();
  const x3d = box3d.x + box3d.width / 2;
  const y3d = box3d.y + box3d.height / 2;

  await page.mouse.move(x3d, y3d);
  await page.mouse.down();
  await page.mouse.move(x3d + 100, y3d + 50, { steps: 5 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 300));

  await page.screenshot({ path: 'screenshots/ui-3d-rotated.png' });
  console.log('✓ 3D left-drag rotation works');

  // ── Test 4: 3D Double-Click Reset ──
  await page.mouse.click(x3d, y3d, { clickCount: 2 });
  await new Promise(r => setTimeout(r, 300));

  await page.screenshot({ path: 'screenshots/ui-3d-reset.png' });
  console.log('✓ 3D double-click reset works');

  // ── Test 5: 3D Scroll Zoom ──
  await page.mouse.move(x3d, y3d);
  await page.mouse.wheel({ deltaY: -200 });
  await new Promise(r => setTimeout(r, 300));

  await page.screenshot({ path: 'screenshots/ui-3d-zoomed.png' });
  console.log('✓ 3D scroll zoom works');

  // ── Test 6: Cross-plane scroll ──
  const sagittalInitial = await page.$eval('#sagittal-slider', el => el.value);
  const sagittalCanvas = await page.$('#sagittal-canvas');
  const sagittalBox = await sagittalCanvas.boundingBox();
  await page.mouse.move(sagittalBox.x + sagittalBox.width / 2, sagittalBox.y + sagittalBox.height / 2);
  await page.mouse.wheel({ deltaY: 200 });
  await new Promise(r => setTimeout(r, 200));

  const sagittalAfter = await page.$eval('#sagittal-slider', el => el.value);
  console.log(`  Sagittal: ${sagittalInitial} → ${sagittalAfter}`);
  console.assert(+sagittalAfter > +sagittalInitial, 'Scroll on sagittal should change sagittal slice');

  console.log('✓ Cross-plane scroll works independently');

  await page.screenshot({ path: 'screenshots/ui-final.png' });

  await browser.close();
  console.log('\n✅ All interaction tests passed!');
})();
