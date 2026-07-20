# drink-water

一個手機優先、刻意保持簡單的本機喝水紀錄與提醒 PWA 專案。

正式網址：<https://21godman.github.io/drink-water/>

目前是 **Phase 2：可安裝、可離線的本機 PWA**。可以完成首次設定、快速記水、修改紀錄、查看七日趨勢，以及管理個人目標與常用容器。資料保存在瀏覽器的 IndexedDB；App 在線開啟一次後，也能安裝到裝置並在離線時重新啟動。

## 目前可以做什麼

- 輸入身高與體重，以 `(身高 cm＋體重 kg) × 10` 計算每日目標。
- 改用自訂的每日飲水目標。
- 建立自己的常用容器並快速記錄喝水。
- 修改或刪除今天的單筆紀錄。
- 查看最近七天的日均容量、達標天數與趨勢。
- 開關固定產生的七日示範資料；關閉時不會刪除真實紀錄。
- 清除全部本機設定與紀錄，重新開始。
- 在支援的瀏覽器安裝到手機或電腦，並離線重新開啟。
- 在 App 內查看離線狀態，並自行決定何時套用已下載的新版本。

## 七日保存規則

喝水紀錄只保留使用者裝置本地時區的「今天加前 6 個日曆日」。App 啟動與每次保存時都會永久移除更早的紀錄；個人設定與常用容器不受這個期限影響。

每筆紀錄會保存當時的每日目標，因此日後修改身高、體重或自訂目標，不會改變過去的達標判斷。

## 目前刻意不做什麼

- 不連接 Supabase，也沒有帳號、邀請碼或跨裝置同步。
- 不加入通知、背景提醒或 Web Push。
- 不使用 localStorage 作為第二份備援資料。
- 不加入路由、狀態管理或正式環境的 IndexedDB 套件。

## 技術選擇

- React 19＋TypeScript：畫面、型別與 reducer 狀態管理。
- 原生 IndexedDB：本機資料保存與七日清理。
- Vite：本機開發與 production build。
- Vite PWA＋Workbox：Manifest、Service Worker、離線資源預快取與版本更新提示。
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

開發模式刻意不註冊 Service Worker。要驗證安裝、離線與更新流程，請使用 production preview：

```bash
npm run build
npm run preview
```

## 驗證

```bash
npm run lint
npm run test
npm run build
```

## 手動發布到 GitHub Pages

這個 repository 使用 GitHub Pages 的 `gh-pages` branch，不使用 CI 或自動部署。首次發布前需先建立並 push 公開的 `21godman/drink-water` repository。

確認 GitHub CLI 已登入、`origin` 指向正確 repository 後執行：

```bash
npm run deploy
```

指令會先執行 lint、完整測試與 GitHub Pages 專用 build；全部通過後，才將 `dist/` 發布到 `gh-pages` branch。正式 build 使用 `/drink-water/` 子路徑，本機開發仍使用 `/`。

第一次執行會建立 `gh-pages` branch；完成後到 GitHub repository 的 Pages 設定，將發布來源設為 `gh-pages` branch 的根目錄。之後只需再次執行相同指令即可更新網站。

網站包含 `noindex` 提示以降低搜尋曝光，但網址本身仍是公開的；任何知道網址的人都能開啟純本機功能。

## 主要檔案

```text
src/
├── App.tsx                    App shell、載入與錯誤狀態
├── usePwaStatus.ts           安裝、離線與版本更新狀態
├── PwaStatusBanner.tsx       全域 PWA 與保存狀態提示
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

未來 Supabase URL、publishable key 與 VAPID public key 可以放入前端 build；它們不是授權機制。真正的後端保護必須由邀請制 Supabase Auth、關閉公開註冊、資料表 RLS 與 Edge Function JWT 驗證負責。每位使用者只能以自己的 `auth.uid()` 存取自己的後端資料。

Supabase secret／service-role key、VAPID private key、GitHub token 與受邀者名單不得放入 Git history、`VITE_*` 變數或瀏覽器 bundle。`package.json` 的 `"private": true` 只代表禁止發布到 npm registry，不代表 GitHub repository 的可見性。
