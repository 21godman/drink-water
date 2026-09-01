import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
} from "react";
import type { CloudReminders } from "./cloudTypes";
import { isCompleteInviteCode, normalizeInviteCode } from "./cloudUtils";
import { translate, useI18n } from "./i18n";
import { cloudConfiguration } from "./supabaseClient";
import TurnstileWidget from "./TurnstileWidget";
import type {
  AppAction,
  ReminderIntervalMinutes,
  ReminderSettings,
  AppLanguage,
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
  language: AppLanguage,
  locale: string,
): string {
  if (nextReminderAt) {
    const nextReminder = new Date(nextReminderAt);
    if (Number.isNaN(nextReminder.getTime())) return translate(language, "reminder.reloadingTime");
    return nextReminder.toLocaleString(locale, {
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return enabled
    ? translate(language, "reminder.waitingSchedule")
    : translate(language, "reminder.offStatus");
}

function ReminderFields({
  settings,
  onChange,
}: {
  settings: ReminderSettings;
  onChange: (settings: ReminderSettings) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <div className="field-grid reminder-time-grid">
        <label className="field">
          <span>{t("reminder.start")}</span>
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
          <span>{t("reminder.end")}</span>
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
      <div className="reminder-interval-heading">{t("reminder.interval")}</div>
      <div
        className="segmented-control settings-segment reminder-interval"
        aria-label={t("reminder.interval")}
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
            {t("common.minutes", { count: minutes })}
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
  const { t } = useI18n();
  const [draft, setDraft] = useState(settings);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scheduleValid(draft)) {
      setMessage(t("reminder.invalidSchedule"));
      setMessageIsError(true);
      return;
    }
    dispatch({ type: "updateReminderSettings", settings: draft });
    setMessage(t("reminder.saved"));
    setMessageIsError(false);
  }

  return (
    <section className="settings-card reminder-card" aria-labelledby="reminder-title">
      <div className="settings-heading">
        <span className="settings-icon" aria-hidden="true">◷</span>
        <div>
          <h2 id="reminder-title">{t("reminder.title")}</h2>
          <p>{settings.enabled ? t("reminder.enabledPreference") : t("reminder.off")}</p>
        </div>
        <label className="switch">
          <input
            aria-label={t("reminder.toggleAria")}
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => {
              setMessage("");
              setMessageIsError(false);
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
              setMessageIsError(false);
            }}
          />
          <div className="settings-save-row">
            <span
              className={messageIsError ? "form-error" : "success-message"}
              role={messageIsError ? "alert" : "status"}
            >
              {message}
            </span>
            <button className="secondary-button" type="submit">
              {t("reminder.save")}
            </button>
          </div>
        </form>
      ) : (
        <p className="reminder-summary">
          {t("reminder.localSummary", {
            start: settings.startTime,
            end: settings.endTime,
            minutes: settings.intervalMinutes,
          })}
        </p>
      )}
      <p className="reminder-notice">
        {t("reminder.localNotice")}
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
  const { language, locale, t } = useI18n();
  const [draft, setDraft] = useState(settings);
  const [inviteCode, setInviteCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  const handleCaptchaToken = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);
  const handleCaptchaError = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
    setMessageIsError(true);
  }, []);

  if (!cloud.configured) {
    return <LocalReminderCard settings={settings} dispatch={dispatch} />;
  }

  async function redeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isCompleteInviteCode(inviteCode)) {
      setMessage(t("reminder.inviteIncomplete"));
      setMessageIsError(true);
      return;
    }
    setMessage("");
    setMessageIsError(false);
    try {
      await cloud.redeemInvite(inviteCode, captchaToken);
      setMessage(t("reminder.joined"));
      setInviteCode("");
      setCaptchaToken("");
    } catch {
      // The cloud hook exposes a stable reader-facing error below.
    }
  }

  async function enable() {
    setMessage("");
    setMessageIsError(false);
    try {
      await cloud.enableReminders({ ...draft, enabled: true });
      dispatch({
        type: "updateReminderSettings",
        settings: { ...draft, enabled: true },
      });
      setMessage(t("reminder.systemEnabled"));
    } catch {
      // The cloud hook exposes a stable reader-facing error below.
    }
  }

  async function disable() {
    setMessage("");
    setMessageIsError(false);
    try {
      await cloud.disableReminders({ ...draft, enabled: false });
      dispatch({
        type: "updateReminderSettings",
        settings: { ...draft, enabled: false },
      });
      setMessage(t("reminder.systemDisabled"));
    } catch {
      // The cloud hook exposes a stable reader-facing error below.
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scheduleValid(draft)) {
      setMessage(t("reminder.invalidSchedule"));
      setMessageIsError(true);
      return;
    }
    setMessage("");
    setMessageIsError(false);
    try {
      await cloud.saveReminderSettings(draft);
      dispatch({ type: "updateReminderSettings", settings: draft });
      setMessage(t("reminder.synced"));
    } catch {
      // The cloud hook exposes a stable reader-facing error below.
    }
  }

  async function createInvite() {
    setMessage("");
    setMessageIsError(false);
    try {
      await cloud.createInvite();
    } catch {
      // The cloud hook exposes a stable reader-facing error below.
    }
  }

  async function testReminder() {
    setMessage("");
    setMessageIsError(false);
    try {
      await cloud.testReminder();
      setMessage(t("reminder.testSent"));
    } catch {
      // The cloud hook exposes a stable reader-facing error below.
    }
  }

  async function copyInvite() {
    if (!cloud.generatedInvite) return;
    try {
      await navigator.clipboard.writeText(cloud.generatedInvite.code);
      setMessage(t("reminder.inviteCopied"));
      setMessageIsError(false);
    } catch {
      setMessage(t("reminder.copyFailed"));
      setMessageIsError(true);
    }
  }

  const displayedError = cloud.error ?? (messageIsError ? message : "");
  const installedRequired =
    !pwa.isInstalled &&
    (pwa.installMode === "ios-safari" || pwa.installMode === "ios-other");

  return (
    <section className="settings-card reminder-card" aria-labelledby="reminder-title">
      <div className="settings-heading">
        <span className="settings-icon" aria-hidden="true">◷</span>
        <div>
          <h2 id="reminder-title">{t("reminder.title")}</h2>
          <p>
            {cloud.loading
              ? t("reminder.checkingIdentity")
              : cloud.membershipRole
                ? t(cloud.membershipRole === "owner" ? "reminder.ownerDevice" : "reminder.memberDevice")
                : t("reminder.inviteRequired")}
          </p>
        </div>
        {cloud.membershipRole && cloud.subscriptionActive ? (
          <label className="switch">
            <input
              aria-label={t("reminder.toggleAria")}
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
        <p className="reminder-summary" role="status">{t("reminder.loadingCloud")}</p>
      ) : !cloud.membershipRole ? (
        <form className="invite-redeem-form" onSubmit={redeem}>
          <p className="reminder-summary">
            {t("reminder.inviteOnce")}
          </p>
          <label className="field full-width">
            <span>{t("reminder.inviteCode")}</span>
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
                setMessageIsError(false);
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
            {cloud.busy ? t("reminder.verifying") : t("reminder.join")}
          </button>
        </form>
      ) : (
        <>
          {installedRequired ? (
            <div className="cloud-step-card">
              <strong>{t("reminder.installIphone")}</strong>
              <p>
                {pwa.installMode === "ios-safari"
                  ? t("reminder.iosSafariInstall")
                  : t("reminder.iosOtherInstall")}
              </p>
            </div>
          ) : !cloud.subscriptionActive ? (
            <div className="cloud-step-card">
              <strong>{t("reminder.allowTitle")}</strong>
              <p>
                {t("reminder.allowBody")}
              </p>
              <button
                className="secondary-button"
                disabled={cloud.busy}
                type="button"
                onClick={() => void enable()}
              >
                {cloud.busy ? t("reminder.connecting") : t("reminder.allowButton")}
              </button>
            </div>
          ) : null}

          <form onSubmit={save}>
            <ReminderFields
              settings={draft}
              onChange={(next) => {
                setDraft(next);
                setMessage("");
                setMessageIsError(false);
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
                {t("reminder.saveSync")}
              </button>
            </div>
          </form>

          <div className="reminder-delivery-row">
            <div>
              <strong>{t("reminder.nextTime")}</strong>
              <p>{nextReminderLabel(settings.enabled, cloud.nextReminderAt, language, locale)}</p>
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
              {cloud.busy ? t("reminder.processing") : t("reminder.test")}
            </button>
          </div>

          <p className="reminder-notice">
            {cloud.notificationPermission === "denied"
              ? t("reminder.permissionDenied")
              : t("reminder.timezone", { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" })}
          </p>

          {cloud.membershipRole === "owner" ? (
            <div className="owner-invite-panel">
              <div>
                <strong>{t("reminder.inviteOthers")}</strong>
                <p>{t("reminder.inviteExpiry")}</p>
              </div>
              <button
                className="text-button"
                disabled={cloud.busy}
                type="button"
                onClick={() => void createInvite()}
              >
                {t("reminder.createInvite")}
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
            <p className="overline">{t("reminder.once")}</p>
            <h3 id="generated-invite-title">{t("reminder.newInvite")}</h3>
            <code>{cloud.generatedInvite.code}</code>
            <p>
              {t("reminder.expires", { time: new Date(cloud.generatedInvite.expiresAt).toLocaleString(locale) })}
            </p>
            <div className="dialog-actions">
              <button className="secondary-button" type="button" onClick={() => void copyInvite()}>
                {t("reminder.copy")}
              </button>
              <button className="primary-button" type="button" onClick={cloud.clearGeneratedInvite}>
                {t("reminder.done")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
