import { useEffect, useState } from "react";
import HistoryView from "./HistoryView";
import { I18nProvider, useI18n } from "./i18n";
import Onboarding from "./Onboarding";
import PwaStatusBanner from "./PwaStatusBanner";
import SettingsView from "./SettingsView";
import TodayView from "./TodayView";
import type { AppView } from "./types";
import { useCloudReminders } from "./useCloudReminders";
import { usePersistentAppState } from "./usePersistentAppState";
import { usePwaStatus } from "./usePwaStatus";

function AppContent({
  pwa,
  persistentState,
  cloud,
}: {
  pwa: ReturnType<typeof usePwaStatus>;
  persistentState: ReturnType<typeof usePersistentAppState>;
  cloud: ReturnType<typeof useCloudReminders>;
}) {
  const { t } = useI18n();
  const {
    state,
    dispatch,
    status,
    storageError,
    retryLoad,
    retrySave,
    clearLocalData,
  } = persistentState;
  const [view, setView] = useState<AppView>("today");
  const navigation: Array<{ id: AppView; label: string; icon: string }> = [
    { id: "today", label: t("nav.today"), icon: "⌂" },
    { id: "history", label: t("nav.history"), icon: "▥" },
    { id: "settings", label: t("nav.settings"), icon: "⌁" },
  ];

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
        <p>{t("startup.loading")}</p>
      </main>
    );
  }

  if (status === "load-error") {
    return (
      <main className="startup-state startup-error">
        <span className="startup-icon" aria-hidden="true">!</span>
        <h1>{t("startup.errorTitle")}</h1>
        <p>{storageError}</p>
        <button className="primary-button" type="button" onClick={retryLoad}>{t("startup.retry")}</button>
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

      <nav className="bottom-nav" aria-label={t("nav.aria")}>
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

function App() {
  const pwa = usePwaStatus();
  const persistentState = usePersistentAppState();
  const cloud = useCloudReminders({
    isInstalled: pwa.isInstalled,
    isOnline: pwa.isOnline,
    language: persistentState.state.language,
  });

  return (
    <I18nProvider language={persistentState.state.language}>
      <AppContent
        pwa={pwa}
        persistentState={persistentState}
        cloud={cloud}
      />
    </I18nProvider>
  );
}

export default App;
