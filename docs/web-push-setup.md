# 純雲端 Supabase 邀請碼與 Web Push 部署

這份教學只使用 Supabase 雲端 Project，不需要 Docker，也不會在電腦上啟動另一套 Supabase。

完成後，飲水明細仍只存在使用者裝置；Supabase 只保存匿名裝置身分、成員資格、提醒設定、時區與 Push Subscription。

> 安全原則：不要把 Supabase secret key、Turnstile secret、VAPID private key、cron secret 或資料庫密碼貼進對話、寫進 Git，或放進任何 `VITE_*` 變數。

## 1. 註冊並建立 Supabase Project

1. 前往 <https://supabase.com/dashboard> 註冊或登入。
2. 建立 Free Plan organization。
3. 建立新 Project：
   - Name：`drink-water`
   - Region：優先選 Tokyo；若沒有則選 Singapore
   - Database password：使用強密碼並保存到密碼管理器
4. 等待 Project 顯示可以使用。

在 Project Dashboard 記下：

- **Project Ref**：Dashboard 網址 `/project/` 後面的識別碼。
- **Project URL**：`https://PROJECT_REF.supabase.co`
- **Publishable key**：可以放在前端的公開 key。
- **Secret key**：只能放在 Supabase Edge Function secrets。

不要把 secret key 寫進 `.env.local`。

## 2. 建立 Cloudflare Turnstile

匿名登入容易被機器人大量建立，因此使用 Turnstile 保護建立裝置身分的入口。

1. 前往 <https://dash.cloudflare.com/> 註冊或登入。
2. 進入 Turnstile，建立一個 widget。
3. Widget mode 選擇 **Managed**。
4. 允許以下 hostname：
   - `21godman.github.io`
   - `localhost`
5. 保存 **Site key** 與 **Secret key**：
   - Site key 稍後放入前端 `.env.local`。
   - Secret key 只填入 Supabase Dashboard。

接著到 Supabase Dashboard：

1. 進入 **Authentication** 設定。
2. 保持 **Allow new users to sign up** 開啟。
3. 開啟 **Allow anonymous sign-ins**。
4. 到 **Bot and Abuse Protection** 開啟 CAPTCHA protection。
5. Provider 選擇 Cloudflare Turnstile，填入 Turnstile secret key。

## 3. 從此 repository 連結雲端 Project

在專案根目錄安裝依賴：

```bash
npm install
```

登入 Supabase CLI：

```bash
npx supabase login
```

瀏覽器完成授權後，使用第一步記下的 Project Ref：

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

CLI 若詢問 database password，輸入建立 Project 時保存的密碼。不要把密碼直接寫在指令中。

先預覽會部署的 migration：

```bash
npm run supabase:check
```

確認只包含此 repository 的提醒 migration 後再部署：

```bash
npm run supabase:push
npm run supabase:lint
npm run supabase:advisors
```

`supabase:check`、`supabase:push`、`supabase:lint` 與 `supabase:advisors` 都只連線到已 linked 的雲端 Project。

## 4. 產生 Web Push 與排程秘密

產生 VAPID key pair：

```bash
npm run vapid:generate
```

終端會顯示：

- `VITE_VAPID_PUBLIC_KEY`：可公開，前端與 Edge Function 都會使用。
- `VAPID_PRIVATE_KEY`：只能放進 Supabase Edge Function secrets。

再產生 cron secret：

```bash
openssl rand -hex 32
```

將結果暫時保存在密碼管理器。下一節與建立 Cron 時必須使用完全相同的值。

## 5. 設定 Edge Function secrets

到 Supabase Dashboard 的 **Edge Functions → Secrets**，加入：

| Name | Value |
| --- | --- |
| `APP_SUPABASE_SECRET_KEY` | 第一步取得的 Supabase secret key |
| `VAPID_PUBLIC_KEY` | 第四步產生的 VAPID public key |
| `VAPID_PRIVATE_KEY` | 第四步產生的 VAPID private key |
| `VAPID_SUBJECT` | `mailto:你的 Email` |
| `CRON_SECRET` | 第四步產生的 cron secret |

不要把這些秘密建立成 repository 內的檔案。

## 6. 部署 Edge Functions

執行：

```bash
npm run supabase:deploy
```

這個指令使用 Supabase API 在雲端打包，不使用 Docker。完成後到 Dashboard 的 Edge Functions 頁面確認以下五個 Function 都存在：

- `redeem-invite`
- `create-invite`
- `register-push`
- `sync-reminder-settings`
- `send-reminders`

前四個只接受有效使用者 JWT；`send-reminders` 由 cron secret 驗證排程呼叫。

## 7. 建立每分鐘排程

在 Supabase SQL Editor 執行以下 SQL。把兩個 placeholder 換成自己的值：

```sql
select private.configure_reminder_cron(
  'https://YOUR_PROJECT_REF.supabase.co',
  'THE_SAME_CRON_SECRET_FROM_STEP_4'
);
```

成功時會回傳一個 job id。這個函式會把 Project URL 與 cron secret 保存到 Supabase Vault，並建立 `drink-water-send-reminders` job。

到 Dashboard 的 Cron 頁面確認：

- Job name 是 `drink-water-send-reminders`。
- Schedule 是每分鐘一次。
- 執行紀錄沒有持續失敗。

## 8. 設定前端環境

在 repository 根目錄建立不納入 Git 的 `.env.local`：

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
VITE_TURNSTILE_SITE_KEY=YOUR_TURNSTILE_SITE_KEY
```

這四個值會進入瀏覽器 bundle，因此只能放公開值。

先驗證：

```bash
npm run lint
npm run test
npm run build:pages
```

全部通過後發布 GitHub Pages：

```bash
npm run deploy
```

正式網站是 <https://21godman.github.io/drink-water/>。

## 9. 網站發布後建立第一位 owner

邀請碼只保留 24 小時，因此等網站可以開啟後才建立。

在 Supabase SQL Editor 執行：

```sql
select * from private.bootstrap_owner_invite();
```

結果會顯示一次 owner 邀請碼及到期時間：

1. 將正式網站加入手機主畫面。
2. 從主畫面開啟 App。
3. 到設定頁完成 Turnstile。
4. 輸入 owner 邀請碼。
5. 允許通知並開啟提醒。

成功後，owner 可以在 App 中產生一般成員邀請碼。一般邀請碼同樣只顯示一次、只能兌換一次，並在 24 小時後到期。

## 10. 驗證雲端提醒

到 Supabase Dashboard 確認：

1. `members` 有目前裝置的 active owner row。
2. `reminder_preferences` 有正確的時區、時段與間隔。
3. `push_subscriptions` 有 active subscription。
4. Cron job 持續執行。
5. Edge Function logs 沒有持續出現驗證或發送錯誤。

將提醒時段調整為目前時間附近，等待下一個排程時槽，確認 App 關閉後仍能收到系統通知。

iPhone／iPad 需要 iOS 16.4 以上，並從已加入主畫面的 PWA 開啟。通知權限必須由使用者點擊按鈕後授予。

## 11. Owner 裝置遺失時

若 owner 清除資料、刪除 PWA 或遺失手機，在 SQL Editor 執行：

```sql
select * from private.recover_owner_invite();
```

這會撤銷舊 owner、關閉舊提醒與推播訂閱，並產生一組新的 24 小時 owner 邀請碼。

App 內主動清除資料時，會先刪除 IndexedDB，再解除雲端 Push Subscription 與匿名 session；若當下離線，裝置會保存不含敏感資料的待清理旗標，並在下次啟動或恢復網路後自動重試。Owner 身分一旦解除仍無法從前端復原，需要執行上述 recovery。
