const { chromium } = require('playwright');
const fs = require('fs');
// Browser smoke test: run `npm run dev -- --port 5199` first, then `npm run test:e2e`.
// Requires Playwright with Chromium available (require('playwright')).
const path = require('path');
const SP = process.env.OUT_DIR || path.join(__dirname, 'output');
fs.mkdirSync(SP, { recursive: true });
const URL = process.env.APP_URL || 'http://localhost:5199/';
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; } else console.log('ok -', msg); };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL);

  // Make a synthetic 3000x2000 test photo inside the browser.
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 3000; c.height = 2000;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 1200); sky.addColorStop(0, '#5b8fd1'); sky.addColorStop(1, '#f2c79a');
    g.fillStyle = sky; g.fillRect(0, 0, 3000, 1200);
    g.fillStyle = '#3d6b3a'; g.fillRect(0, 1200, 3000, 800);
    g.fillStyle = '#f6d36b'; g.beginPath(); g.arc(2200, 700, 220, 0, 7); g.fill();
    g.fillStyle = '#d9a184'; g.beginPath(); g.arc(900, 1100, 300, 0, 7); g.fill();
    g.fillStyle = '#7a2e2e'; g.fillRect(1300, 900, 500, 700);
    for (let i = 0; i < 12; i++) { g.fillStyle = `hsl(${i * 30},70%,55%)`; g.fillRect(100 + i * 230, 1700, 200, 200); }
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (const b of buf) s += String.fromCharCode(b); return btoa(s);
  });
  fs.writeFileSync(`${SP}/test.jpg`, Buffer.from(b64, 'base64'));

  // 1. GPU vs CPU consistency on a random 256x256 image for every preset.
  const consistency = await page.evaluate(async () => {
    const { WebGLFilmRenderer } = await import('/src/engine/webglRenderer.ts');
    const { processRGBA, grainCellSize } = await import('/src/engine/pipeline.ts');
    const { resolveParams, createInitialEditState } = await import('/src/engine/params.ts');
    const { PRESETS } = await import('/src/engine/presets.ts');
    const W = 256, H = 256;
    const data = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < data.length; i++) data[i] = (i % 4 === 3) ? 255 : Math.floor(Math.random() * 256);
    const bmp = await createImageBitmap(new ImageData(data, W, H), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const r = WebGLFilmRenderer.create();
    const results = {};
    const cases = [[null, {}], ...PRESETS.map((p) => [p, { exposure: 0.4, contrast: 30, shadows: 20, grain: 60, vignette: 50, fade: 20 }])];
    for (const [preset, adj] of cases) {
      const s = createInitialEditState(); s.presetId = preset?.id ?? null; Object.assign(s.adjustments, adj);
      const p = resolveParams(s, preset);
      const geo = { imageWidth: W, imageHeight: H, grainCell: grainCellSize(W, H, p.grainSizeFactor) };
      const gpu = r.renderRegion(bmp, { x: 0, y: 0, width: W, height: H }, p, geo);
      const cpu = new Uint8ClampedArray(data.length);
      processRGBA(data, cpu, { offsetX: 0, offsetY: 0, width: W, height: H }, p, geo);
      let max = 0, sum = 0;
      for (let i = 0; i < data.length; i++) { const d = Math.abs(gpu[i] - cpu[i]); max = Math.max(max, d); sum += d; }
      results[preset?.id ?? 'none'] = { maxDiff: max, meanDiff: +(sum / data.length).toFixed(3) };
    }
    return { webgl2: !!document.createElement('canvas').getContext('webgl2'), results };
  });
  console.log('GPU vs CPU:', JSON.stringify(consistency));
  assert(Object.values(consistency.results).every((r) => r.maxDiff <= 1), 'WebGL shader matches CPU reference within 1/255');

  // 2. Tiled rendering == single-pass rendering (tile seams invisible)
  const tiling = await page.evaluate(async () => {
    const { WebGLFilmRenderer } = await import('/src/engine/webglRenderer.ts');
    const { grainCellSize } = await import('/src/engine/pipeline.ts');
    const { computeTiles } = await import('/src/engine/tiles.ts');
    const { resolveParams, createInitialEditState } = await import('/src/engine/params.ts');
    const { getPreset } = await import('/src/engine/presets.ts');
    const W = 300, H = 200;
    const data = new Uint8ClampedArray(W * H * 4).map((_, i) => (i % 4 === 3 ? 255 : (i * 13) % 256));
    const bmp = await createImageBitmap(new ImageData(data, W, H), { premultiplyAlpha: 'none' });
    const s = createInitialEditState(); s.presetId = 'night-cinema'; s.adjustments.grain = 80;
    const p = resolveParams(s, getPreset('night-cinema'));
    const geo = { imageWidth: W, imageHeight: H, grainCell: grainCellSize(W, H, p.grainSizeFactor) };
    const r = WebGLFilmRenderer.create();
    const whole = r.renderRegion(bmp, { x: 0, y: 0, width: W, height: H }, p, geo);
    let max = 0;
    for (const t of computeTiles(W, H, 64)) {
      const crop = await createImageBitmap(bmp, t.x, t.y, t.width, t.height, { premultiplyAlpha: 'none' });
      const px = r.renderRegion(crop, t, p, geo);
      for (let j = 0; j < t.height; j++) for (let i = 0; i < t.width * 4; i++) {
        max = Math.max(max, Math.abs(px[j * t.width * 4 + i] - whole[((t.y + j) * W + t.x) * 4 + i]));
      }
    }
    return { maxDiffTiledVsWhole: max };
  });
  assert(tiling.maxDiffTiledVsWhole <= 1, 'tiled render matches single-pass render (no seams)');

  // 3. Upload through the UI
  await page.setInputFiles('[data-testid=file-input]', `${SP}/test.jpg`);
  await page.waitForSelector('[aria-label="調色後預覽"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SP}/01-loaded.png` });

  await page.getByRole('option', { name: /Portra Warm/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SP}/02-portra.png` });

  // drag the contrast slider via keyboard
  const contrast = page.getByLabel('對比', { exact: true });
  await contrast.focus();
  for (let i = 0; i < 25; i++) await page.keyboard.press('ArrowRight');
  await page.getByRole('option', { name: /Night Cinema/ }).click();
  await page.getByRole('button', { name: '前後比較' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SP}/03-compare.png` });

  // undo / redo
  const undoBtn = page.getByRole('button', { name: '撤銷' });
  await undoBtn.click(); // preset night -> portra
  const sel1 = await page.locator('[role=option][aria-selected=true]').innerText();
  await page.getByRole('button', { name: '重做' }).click();
  const sel2 = await page.locator('[role=option][aria-selected=true]').innerText();
  assert(sel1.trim() === 'Portra Warm' && sel2.trim() === 'Night Cinema', 'undo / redo restore preset selection');

  // 4. Export JPG at original resolution
  await page.getByRole('button', { name: '前後比較' }).click();
  await page.getByRole('button', { name: /匯出/ }).first().click();
  await page.screenshot({ path: `${SP}/04-export-dialog.png` });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /匯出 JPG/ }).click()]);
  const outPath = `${SP}/${dl.suggestedFilename()}`;
  await dl.saveAs(outPath);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SP}/05-exported.png` });
  const outB64 = fs.readFileSync(outPath).toString('base64');

  const check = await page.evaluate(async (b64) => {
    const u = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([u], { type: 'image/jpeg' }));
    return { width: bmp.width, height: bmp.height };
  }, outB64);
  assert(check.width === 3000 && check.height === 2000, `export keeps original size (${check.width}x${check.height})`);

  // 5. Unsupported file
  fs.writeFileSync(`${SP}/bad.gif`, Buffer.from('GIF89a'));
  await page.setInputFiles('[data-testid=file-input]', `${SP}/bad.gif`);
  await page.waitForTimeout(300);
  assert((await page.locator('[role=alert]').first().innerText()).includes('不支援'), 'unsupported format shows error');
  // corrupt jpg
  fs.writeFileSync(`${SP}/broken.jpg`, Buffer.from('not really a jpeg'));
  await page.waitForTimeout(200);
  await page.setInputFiles('[data-testid=file-input]', `${SP}/broken.jpg`);
  await page.waitForTimeout(800);
  assert((await page.locator('[role=alert]').last().innerText()).includes('無法讀取'), 'corrupt file shows error');

  // 6. Mobile
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await m.goto(URL);
  await m.screenshot({ path: `${SP}/06-mobile-empty.png` });
  await m.setInputFiles('[data-testid=file-input]', `${SP}/test.jpg`);
  await m.waitForTimeout(1500);
  await m.getByRole('option', { name: /Golden Hour/ }).click();
  await m.getByRole('tab', { name: /Film Effects/ }).click();
  await m.waitForTimeout(400);
  await m.screenshot({ path: `${SP}/07-mobile.png` });
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert(!overflow, 'no horizontal overflow on mobile');

  assert(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
