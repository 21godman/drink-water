import { useEffect, useState, type Dispatch, type FormEvent } from "react";
import { createDemoRecords, createId, getDailyGoal } from "./appState";
import type {
  AppAction,
  AppState,
  Container,
  ReminderIntervalMinutes,
  UserProfile,
} from "./types";
import type { PwaStatus } from "./usePwaStatus";

type SettingsViewProps = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  onClearData: () => Promise<void>;
  pwa: Pick<PwaStatus, "canInstall" | "installMode" | "install">;
};

export function PwaInstallCard({
  canInstall,
  installMode,
  install,
}: SettingsViewProps["pwa"]) {
  if (!canInstall) return null;

  const nativeInstall = installMode === "native";
  const description = nativeInstall
    ? "安裝後可從手機桌面直接開啟，離線時也能使用。"
    : installMode === "ios-safari"
      ? "點 Safari 的分享按鈕，再選擇「加入主畫面」。"
      : "請先用 Safari 開啟這個頁面，再從分享選單加入主畫面。";

  return (
    <section className="settings-card install-card" aria-labelledby="install-title">
      <div className="settings-heading">
        <span className="settings-icon" aria-hidden="true">⇩</span>
        <div>
          <h2 id="install-title">安裝到手機</h2>
          <p>更快開啟，也能離線使用</p>
        </div>
      </div>
      <div className="install-card-content">
        <p>{description}</p>
        {nativeInstall ? (
          <button className="secondary-button" type="button" onClick={() => void install()}>
            安裝到裝置
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ContainerDialog({
  container,
  canDelete,
  dispatch,
  onClose,
}: {
  container: Container | null;
  canDelete: boolean;
  dispatch: Dispatch<AppAction>;
  onClose: () => void;
}) {
  const [name, setName] = useState(container?.name ?? "");
  const [volume, setVolume] = useState(container ? String(container.volumeMl) : "");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedVolume = Number(volume);
    if (!name.trim() || !Number.isFinite(parsedVolume) || parsedVolume <= 0) {
      setError("請輸入容器名稱與有效容量。");
      return;
    }

    dispatch(
      container
        ? {
            type: "updateContainer",
            container: { ...container, name: name.trim(), volumeMl: parsedVolume },
          }
        : {
            type: "addContainer",
            container: { id: createId("container"), name: name.trim(), volumeMl: parsedVolume },
          },
    );
    onClose();
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="container-dialog-title">
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-heading">
          <div><p className="overline">常用容器</p><h2 id="container-dialog-title">{container ? "編輯容器" : "新增容器"}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="關閉容器設定">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="field"><span>容器名稱</span><input type="text" value={name} placeholder="例如：辦公室馬克杯" onChange={(event) => setName(event.target.value)} /></label>
          <label className="field"><span>容量</span><span className="input-with-unit"><input min="1" inputMode="numeric" type="number" value={volume} placeholder="350" onChange={(event) => setVolume(event.target.value)} /><small>mL</small></span></label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="dialog-actions">
            {container ? (
              <button
                className="danger-button"
                disabled={!canDelete}
                title={!canDelete ? "請先新增另一個容器" : undefined}
                type="button"
                onClick={() => {
                  dispatch({ type: "deleteContainer", id: container.id });
                  onClose();
                }}
              >刪除容器</button>
            ) : <span />}
            <button className="primary-button" type="submit">{container ? "儲存變更" : "加入容器"}</button>
          </div>
          {container && !canDelete ? <p className="last-container-note">至少需要保留一個容器，請先新增另一個再刪除。</p> : null}
        </form>
      </section>
    </div>
  );
}

export default function SettingsView({ state, dispatch, onClearData, pwa }: SettingsViewProps) {
  const profile = state.profile!;
  const [height, setHeight] = useState(String(profile.heightCm));
  const [weight, setWeight] = useState(String(profile.weightKg));
  const [goalMode, setGoalMode] = useState<UserProfile["goalMode"]>(profile.goalMode);
  const [customGoal, setCustomGoal] = useState(profile.customGoalMl ? String(profile.customGoalMl) : "");
  const [profileMessage, setProfileMessage] = useState("");
  const [reminderStartTime, setReminderStartTime] = useState(
    state.reminderSettings.startTime,
  );
  const [reminderEndTime, setReminderEndTime] = useState(
    state.reminderSettings.endTime,
  );
  const [reminderInterval, setReminderInterval] =
    useState<ReminderIntervalMinutes>(state.reminderSettings.intervalMinutes);
  const [reminderMessage, setReminderMessage] = useState("");
  const [containerDialog, setContainerDialog] = useState<Container | "new" | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearError, setClearError] = useState("");
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    setHeight(String(profile.heightCm));
    setWeight(String(profile.weightKg));
    setGoalMode(profile.goalMode);
    setCustomGoal(profile.customGoalMl ? String(profile.customGoalMl) : "");
  }, [profile]);

  useEffect(() => {
    setReminderStartTime(state.reminderSettings.startTime);
    setReminderEndTime(state.reminderSettings.endTime);
    setReminderInterval(state.reminderSettings.intervalMinutes);
  }, [state.reminderSettings]);

  const draftProfile: UserProfile = {
    heightCm: Number(height),
    weightKg: Number(weight),
    goalMode,
    customGoalMl: customGoal ? Number(customGoal) : null,
  };
  const draftValid =
    draftProfile.heightCm > 0 &&
    draftProfile.weightKg > 0 &&
    (goalMode === "formula" || Boolean(draftProfile.customGoalMl && draftProfile.customGoalMl > 0));

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftValid) {
      setProfileMessage("請輸入有效的身高、體重與每日目標。");
      return;
    }
    dispatch({ type: "updateProfile", profile: draftProfile });
    setProfileMessage("設定已更新");
  }

  function saveReminderSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (
      !validTime.test(reminderStartTime) ||
      !validTime.test(reminderEndTime) ||
      reminderStartTime >= reminderEndTime
    ) {
      setReminderMessage("結束時間必須晚於開始時間，且不能跨越午夜。");
      return;
    }

    dispatch({
      type: "updateReminderSettings",
      settings: {
        enabled: state.reminderSettings.enabled,
        startTime: reminderStartTime,
        endTime: reminderEndTime,
        intervalMinutes: reminderInterval,
      },
    });
    setReminderMessage("提醒設定已儲存");
  }

  return (
    <div className="view-shell settings-view">
      <header className="app-header"><div><p className="overline">Personalize</p><h1>你的設定</h1></div></header>

      <section className="settings-card" aria-labelledby="profile-title">
        <div className="settings-heading"><span className="settings-icon" aria-hidden="true">◎</span><div><h2 id="profile-title">身體資料與目標</h2><p>目前每日目標 {getDailyGoal(profile).toLocaleString()} mL</p></div></div>
        <form onSubmit={saveProfile}>
          <div className="field-grid">
            <label className="field"><span>身高</span><span className="input-with-unit"><input min="1" type="number" value={height} onChange={(event) => { setHeight(event.target.value); setProfileMessage(""); }} /><small>cm</small></span></label>
            <label className="field"><span>體重</span><span className="input-with-unit"><input min="1" type="number" value={weight} onChange={(event) => { setWeight(event.target.value); setProfileMessage(""); }} /><small>kg</small></span></label>
          </div>
          <div className="segmented-control settings-segment" aria-label="每日目標計算方式">
            <label className={goalMode === "formula" ? "selected" : ""}><input type="radio" name="settings-goal-mode" checked={goalMode === "formula"} onChange={() => { setGoalMode("formula"); setProfileMessage(""); }} />自動計算</label>
            <label className={goalMode === "custom" ? "selected" : ""}><input type="radio" name="settings-goal-mode" checked={goalMode === "custom"} onChange={() => { setGoalMode("custom"); setProfileMessage(""); }} />自訂目標</label>
          </div>
          {goalMode === "custom" ? <label className="field full-width"><span>自訂每日目標</span><span className="input-with-unit"><input min="1" type="number" value={customGoal} onChange={(event) => { setCustomGoal(event.target.value); setProfileMessage(""); }} /><small>mL</small></span></label> : (
            <div className="formula-note"><span>公式建議值</span><strong>{draftValid ? getDailyGoal(draftProfile).toLocaleString() : "—"} mL</strong><small>（身高＋體重）× 10</small></div>
          )}
          <div className="settings-save-row"><span className={profileMessage.includes("更新") ? "success-message" : "form-error"} role="status">{profileMessage}</span><button className="secondary-button" type="submit">儲存個人設定</button></div>
        </form>
      </section>

      <section className="settings-card reminder-card" aria-labelledby="reminder-title">
        <div className="settings-heading">
          <span className="settings-icon" aria-hidden="true">◷</span>
          <div>
            <h2 id="reminder-title">喝水提醒</h2>
            <p>{state.reminderSettings.enabled ? "已開啟提醒偏好" : "目前已關閉"}</p>
          </div>
          <label className="switch">
            <input
              aria-label="切換喝水提醒"
              type="checkbox"
              checked={state.reminderSettings.enabled}
              onChange={(event) => {
                setReminderMessage("");
                dispatch({
                  type: "updateReminderSettings",
                  settings: {
                    ...state.reminderSettings,
                    enabled: event.target.checked,
                  },
                });
              }}
            />
            <span aria-hidden="true" />
          </label>
        </div>

        {state.reminderSettings.enabled ? (
          <form onSubmit={saveReminderSettings}>
            <div className="field-grid">
              <label className="field">
                <span>每日開始時間</span>
                <input
                  type="time"
                  value={reminderStartTime}
                  onChange={(event) => {
                    setReminderStartTime(event.target.value);
                    setReminderMessage("");
                  }}
                />
              </label>
              <label className="field">
                <span>每日結束時間</span>
                <input
                  type="time"
                  value={reminderEndTime}
                  onChange={(event) => {
                    setReminderEndTime(event.target.value);
                    setReminderMessage("");
                  }}
                />
              </label>
            </div>
            <div className="reminder-interval-heading">提醒間隔</div>
            <div className="segmented-control settings-segment reminder-interval" aria-label="提醒間隔">
              {([30, 60, 90] as const).map((minutes) => (
                <label className={reminderInterval === minutes ? "selected" : ""} key={minutes}>
                  <input
                    type="radio"
                    name="reminder-interval"
                    checked={reminderInterval === minutes}
                    onChange={() => {
                      setReminderInterval(minutes);
                      setReminderMessage("");
                    }}
                  />
                  {minutes} 分鐘
                </label>
              ))}
            </div>
            <div className="settings-save-row">
              <span
                className={reminderMessage.includes("已儲存") ? "success-message" : "form-error"}
                role={reminderMessage && !reminderMessage.includes("已儲存") ? "alert" : "status"}
              >{reminderMessage}</span>
              <button className="secondary-button" type="submit">儲存提醒設定</button>
            </div>
          </form>
        ) : (
          <p className="reminder-summary">
            目前保存：每天 {state.reminderSettings.startTime}–{state.reminderSettings.endTime}，每 {state.reminderSettings.intervalMinutes} 分鐘。
          </p>
        )}

        <p className="reminder-notice">目前只保存提醒偏好，尚不會發送系統通知。</p>
      </section>

      <section className="settings-card" aria-labelledby="containers-title">
        <div className="settings-heading"><span className="settings-icon" aria-hidden="true">▱</span><div><h2 id="containers-title">常用容器</h2><p>首頁的快速記水按鈕</p></div><button className="small-add-button" type="button" onClick={() => setContainerDialog("new")}>＋ 新增</button></div>
        <ul className="settings-container-list">
          {state.containers.map((container, index) => (
            <li key={container.id}>
              <span className={`tiny-vessel vessel-${(index % 3) + 1}`} aria-hidden="true" />
              <span><strong>{container.name}</strong><small>{container.volumeMl.toLocaleString()} mL</small></span>
              <button className="text-button" type="button" onClick={() => setContainerDialog(container)} aria-label={`編輯 ${container.name}`}>編輯</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-card demo-card" aria-labelledby="demo-title">
        <div className="settings-heading"><span className="settings-icon" aria-hidden="true">⌁</span><div><h2 id="demo-title">7 天示範資料</h2><p>預覽有歷史紀錄時的趨勢圖</p></div>
          <label className="switch"><input aria-label="切換 7 天示範資料" type="checkbox" checked={state.demoEnabled} onChange={(event) => dispatch({ type: "setDemoData", enabled: event.target.checked, records: event.target.checked ? createDemoRecords(getDailyGoal(profile)) : [] })} /><span aria-hidden="true" /></label>
        </div>
        <p className="demo-note">關閉只會移除示範資料，不會影響你在本次使用中新增的紀錄。</p>
      </section>

      <PwaInstallCard {...pwa} />

      <section className="settings-card data-card" aria-labelledby="local-data-title">
        <div className="settings-heading"><span className="settings-icon" aria-hidden="true">▤</span><div><h2 id="local-data-title">本機資料</h2><p>設定長期保留，喝水紀錄保留最近 7 天</p></div></div>
        <p className="data-note">資料只存在這台裝置的瀏覽器，不會上傳雲端。清除網站資料或更換裝置可能造成紀錄遺失。</p>
        <button className="clear-data-button" type="button" onClick={() => setShowClearDialog(true)}>清除全部本機資料</button>
      </section>

      {containerDialog ? <ContainerDialog container={containerDialog === "new" ? null : containerDialog} canDelete={state.containers.length > 1} dispatch={dispatch} onClose={() => setContainerDialog(null)} /> : null}
      {showClearDialog ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isClearing) setShowClearDialog(false);
        }}>
          <section className="bottom-sheet confirmation-sheet" role="alertdialog" aria-modal="true" aria-labelledby="clear-data-title" aria-describedby="clear-data-description">
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-heading">
              <div><p className="overline danger-overline">無法復原</p><h2 id="clear-data-title">清除全部本機資料？</h2></div>
              <button className="icon-button" disabled={isClearing} type="button" onClick={() => setShowClearDialog(false)} aria-label="關閉清除資料確認">×</button>
            </div>
            <p id="clear-data-description" className="confirmation-copy">身體資料、每日目標、所有容器與最近 7 天的喝水紀錄都會永久刪除。</p>
            {clearError ? <p className="form-error" role="alert">{clearError}</p> : null}
            <div className="confirmation-actions">
              <button className="secondary-button" disabled={isClearing} type="button" onClick={() => setShowClearDialog(false)}>取消</button>
              <button
                className="confirm-danger-button"
                disabled={isClearing}
                type="button"
                onClick={async () => {
                  setIsClearing(true);
                  setClearError("");
                  try {
                    await onClearData();
                    setShowClearDialog(false);
                  } catch (error) {
                    setClearError(error instanceof Error ? error.message : "無法清除本機資料");
                  } finally {
                    setIsClearing(false);
                  }
                }}
              >{isClearing ? "正在清除…" : "確認清除"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
