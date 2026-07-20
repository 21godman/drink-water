# drink-water 架構說明

這份文件說明目前本機 MVP 的資料流，以及未來如何在不把完整喝水明細上傳雲端的前提下加入 PWA 與提醒後端。

## 現在的階段

目前是 **Phase 3A：本機提醒偏好設定**。

已經有：

- 手機優先的首次設定、今日、七日歷史與設定介面。
- `UserProfile`、`Container`、`DrinkRecord` 與 `ReminderSettings` 核心型別。
- 集中式 reducer 與 IndexedDB 原子快照持久化。
- 啟動 hydration、序列化寫入、格式驗證、失敗重試與清除資料流程。
- 最近七個本地日曆日的自動保存期限。
- 每筆紀錄的歷史目標快照與原生 CSS／SVG 七日趨勢圖。
- Web App Manifest、安裝圖示與 production Service Worker。
- App shell 靜態資源預快取、離線重新啟動與手動版本更新提示。
- Chromium 安裝入口，以及 iOS Safari「加入主畫面」指引。
- Public GitHub repository 與手動發布的 GitHub Pages HTTPS 網站。
- 可開關的本機提醒偏好，以及每天開始、結束時間與 30／60／90 分鐘間隔。
- 舊版 IndexedDB 快照缺少提醒欄位時的向後相容預設補值。

還沒有：

- Supabase 資料表、Edge Function、邀請碼或 Web Push。
- Notification API 權限請求、系統通知或背景提醒。
- 帳號、跨裝置同步、資料匯出或備份。
- GitHub Actions、CI 或自動部署。

## 本機資料流

`App.tsx` 透過持久化 hook 管理 reducer 與 IndexedDB：

1. App 啟動時顯示載入狀態並開啟 `drink-water` version 1 資料庫。
2. 讀取 `app-state/current`，驗證資料格式並移除七日範圍外的紀錄。
3. 有設定時進入今日頁；沒有資料時進入首次設定。
4. 使用者操作先立即更新 reducer，再將完整快照排入序列化寫入佇列。
5. 每次寫入前再次清理過期紀錄，避免較舊的非同步操作覆蓋新狀態。
6. 寫入失敗時保留目前畫面資料並提供重試，不用錯誤資料覆蓋 IndexedDB。

示範紀錄以 `isDemo` 標記；關閉示範資料只移除該標記的紀錄。喝水紀錄的 `goalMlAtTime` 保存建立當下的目標，同一天使用第一筆紀錄的目標判斷是否達標。

## 本機提醒偏好

`ReminderSettings` 與其他 App 設定一起保存在 IndexedDB 快照，預設為關閉、每天 `07:00–23:00`、每 60 分鐘。使用者可選擇 30、60 或 90 分鐘間隔；第一版只接受同一天內開始時間早於結束時間的時段。

關閉提醒只會把 `enabled` 設為 `false`，不會清除已保存的時段與間隔。Phase 3A 不呼叫 Notification API，也不送出實際通知；這份設定會在後續加入 Web Push 時直接沿用。

既有 IndexedDB 仍維持 version 1。載入舊快照時，如果其他資料有效但缺少 `reminderSettings`，會自動補上預設值，不需要 object store migration。

## PWA 資源與更新流程

1. Production build 產生 Manifest、Service Worker 與帶版本的靜態資源清單；開發模式不註冊 Service Worker。
2. 首次線上開啟後，Service Worker 預先快取 App shell、樣式與圖示，之後可離線重新載入前端入口。
3. 喝水資料仍只由 IndexedDB 管理，不會寫入 Cache Storage，也不會使用 localStorage 備份。
4. localStorage 只保存「已關閉主動安裝提示」這個非關鍵 UI 決定。
5. 新 Service Worker 下載完成後先等待；使用者選擇「立即更新」才啟用並重新載入頁面。
6. 全域狀態提示依序處理 IndexedDB 保存錯誤、版本更新、離線與安裝，避免多個訊息同時競爭畫面。

## GitHub Pages 發布與公開安全

1. 原始碼放在 public `21godman/drink-water` repository，網站由 `gh-pages` branch 提供。
2. 發布只在本機手動執行；指令會先完成 lint、測試與 `/drink-water/` base 的 production build，再推送 `dist/`。
3. 本機開發與一般 build 維持 `/` base，避免 GitHub Pages 子路徑影響本機流程。
4. 網站使用 robots metadata 降低搜尋曝光，但所有前端程式與 `pages.dev` 類似的公開網站一樣，都不能保存任何秘密。
5. 未來只有 Supabase URL、publishable key 與 VAPID public key 可進入前端；secret／service-role key、VAPID private key 與管理憑證只能存在受控後端。
6. Supabase Auth 採管理員邀請與個別 Email 密碼；公開註冊與匿名登入關閉，Database 以 RLS 限制每位使用者只能存取自己的 rows。

## 七日保存規則

七天是裝置本地時區的今天加前 6 個日曆日，而不是精確 168 小時。清理界線是今天往前第 6 天的 00:00；未來時間與更早時間都不能作為有效紀錄。

過期喝水紀錄會從 IndexedDB 永久刪除。Profile、containers 與 App 設定會持續保留，直到使用者在設定頁確認清除全部本機資料。

## 最終三層架構

### 1. React PWA

使用者看見與操作的 App。現在已可安裝並離線啟動；元件、型別、reducer 和資料庫介面會繼續沿用。

### 2. 手機 IndexedDB

目前已保存 profile、containers、records、reminder settings 與 App 設定。完整飲水明細只留在使用者裝置，因此不需要帳號；離線時仍可直接使用。

### 3. Supabase

未來只處理 App 關閉後仍需運作的能力：一次性邀請碼、裝置與 Web Push subscription、今日目標與累計，以及排程提醒。它不會取代 IndexedDB，也不保存完整喝水明細。

## 開發順序

1. **已完成：**互動介面與 IndexedDB 七日本機持久化。
2. **已完成：**PWA 安裝、離線資源快取與版本更新提示。
3. **已完成：**Public GitHub repository 與手動 GitHub Pages 部署設定。
4. **已完成：**本機提醒開關、時段與固定間隔偏好。
5. 加入邀請制 Supabase Auth、最小提醒後端與真正的 Web Push。
6. 依飲水進度加入智慧提醒。

## 為什麼仍保持簡單

目前不需要伺服器端渲染、完整會員系統、路由框架或狀態管理套件。IndexedDB 使用原生 API，以一份 AppState 原子快照保存；對七日資料量而言足夠簡單可靠。若未來改為長期歷史或大量查詢，再遷移成多個 object store 與索引即可。
