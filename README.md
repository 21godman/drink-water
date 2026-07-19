# drink-water

一個手機優先、刻意保持簡單的喝水紀錄與提醒 PWA 專案。

目前是 **Phase 1A：互動介面原型**。可以完成首次設定、快速記水、修改紀錄、查看 30 天趨勢，以及管理個人目標與常用容器。資料只保存在 React 記憶體，重新整理頁面後會重置。

## 目前可以做什麼

- 輸入身高與體重，以 `(身高 cm＋體重 kg) × 10` 計算每日目標。
- 改用自訂的每日飲水目標。
- 建立自己的常用容器並快速記錄喝水。
- 修改或刪除今天的單筆紀錄。
- 查看最近 30 天趨勢、日均容量、達標天數與連續天數。
- 開關固定產生的示範資料；關閉時不會刪除本次操作新增的紀錄。

## 目前刻意不做什麼

- 不把資料寫入 IndexedDB、localStorage 或雲端。
- 不加入 Web App Manifest、Service Worker 或通知。
- 不連接 Supabase，也沒有帳號、邀請碼或跨裝置同步。
- 不加入路由、狀態管理或圖表套件。

這一階段的目的，是先確認資訊架構、視覺和完整操作流程，再把通過驗證的資料模型接到 IndexedDB。

## 技術選擇

- React 19＋TypeScript：畫面、型別與 reducer 狀態管理。
- Vite：本機開發與 production build。
- 原生 CSS／SVG：響應式介面與 30 天趨勢圖。
- Vitest＋Testing Library：資料規則與主要操作流程測試。
- ESLint：程式碼檢查。

## 本機啟動

需求：Node.js 22.12 以上。

```bash
npm install
npm run dev
```

終端會顯示本機網址。首次開啟時，請先輸入身高、體重與至少一個容器。

## 驗證

```bash
npm run lint
npm run test
npm run build
```

## 主要檔案

```text
src/
├── App.tsx             App shell 與底部三分頁導覽
├── Onboarding.tsx      首次設定流程
├── TodayView.tsx       今日進度、快速記水與紀錄更正
├── HistoryView.tsx     30 天統計與 SVG 趨勢圖
├── SettingsView.tsx    個人目標、容器與示範資料
├── appState.ts         reducer、目標公式與日期工具
├── types.ts            共用資料型別
└── styles.css          手機優先的全域視覺樣式
```

完整的階段規劃與資料流請閱讀 [`docs/architecture.md`](docs/architecture.md)。

## 環境變數與安全

目前不使用任何環境變數；`.env.example` 只示範未來公開欄位。以下內容永遠不能放進前端或 GitHub：

- Supabase service role key
- VAPID private key
- 邀請碼原文清單
- 任何管理員秘密

`package.json` 的 `"private": true` 只代表禁止發布到 npm registry，不代表 GitHub repository 已設為 private。
