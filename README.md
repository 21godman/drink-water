# drink-water

一個手機優先、刻意保持簡單的本機喝水紀錄與提醒 PWA 專案。

正式網址：<https://21godman.github.io/drink-water/>

這個 App 可以完成首次設定、快速記水、修改紀錄、查看七日趨勢，以及管理個人目標、常用容器與提醒時段。資料保存在瀏覽器的 IndexedDB；設定好 Supabase、Turnstile 與 VAPID 後，受邀裝置也能在 App 關閉時收到固定間隔提醒。

後端只使用 Supabase 雲端 Project，不需要 Docker，也不會在電腦上啟動另一套 Supabase。repository 內的 Supabase CLI 指令只會連線到明確 linked 的雲端 Project。

## 目前可以做什麼

- 輸入身高與體重，以 `(身高 cm＋體重 kg) × 10` 計算每日目標。
- 改用自訂的每日飲水目標。
- 建立自己的常用容器並快速記錄喝水。
- 修改或刪除今天的單筆紀錄。
- 查看最近七天的日均容量、達標天數與趨勢。
- 在設定頁切換英文、繁體中文與泰文；選擇會保存在本機。
- 清除全部本機設定與紀錄，並解除雲端提醒裝置；離線時會在恢復連線後自動完成雲端清理。
- 在支援的瀏覽器安裝到手機或電腦，並離線重新開啟。
- 在 App 內查看離線狀態，並自行決定何時套用已下載的新版本。
- 未設定雲端環境時，繼續在本機保存提醒偏好。
- 使用一次性邀請碼加入受控的提醒服務，不需要 Email。
- 在 iPhone 主畫面 PWA 或其他支援 Web Push 的瀏覽器接收固定間隔提醒。
- 在設定頁查看下次通知時間，並立即傳送一則測試通知到目前裝置。
- Owner 可產生 24 小時有效、只能兌換一次的新邀請碼。

## 分享給朋友

1. Owner 到 App 的「設定」頁，按「產生邀請碼」。
2. 把正式網址與邀請碼傳給朋友：<https://21godman.github.io/drink-water/>
3. 朋友開啟網站並完成首次設定，再到「設定」頁完成驗證、輸入邀請碼，按「使用邀請碼加入」。
4. iPhone 使用者要用 Safari 開啟網站，從分享選單選「加入主畫面」，再從主畫面圖示開啟 App。
5. 按「允許通知並開啟提醒」。

每組邀請碼只會顯示一次、只能由一台裝置使用，並會在 24 小時後失效。

## 七日保存規則

喝水紀錄只保留使用者裝置本地時區的「今天加前 6 個日曆日」。App 啟動與每次保存時都會永久移除更早的紀錄；個人設定與常用容器不受這個期限影響。

每筆紀錄會保存當時的每日目標，因此日後修改身高、體重或自訂目標，不會改變過去的達標判斷。

## 目前刻意不做什麼

- 不提供 Email 帳號 UI、公開 membership 或跨裝置身分復原。
- 不上傳完整喝水紀錄，也不依飲水進度發送智慧提醒。
- 不使用 localStorage 作為第二份備援資料。
- 不加入路由、狀態管理或正式環境的 IndexedDB 套件。

## 技術選擇

- React 19＋TypeScript：畫面、型別與 reducer 狀態管理。
- 原生 IndexedDB：本機資料保存與七日清理。
- Vite：本機開發與 production build。
- Vite PWA＋Workbox：Manifest、Service Worker、離線資源預快取、版本更新與 Push 事件。
- Supabase Auth／Postgres／Edge Functions／Cron：匿名裝置身分、一次性邀請碼與提醒排程。
- Cloudflare Turnstile：匿名身分建立前的機器人防護。
- 原生 CSS／SVG：響應式介面與七日趨勢圖。
- Vitest＋Testing Library＋fake-indexeddb：資料規則、IndexedDB 與前端操作流程測試。
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

## Supabase 雲端部署

先在 Supabase 網站建立 Project，再使用 repository 內的 CLI 部署。以下指令不啟動本機 Supabase：

```bash
npm run supabase:check
npm run supabase:push
npm run supabase:lint
npm run supabase:advisors
npm run supabase:deploy
```

- `supabase:check`：預覽 linked 雲端 Project 尚未套用的 migration。
- `supabase:push`：將 migration 套用到 linked 雲端 Project。
- `supabase:lint`：檢查 linked 雲端資料庫的 SQL function。
- `supabase:advisors`：檢查 linked 雲端資料庫的安全與效能建議。
- `supabase:deploy`：透過 Supabase API 在雲端打包並部署 Edge Functions。

從註冊帳號、建立 Project 到手機實機驗證的完整步驟，請依 [`docs/web-push-setup.md`](docs/web-push-setup.md) 操作。

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
├── appState.ts               reducer、目標公式與日期工具
├── indexedDb.ts              IndexedDB、驗證與七日清理
├── usePersistentAppState.ts  hydration 與序列化寫入佇列
├── usePwaStatus.ts           安裝、離線與版本更新狀態
├── PwaStatusBanner.tsx       全域 PWA 與保存狀態提示
├── useCloudReminders.ts      雲端身分、訂閱核對與提醒操作
├── supabaseClient.ts         公開雲端設定與 Supabase client
├── cloudTypes.ts             雲端提醒狀態與操作型別
├── cloudUtils.ts             邀請碼、時區、Push 與待清理旗標 helper
├── CloudReminderCard.tsx     邀請碼、提醒設定與 owner 操作
├── TurnstileWidget.tsx       Cloudflare Turnstile widget
├── Onboarding.tsx            首次設定流程
├── TodayView.tsx             今日進度、快速記水與紀錄更正
├── HistoryView.tsx           七日統計與 SVG 趨勢圖
├── SettingsView.tsx          個人目標、提醒、容器、語言與資料清除
└── types.ts                  共用資料型別
public/push-handler.js        Push 與通知點擊事件
supabase/
├── config.toml               CLI 與 Edge Function 設定
├── migrations/               資料表、RLS、SQL functions 與 Cron helper
└── functions/                邀請、訂閱、設定同步、通知發送與測試
scripts/generate-vapid.mjs    產生 Web Push VAPID key pair
docs/
├── architecture.md           本機與雲端資料流
└── web-push-setup.md         純雲端 Supabase 部署與實機驗證
```

完整的資料流請閱讀 [`docs/architecture.md`](docs/architecture.md)。

## 環境變數與安全

前端沒有設定完整公開環境欄位時會自動退回純裝置提醒偏好模式。以下內容永遠不能放進前端或 GitHub：

- Supabase service role key
- VAPID private key
- 邀請碼原文清單
- 任何管理員秘密

Supabase URL、publishable key、VAPID public key 與 Turnstile site key 可以放入前端 build；它們不是授權機制。真正的後端保護由匿名 Auth JWT、一次性邀請碼、資料表 RLS 與 Edge Function 成員檢查負責。每位使用者只能以自己的 `auth.uid()` 存取自己的後端提醒資料。

Supabase secret／service-role key、VAPID private key、GitHub token 與受邀者名單不得放入 Git history、`VITE_*` 變數或瀏覽器 bundle。`package.json` 的 `"private": true` 只代表禁止發布到 npm registry，不代表 GitHub repository 的可見性。
