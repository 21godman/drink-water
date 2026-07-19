import { useEffect, useState, type Dispatch, type FormEvent } from "react";
import { createDemoRecords, createId, getDailyGoal } from "./appState";
import type { AppAction, AppState, Container, UserProfile } from "./types";

type SettingsViewProps = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

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

export default function SettingsView({ state, dispatch }: SettingsViewProps) {
  const profile = state.profile!;
  const [height, setHeight] = useState(String(profile.heightCm));
  const [weight, setWeight] = useState(String(profile.weightKg));
  const [goalMode, setGoalMode] = useState<UserProfile["goalMode"]>(profile.goalMode);
  const [customGoal, setCustomGoal] = useState(profile.customGoalMl ? String(profile.customGoalMl) : "");
  const [profileMessage, setProfileMessage] = useState("");
  const [containerDialog, setContainerDialog] = useState<Container | "new" | null>(null);

  useEffect(() => {
    setHeight(String(profile.heightCm));
    setWeight(String(profile.weightKg));
    setGoalMode(profile.goalMode);
    setCustomGoal(profile.customGoalMl ? String(profile.customGoalMl) : "");
  }, [profile]);

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
        <div className="settings-heading"><span className="settings-icon" aria-hidden="true">⌁</span><div><h2 id="demo-title">30 天示範資料</h2><p>預覽有歷史紀錄時的趨勢圖</p></div>
          <label className="switch"><input aria-label="切換 30 天示範資料" type="checkbox" checked={state.demoEnabled} onChange={(event) => dispatch({ type: "setDemoData", enabled: event.target.checked, records: event.target.checked ? createDemoRecords(getDailyGoal(profile)) : [] })} /><span aria-hidden="true" /></label>
        </div>
        <p className="demo-note">關閉只會移除示範資料，不會影響你在本次使用中新增的紀錄。</p>
      </section>

      <aside className="prototype-notice"><span aria-hidden="true">i</span><p><strong>這是互動介面原型</strong>資料只保留在目前畫面中，重新整理後會重置。IndexedDB 與離線能力會在下一階段加入。</p></aside>

      {containerDialog ? <ContainerDialog container={containerDialog === "new" ? null : containerDialog} canDelete={state.containers.length > 1} dispatch={dispatch} onClose={() => setContainerDialog(null)} /> : null}
    </div>
  );
}
