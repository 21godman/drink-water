import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
} from "react";
import type { CloudReminders } from "./cloudTypes";
import { isCompleteInviteCode, normalizeInviteCode } from "./cloudUtils";
import { cloudConfiguration } from "./supabaseClient";
import TurnstileWidget from "./TurnstileWidget";
import type {
  AppAction,
  ReminderIntervalMinutes,
  ReminderSettings,
} from "./types";
import type { PwaStatus } from "./usePwaStatus";

type CloudReminderCardProps = {
  settings: ReminderSettings;
  dispatch: Dispatch<AppAction>;
  cloud: CloudReminders;
  pwa: Pick<
    PwaStatus,
    "canInstall" | "installMode" | "install" | "isInstalled"
  >;
};

const REMINDER_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, "0");
  const minute = index % 2 === 0 ? "00" : "30";
  return `${hour}:${minute}`;
});

function scheduleValid(settings: ReminderSettings): boolean {
  const validTime = /^(?:[01]\d|2[0-3]):(?:00|30)$/;
  return (
    validTime.test(settings.startTime) &&
    validTime.test(settings.endTime) &&
    settings.startTime < settings.endTime
  );
}

function nextReminderLabel(
  enabled: boolean,
  nextReminderAt: string | null,
): string {
  if (nextReminderAt) {
    const nextReminder = new Date(nextReminderAt);
    if (Number.isNaN(nextReminder.getTime())) return "正在重新讀取時間";
    return nextReminder.toLocaleString("zh-TW", {
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return enabled ? "正在等待伺服器排程" : "提醒目前已關閉";
}

function ReminderFields({
  settings,
  onChange,
}: {
  settings: ReminderSettings;
  onChange: (settings: ReminderSettings) => void;
}) {
  return (
    <>
      <div className="field-grid reminder-time-grid">
        <label className="field">
          <span>每日開始時間</span>
          <select
            value={settings.startTime}
            onChange={(event) =>
              onChange({ ...settings, startTime: event.target.value })
            }
          >
            {REMINDER_TIME_OPTIONS.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>每日結束時間</span>
          <select
            value={settings.endTime}
            onChange={(event) =>
              onChange({ ...settings, endTime: event.target.value })
            }
          >
            {REMINDER_TIME_OPTIONS.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="reminder-interval-heading">提醒間隔</div>
      <div
        className="segmented-control settings-segment reminder-interval"
        aria-label="提醒間隔"
      >
        {([30, 60, 90] as const).map((minutes) => (
          <label
            className={settings.intervalMinutes === minutes ? "selected" : ""}
            key={minutes}
          >
            <input
              type="radio"
              name="reminder-interval"
              checked={settings.intervalMinutes === minutes}
              onChange={() =>
                onChange({
                  ...settings,
                  intervalMinutes: minutes as ReminderIntervalMinutes,
                })
              }
            />
            {minutes} 分鐘
          </label>
        ))}
      </div>
    </>
  );
}

function LocalReminderCard({
  settings,
  dispatch,
}: Pick<CloudReminderCardProps, "settings" | "dispatch">) {
  const [draft, setDraft] = useState(settings);
  const [message, setMessage] = useState("");

  useEffect(() => setDraft(settings), [settings]);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scheduleValid(draft)) {
      setMessage("結束時間必須晚於開始時間，且不能跨越午夜；時間只能選整點或半點。");
      return;
    }
    dispatch({ type: "updateReminderSettings", settings: draft });
    setMessage("提醒設定已儲存");
  }

  return (
    <section className="settings-card reminder-card" aria-labelledby="reminder-title">
      <div className="settings-heading">
        <span className="settings-icon" aria-hidden="true">◷</span>
        <div>
          <h2 id="reminder-title">喝水提醒</h2>
          <p>{settings.enabled ? "已開啟提醒偏好" : "目前已關閉"}</p>
        </div>
        <label className="switch">
          <input
            aria-label="切換喝水提醒"
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => {
              setMessage("");
              dispatch({
                type: "updateReminderSettings",
                settings: { ...settings, enabled: event.target.checked },
              });
            }}
          />
          <span aria-hidden="true" />
        </label>
      </div>
      {settings.enabled ? (
        <form onSubmit={save}>
          <ReminderFields
            settings={draft}
            onChange={(next) => {
              setDraft(next);
              setMessage("");
            }}
          />
          <div className="settings-save-row">
            <span
              className={message.includes("已儲存") ? "success-message" : "form-error"}
              role={message && !message.includes("已儲存") ? "alert" : "status"}
            >
              {message}
            </span>
            <button className="secondary-button" type="submit">
              儲存提醒設定
            </button>
          </div>
        </form>
      ) : (
        <p className="reminder-summary">
          目前保存：每天 {settings.startTime}–{settings.endTime}，每{" "}
          {settings.intervalMinutes} 分鐘。
        </p>
      )}
      <p className="reminder-notice">
        尚未設定 Supabase 與 Web Push；目前只保存本機提醒偏好。
      </p>
    </section>
  );
}

export default function CloudReminderCard({
  settings,
  dispatch,
  cloud,
  pwa,
}: CloudReminderCardProps) {
  const [draft, setDraft] = useState(settings);
  const [inviteCode, setInviteCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => setDraft(settings), [settings]);

  const handleCaptchaToken = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);
  const handleCaptchaError = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
  }, []);

  if (!cloud.configured) {
    return <LocalReminderCard settings={settings} dispatch={dispatch} />;
  }

  async function redeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isCompleteInviteCode(inviteCode)) {
      setMessage("請輸入完整的 20 碼邀請碼。");
      return;
    }
    setMessage("");
    try {
      await cloud.redeemInvite(inviteCode, captchaToken);
      setMessage("這台裝置已成功加入");
      setInviteCode("");
      setCaptchaToken("");
    } catch {
      // The cloud hook exposes a stable reader-facing error below.
    }
  }

  async function enable() {
    setMessage("");
    try {
      await cloud.enableReminders({ ...draft, enabled: true });
      dispatch({
        type: "updateReminderSettings",
        settings: { ...draft, enabled: true },
      });
      setMessage("系統提醒已開啟");
    } catch {
      // The cloud hook exposes a stable reader-facing error below.
    }
  }

  async function disable() {
    setMessage("");
    try {
      await cloud.disableReminders({ ...draft, enabled: false });
      dispatch({
        type: "updateReminderSettings",
        settings: { ...draft, enabled: false },
      });
      setMessage("系統提醒已關閉");
    } catch {
      // The cloud hook exposes a stable reader-facing error below.
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scheduleValid(draft)) {
      setMessage("結束時間必須晚於開始時間，且不能跨越午夜；時間只能選整點或半點。");
      return;
    }
    setMessage("");
    try {
      await cloud.saveReminderSettings(draft);
      dispatch({ type: "updateReminderSettings", settings: draft });
      setMessage("提醒設定已同步");
    } catch {
      // The cloud hook exposes a stable reader-facing error below.
    }
  }

  async function createInvite() {
    setMessage("");
    try {
      await cloud.createInvite();
    } catch {
      // The cloud hook exposes a stable reader-facing error below.
    }
  }

  async function testReminder() {
    setMessage("");
    try {
      await cloud.testReminder();
      setMessage("測試通知已送出，請查看通知中心");
    } catch {
      // The cloud hook exposes a stable reader-facing error below.
    }
  }

  async function copyInvite() {
    if (!cloud.generatedInvite) return;
    try {
      await navigator.clipboard.writeText(cloud.generatedInvite.code);
      setMessage("邀請碼已複製");
    } catch {
      setMessage("無法自動複製，請長按邀請碼複製。");
    }
  }

  const displayedError = cloud.error ?? (
    message.includes("失敗") ||
    message.includes("無法") ||
    message.includes("請")
      ? message
      : ""
  );
  const installedRequired =
    !pwa.isInstalled &&
    (pwa.installMode === "ios-safari" || pwa.installMode === "ios-other");

  return (
    <section className="settings-card reminder-card" aria-labelledby="reminder-title">
      <div className="settings-heading">
        <span className="settings-icon" aria-hidden="true">◷</span>
        <div>
          <h2 id="reminder-title">喝水提醒</h2>
          <p>
            {cloud.loading
              ? "正在確認裝置身分…"
              : cloud.membershipRole
                ? `${cloud.membershipRole === "owner" ? "Owner" : "成員"}裝置`
                : "需要邀請碼"}
          </p>
        </div>
        {cloud.membershipRole && cloud.subscriptionActive ? (
          <label className="switch">
            <input
              aria-label="切換喝水提醒"
              type="checkbox"
              checked={settings.enabled}
              disabled={cloud.busy}
              onChange={() => void (settings.enabled ? disable() : enable())}
            />
            <span aria-hidden="true" />
          </label>
        ) : null}
      </div>

      {cloud.loading ? (
        <p className="reminder-summary" role="status">正在讀取雲端狀態…</p>
      ) : !cloud.membershipRole ? (
        <form className="invite-redeem-form" onSubmit={redeem}>
          <p className="reminder-summary">
            每組邀請碼只能使用一次，成功後身分會綁定這台裝置。
          </p>
          <label className="field full-width">
            <span>邀請碼</span>
            <input
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
              maxLength={24}
              placeholder="ABCD-EF12-3456-789A-BCDE"
              type="text"
              value={inviteCode}
              onChange={(event) => {
                setInviteCode(normalizeInviteCode(event.target.value));
                setMessage("");
                cloud.clearError();
              }}
            />
          </label>
          <TurnstileWidget
            siteKey={cloudConfiguration.turnstileSiteKey}
            onToken={handleCaptchaToken}
            onError={handleCaptchaError}
          />
          <button
            className="secondary-button full-width-button"
            disabled={
              cloud.busy ||
              !captchaToken ||
              !isCompleteInviteCode(inviteCode)
            }
            type="submit"
          >
            {cloud.busy ? "正在驗證…" : "使用邀請碼加入"}
          </button>
        </form>
      ) : (
        <>
          {installedRequired ? (
            <div className="cloud-step-card">
              <strong>先安裝到 iPhone 主畫面</strong>
              <p>
                {pwa.installMode === "ios-safari"
                  ? "點 Safari 分享按鈕，再選擇「加入主畫面」，並從新圖示開啟。"
                  : "請先改用 Safari 開啟，再從分享選單加入主畫面。"}
              </p>
            </div>
          ) : !cloud.subscriptionActive ? (
            <div className="cloud-step-card">
              <strong>允許這台裝置接收通知</strong>
              <p>
                權限只會在你按下按鈕後詢問；拒絕後需到裝置設定重新允許。
              </p>
              <button
                className="secondary-button"
                disabled={cloud.busy}
                type="button"
                onClick={() => void enable()}
              >
                {cloud.busy ? "正在連接…" : "允許通知並開啟提醒"}
              </button>
            </div>
          ) : null}

          <form onSubmit={save}>
            <ReminderFields
              settings={draft}
              onChange={(next) => {
                setDraft(next);
                setMessage("");
                cloud.clearError();
              }}
            />
            <div className="settings-save-row">
              <span
                className={displayedError ? "form-error" : "success-message"}
                role={displayedError ? "alert" : "status"}
              >
                {displayedError || message}
              </span>
              <button
                className="secondary-button"
                disabled={cloud.busy || !scheduleValid(draft)}
                type="submit"
              >
                儲存並同步
              </button>
            </div>
          </form>

          <div className="reminder-delivery-row">
            <div>
              <strong>下次通知時間</strong>
              <p>{nextReminderLabel(settings.enabled, cloud.nextReminderAt)}</p>
            </div>
            <button
              className="secondary-button"
              disabled={
                cloud.busy ||
                !cloud.subscriptionActive ||
                cloud.notificationPermission !== "granted"
              }
              type="button"
              onClick={() => void testReminder()}
            >
              {cloud.busy ? "正在處理…" : "測試通知"}
            </button>
          </div>

          <p className="reminder-notice">
            {cloud.notificationPermission === "denied"
              ? "通知權限已被拒絕，請到裝置的通知設定重新允許。"
              : `時區：${Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"}。關閉提醒不會移除這台裝置。`}
          </p>

          {cloud.membershipRole === "owner" ? (
            <div className="owner-invite-panel">
              <div>
                <strong>邀請其他裝置</strong>
                <p>新代碼只顯示一次，24 小時後失效。</p>
              </div>
              <button
                className="text-button"
                disabled={cloud.busy}
                type="button"
                onClick={() => void createInvite()}
              >
                產生邀請碼
              </button>
            </div>
          ) : null}
        </>
      )}

      {displayedError && !cloud.membershipRole ? (
        <p className="form-error" role="alert">{displayedError}</p>
      ) : null}

      {cloud.generatedInvite ? (
        <div
          className="invite-code-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="generated-invite-title"
        >
          <div>
            <p className="overline">只顯示這一次</p>
            <h3 id="generated-invite-title">新的邀請碼</h3>
            <code>{cloud.generatedInvite.code}</code>
            <p>
              到期：{new Date(cloud.generatedInvite.expiresAt).toLocaleString("zh-TW")}
            </p>
            <div className="dialog-actions">
              <button className="secondary-button" type="button" onClick={() => void copyInvite()}>
                複製
              </button>
              <button className="primary-button" type="button" onClick={cloud.clearGeneratedInvite}>
                完成
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
