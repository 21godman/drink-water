import { useEffect, useState } from "react";
import HistoryView from "./HistoryView";
import Onboarding from "./Onboarding";
import PwaStatusBanner from "./PwaStatusBanner";
import SettingsView from "./SettingsView";
import TodayView from "./TodayView";
import type { AppView } from "./types";
import { useCloudReminders } from "./useCloudReminders";
import { usePersistentAppState } from "./usePersistentAppState";
import { usePwaStatus } from "./usePwaStatus";

const navigation: Array<{ id: AppView; label: string; icon: string }> = [
  { id: "today", label: "今日", icon: "⌂" },
  { id: "history", label: "歷史", icon: "▥" },
  { id: "settings", label: "設定", icon: "⌁" },
];

function App() {
  const pwa = usePwaStatus();
  const {
    state,
    dispatch,
    status,
    storageError,
    retryLoad,
    retrySave,
    clearLocalData,
  } = usePersistentAppState();
  const cloud = useCloudReminders({
    isInstalled: pwa.isInstalled,
    isOnline: pwa.isOnline,
  });
  const [view, setView] = useState<AppView>("today");

  async function clearAllData() {
    const newlyScheduled = cloud.prepareCloudIdentityRemoval();
    try {
      await clearLocalData();
    } catch (error) {
      if (newlyScheduled) cloud.cancelCloudIdentityRemoval();
      throw error;
    }
    await cloud.removeCloudIdentity();
  }

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [state.isOnboarded, view]);

  if (status === "loading") {
    return (
      <main className="startup-state" aria-live="polite">
        <span className="startup-drop" aria-hidden="true">水</span>
        <p>正在讀取本機紀錄…</p>
      </main>
    );
  }

  if (status === "load-error") {
    return (
      <main className="startup-state startup-error">
        <span className="startup-icon" aria-hidden="true">!</span>
        <h1>暫時讀不到本機資料</h1>
        <p>{storageError}</p>
        <button className="primary-button" type="button" onClick={retryLoad}>重新讀取</button>
      </main>
    );
  }

  if (!state.isOnboarded || !state.profile) {
    return (
      <Onboarding
        cloudCleanupPending={cloud.cloudCleanupPending}
        onComplete={(profile, container) =>
          dispatch({ type: "completeSetup", profile, container })
        }
      />
    );
  }

  return (
    <div className="app-frame">
      <PwaStatusBanner
        storageError={storageError}
        retrySave={retrySave}
        needRefresh={pwa.needRefresh}
        applyUpdate={pwa.applyUpdate}
        dismissUpdate={pwa.dismissUpdate}
        isOnline={pwa.isOnline}
        showInstallPrompt={state.isOnboarded && pwa.showInstallPrompt}
        install={pwa.install}
        dismissInstallPrompt={pwa.dismissInstallPrompt}
        offlineReady={pwa.offlineReady}
        dismissOfflineReady={pwa.dismissOfflineReady}
      />
      <main className="app-content">
        {view === "today" ? (
          <TodayView state={state} dispatch={dispatch} />
        ) : null}
        {view === "history" ? <HistoryView state={state} /> : null}
        {view === "settings" ? (
          <SettingsView
            state={state}
            dispatch={dispatch}
            onClearData={clearAllData}
            pwa={pwa}
            cloud={cloud}
          />
        ) : null}
      </main>

      <nav className="bottom-nav" aria-label="主要導覽">
        {navigation.map((item) => (
          <button
            aria-current={view === item.id ? "page" : undefined}
            className={view === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setView(item.id)}
            type="button"
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
