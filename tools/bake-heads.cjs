// 產生「插畫花頭」點陣素材（透明背景 WebP），寫回 bouquet.html 的 HEAD_ART 區塊。
// 用法：node tools/bake-heads.cjs   （需要 Playwright + Chromium）
// 想換成插畫師手繪的 PNG/WebP：把 HEAD_ART[花材]['變體|色票'] 的 src 換成你的圖，x/y/w/h 對齊 120×300 的花材座標即可。
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const FILE = path.join(__dirname, '..', 'bouquet.html');
const KINDS = ['rose', 'sunflower'], VARS = ['full', 'semi', 'bud'], PX = 4; // 每個 viewBox 單位渲染成 4px

const src = fs.readFileSync(FILE, 'utf8');
const a = src.indexOf('  /* ================= 繪圖工具'), b = src.indexOf('  const RANK =');
const mixDef = "const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const mix = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');";
const lib = new Function(mixDef + src.slice(a, b) + '\nreturn { MAT, HEADS, GRAD, budArt, semiArt };')();

// 手繪質感濾鏡：線條微抖動、紙紋顆粒、花瓣邊緣水彩色素沉積
const PAINT = `<filter id="paint" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="4" result="warp"/>
  <feDisplacementMap in="SourceGraphic" in2="warp" scale="1.3" xChannelSelector="R" yChannelSelector="G" result="wob"/>
  <feMorphology in="SourceAlpha" operator="erode" radius="1.2" result="inner"/>
  <feGaussianBlur in="inner" stdDeviation="1.4" result="innerBlur"/>
  <feComposite in="SourceAlpha" in2="innerBlur" operator="out" result="rim"/>
  <feFlood flood-color="#7A4E3A" flood-opacity=".18"/><feComposite in2="rim" operator="in" result="rimTint"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="9" result="grain"/>
  <feColorMatrix in="grain" type="matrix" values="0 0 0 0 .33  0 0 0 0 .27  0 0 0 0 .22  .55 0 0 0 -.2" result="speck"/>
  <feComposite in="speck" in2="wob" operator="in" result="speckIn"/>
  <feMerge><feMergeNode in="wob"/><feMergeNode in="rimTint"/><feMergeNode in="speckIn"/></feMerge>
</filter>`;

(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  await page.setContent('<html><body style="margin:0;background:transparent"></body></html>');
  const out = {};
  for (const k of KINDS) {
    out[k] = {};
    const h = lib.HEADS[k];
    for (const [ci, c] of lib.MAT[k].colors.entries()) for (const v of VARS) {
      lib.GRAD.clear();
      const art = v === 'bud' ? lib.budArt(h, c) : v === 'semi' ? lib.semiArt(h, c) : h.head(c);
      const defs = [...lib.GRAD.values()].join('') + PAINT;
      const res = await page.evaluate(async ({ art, defs, PX }) => {
        const NS = 'http://www.w3.org/2000/svg';
        const probe = document.createElementNS(NS, 'svg'); probe.setAttribute('viewBox', '0 0 120 300'); probe.setAttribute('width', 120); probe.setAttribute('height', 300);
        probe.innerHTML = `<defs>${defs}</defs><g>${art}</g>`; document.body.appendChild(probe);
        const bb = probe.querySelector('g').getBBox(); probe.remove();
        const pad = 3, x = Math.floor(bb.x - pad), y = Math.floor(bb.y - pad), w = Math.ceil(bb.width + pad * 2), hh = Math.ceil(bb.height + pad * 2);
        const svg = `<svg xmlns="${NS}" viewBox="${x} ${y} ${w} ${hh}" width="${w * PX}" height="${hh * PX}"><defs>${defs}</defs><g filter="url(#paint)">${art}</g></svg>`;
        const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
        const cv = document.createElement('canvas'); cv.width = w * PX; cv.height = hh * PX; cv.getContext('2d').drawImage(img, 0, 0);
        return { x, y, w, h: hh, src: cv.toDataURL('image/webp', .86) };
      }, { art, defs, PX });
      out[k][`${v}|${ci}`] = res;
    }
  }
  await browser.close();
  const body = `  const HEAD_ART = ${JSON.stringify(out)};`;
  const html = src.replace(/(\/\*HEAD_ART_START\*\/\n)[\s\S]*?(\n\s*\/\*HEAD_ART_END\*\/)/, `$1${body}$2`);
  fs.writeFileSync(FILE, html);
  const n = KINDS.reduce((t, k) => t + Object.keys(out[k]).length, 0), kb = Math.round(JSON.stringify(out).length / 1024);
  console.log(`baked ${n} heads, ${kb} KB`);
})();
