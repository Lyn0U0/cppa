# FILM LAB — 底片調色 Web App

FILM LAB 是一個在瀏覽器本機運算的底片調色工具。上傳照片、選擇底片預設、微調參數，再以**原始解析度**匯出 JPG/PNG。

> 這不是 AI 生圖工具。所有效果都是逐像素的色彩運算（WebGL Shader），不會改變影像中的物件、構圖或幾何形狀。

## 快速開始

```bash
cd film-lab
npm install
npm run dev        # 開發伺服器
npm test           # 單元測試 (Vitest)
npm run build      # 型別檢查 + 產出 dist/
npm run test:e2e   # 瀏覽器 smoke test（需先以 --port 5199 啟動 dev server，並安裝 Playwright）
```

## 功能（MVP）

| 功能 | 說明 |
| --- | --- |
| 上傳 | JPG / PNG / WebP，點擊或拖曳；自動套用 EXIF 方向 |
| 預覽 | 大面積預覽、1×–4× 縮放、拖曳式前後比較 |
| 底片預設 | Portra Warm、Fuji Green、Golden Hour、Night Cinema、Soft Pastel、Classic Mono，縮圖由同一引擎即時算出 |
| 強度 | 每個 Preset 可調 0–100% |
| Light | 曝光、對比、亮部、陰影 |
| Color | 色溫、色調、飽和度 |
| Film Effects | 顆粒、褪色、暈影 |
| 歷史 | 撤銷 / 重做 / 重設（Ctrl+Z、Ctrl+Shift+Z），一次拖曳只記錄一步 |
| 匯出 | 原始像素尺寸 JPG / PNG，JPG 品質 60–100% |
| 配方 | 調色參數可複製為 JSON 或從 JSON 載入 |
| 狀態 | 讀取中、處理中（含匯出進度）、失敗、匯出完成提示 |

## 架構

```
src/
  presets/presets.json     六種底片預設（JSON 管理，載入時驗證）
  engine/                  與 UI 無關的調色引擎
    types.ts               資料模型：Adjustments、Preset、EditState、EngineParams
    params.ts              滑桿定義、EditState → EngineParams（純函式）
    presets.ts             預設載入與驗證
    shaders.ts             GLSL 調色管線（WebGL1/2 通用）
    pipeline.ts            與 shader 逐步對應的 CPU 參考實作
    webglRenderer.ts       WebGL 渲染器：預覽繪製與分塊（tile）渲染
    cpuRenderer.ts         無 WebGL 時的預覽備援
    exporter.ts            原始解析度分塊渲染、編碼、下載
    image.ts / tiles.ts    檔案驗證、解碼、尺寸計算
    errors.ts              錯誤代碼與中文訊息
  editor/                  編輯器狀態
    history.ts             撤銷/重做 reducer（非破壞式）
    recipe.ts              配方 JSON 序列化/驗證
    usePreviewRenderer.ts  預覽 hook（rAF 合併重繪）
    thumbnails.ts          預設縮圖
  components/              React UI（Tailwind）
tests/                     Vitest 單元測試
e2e/smoke.cjs              Playwright 瀏覽器 smoke test
```

### 非破壞式編輯

原始檔案（`File`）永遠不被修改。編輯狀態只是一個 JSON 物件：

```json
{
  "presetId": "portra-warm",
  "intensity": 80,
  "adjustments": { "exposure": 0.2, "contrast": 10, "temperature": 0, "tint": 0, "saturation": 0,
                   "highlights": -15, "shadows": 10, "grain": 20, "fade": 0, "vignette": 15 }
}
```

每次渲染都是「原圖 + 參數」重新計算，因此反覆調整不會累積畫質損失。Preset 強度以參數內插實作：`有效值 = preset值 × 強度 + 使用者調整`，色彩矩陣、分離色調、黑白混合也一併內插。

### 調色管線（shader 與 CPU 實作一致）

1. sRGB → 線性　2. 曝光 × 白平衡（色溫/色調，保持亮度）　3. Preset 3×3 色彩矩陣　4. 線性 → sRGB
5. 亮部/陰影（亮度遮罩）　6. 對比（平滑 S 曲線）　7. 飽和度　8. 黑白混合　9. 分離色調
10. 褪色（提升黑位、壓低白位）　11. 暈影　12. 顆粒（以整張圖的座標產生的決定性雜訊）

暈影與顆粒都以「整張圖的座標」計算，顆粒大小與影像尺寸成比例，因此縮小的預覽、分塊匯出與完整匯出得到相同的結果。

### 預覽與匯出一致性

- 預覽與匯出使用**同一個 shader 與同一組 `EngineParams`**。
- 匯出時重新解碼原檔，以 ≤2048px 的 tile 分塊渲染（可處理大於 GPU 最大貼圖尺寸的照片），再組回原尺寸畫布編碼。
- 驗證（`npm run test:e2e`）：WebGL 輸出與 CPU 參考實作差異 ≤ 1/255；分塊渲染與單次渲染差異 ≤ 1/255；匯出尺寸等於原圖；預覽截圖與縮小後的匯出圖平均差異 < 1/255。

### 效能與穩定性

- 貼圖只在換圖時上傳；滑桿變動只更新 uniform，並以 `requestAnimationFrame` 合併為每幀最多一次繪製，畫布不清除，避免閃爍。
- 預覽解析度依螢幕大小限制（約 1400–2560px），匯出才使用完整解析度。
- WebGL context lost 會自動重建；無 WebGL 時自動改用 CPU 模式。
- 錯誤處理：不支援的格式、檔案過大（>80MB）、解析度過高（>100MP）、解碼失敗、記憶體不足、匯出失敗都有明確提示。
