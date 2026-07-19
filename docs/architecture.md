# drink-water 架構說明

這份文件說明目前互動原型的邊界，以及未來如何沿用同一份資料模型逐步加入本機儲存、PWA 與提醒後端。

## 現在的階段

目前是 **Phase 1A：互動介面原型**。

已經有：

- 手機優先的首次設定、今日、歷史與設定介面。
- `UserProfile`、`Container`、`DrinkRecord` 三個核心型別。
- 集中式 reducer，處理喝水紀錄、個人目標、容器和示範資料。
- 公式目標 `(身高 cm＋體重 kg) × 10` 與手動覆寫模式。
- 原生 CSS／SVG 的 30 天趨勢圖。

還沒有：

- IndexedDB 或任何重新整理後仍存在的資料。
- Web App Manifest、Service Worker 或離線快取。
- Supabase 資料表、Edge Function、邀請碼或 Web Push。
- GitHub remote 或部署設定。

## 原型內的資料流

`App.tsx` 是 App shell，保有 reducer 狀態與目前分頁。各頁面只透過 typed action 發出變更：

1. 首次設定建立 `UserProfile` 與第一個 `Container`。
2. 今日頁點選容器，建立帶有本地時間的 `DrinkRecord`。
3. reducer 更新記憶體狀態。
4. 今日進度和 30 天統計直接從最新紀錄衍生，不另存重複總數。
5. 重新整理頁面後回到空白初始狀態，這是本階段的預期行為。

示範紀錄以 `isDemo` 標記，關閉示範資料時只移除該標記的紀錄，因此本次操作產生的真實紀錄會保留。

## 最終三層架構

### 1. React PWA

使用者看見與操作的 App。現在的元件、型別、reducer 和視覺流程都會繼續沿用。

### 2. 手機 IndexedDB

下一階段會將 profile、containers 與 records 寫入 IndexedDB。完整明細留在使用者裝置，因此離線仍能記錄、不需要帳號，後端也不保存完整健康與生活資料。

### 3. Supabase

Supabase 只處理 App 關閉後仍需運作的能力：一次性邀請碼、裝置與 Web Push subscription、今日目標與累計，以及排程提醒。它不會取代 IndexedDB，也不保存完整飲水明細。

## 開發順序

1. **目前：**驗證完整互動介面與資料規則。
2. 將 reducer 狀態接到 IndexedDB，完成真正的本機喝水 MVP。
3. 加入 PWA 安裝與離線能力。
4. 加入最小 Supabase 後端。
5. 加入一次性邀請碼與智慧提醒。
6. 建立 private GitHub repository 並選擇部署平台。

## 為什麼仍保持簡單

目前不需要伺服器端渲染、完整會員系統、路由框架、狀態管理套件或圖表套件。先用 React 內建能力驗證核心體驗，可以降低維護成本；之後加入 IndexedDB 或 Supabase 時，也不需要重寫現有畫面和資料型別。
