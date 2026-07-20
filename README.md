# drink-water

一個手機優先、刻意保持簡單的本機喝水紀錄與提醒 PWA 專案。

目前是 **Phase 1B：IndexedDB 本機 MVP**。可以完成首次設定、快速記水、修改紀錄、查看七日趨勢，以及管理個人目標與常用容器。資料保存在瀏覽器的 IndexedDB，重新整理或重新開啟後仍然存在。

## 目前可以做什麼

- 輸入身高與體重，以 `(身高 cm＋體重 kg) × 10` 計算每日目標。
- 改用自訂的每日飲水目標。
- 建立自己的常用容器並快速記錄喝水。
- 修改或刪除今天的單筆紀錄。
- 查看最近七天的日均容量、達標天數與趨勢。
- 開關固定產生的七日示範資料；關閉時不會刪除真實紀錄。
- 清除全部本機設定與紀錄，重新開始。

## 七日保存規則

喝水紀錄只保留使用者裝置本地時區的「今天加前 6 個日曆日」。App 啟動與每次保存時都會永久移除更早的紀錄；個人設定與常用容器不受這個期限影響。

每筆紀錄會保存當時的每日目標，因此日後修改身高、體重或自訂目標，不會改變過去的達標判斷。

## 目前刻意不做什麼

- 不連接 Supabase，也沒有帳號、邀請碼或跨裝置同步。
- 不加入 Web App Manifest、Service Worker 或通知。
- 不使用 localStorage 作為第二份備援資料。
- 不加入路由、狀態管理或正式環境的 IndexedDB 套件。

## 技術選擇

- React 19＋TypeScript：畫面、型別與 reducer 狀態管理。
- 原生 IndexedDB：本機資料保存與七日清理。
- Vite：本機開發與 production build。
- 原生 CSS／SVG：響應式介面與七日趨勢圖。
- Vitest＋Testing Library＋fake-indexeddb：資料規則、資料庫與操作流程測試。
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
├── App.tsx                    App shell、載入與錯誤狀態
├── usePersistentAppState.ts  hydration 與序列化寫入佇列
├── indexedDb.ts              IndexedDB、驗證與七日清理
├── appState.ts               reducer、目標公式與日期工具
├── Onboarding.tsx            首次設定流程
├── TodayView.tsx              今日進度、快速記水與紀錄更正
├── HistoryView.tsx            七日統計與 SVG 趨勢圖
├── SettingsView.tsx           個人目標、容器、示範與資料清除
└── types.ts                   共用資料型別
```

完整的階段規劃與資料流請閱讀 [`docs/architecture.md`](docs/architecture.md)。

## 環境變數與安全

目前不使用任何環境變數；`.env.example` 只示範未來公開欄位。以下內容永遠不能放進前端或 GitHub：

- Supabase service role key
- VAPID private key
- 邀請碼原文清單
- 任何管理員秘密

`package.json` 的 `"private": true` 只代表禁止發布到 npm registry，不代表 GitHub repository 已設為 private。
