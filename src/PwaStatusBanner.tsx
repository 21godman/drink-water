type PwaStatusBannerProps = {
  storageError: string | null;
  retrySave: () => void;
  needRefresh: boolean;
  applyUpdate: () => Promise<void>;
  dismissUpdate: () => void;
  isOnline: boolean;
  showInstallPrompt: boolean;
  install: () => Promise<unknown>;
  dismissInstallPrompt: () => void;
  offlineReady: boolean;
  dismissOfflineReady: () => void;
};

export default function PwaStatusBanner({
  storageError,
  retrySave,
  needRefresh,
  applyUpdate,
  dismissUpdate,
  isOnline,
  showInstallPrompt,
  install,
  dismissInstallPrompt,
  offlineReady,
  dismissOfflineReady,
}: PwaStatusBannerProps) {
  if (storageError) {
    return (
      <aside className="system-banner system-banner-error" role="alert">
        <span>本次變更尚未保存：{storageError}</span>
        <button type="button" onClick={retrySave}>重試</button>
      </aside>
    );
  }

  if (needRefresh) {
    return (
      <aside className="system-banner system-banner-update" role="status" aria-live="polite">
        <span>新版本已準備好，要現在更新嗎？</span>
        <span className="system-banner-actions">
          <button type="button" onClick={dismissUpdate}>稍後</button>
          <button type="button" onClick={() => void applyUpdate()}>立即更新</button>
        </span>
      </aside>
    );
  }

  if (!isOnline) {
    return (
      <aside className="system-banner system-banner-offline" role="status" aria-live="polite">
        <span>目前離線，仍可使用本機紀錄。</span>
      </aside>
    );
  }

  if (showInstallPrompt) {
    return (
      <aside className="system-banner system-banner-install" role="status" aria-live="polite">
        <span>安裝到手機，之後可從桌面直接開啟。</span>
        <span className="system-banner-actions">
          <button type="button" onClick={dismissInstallPrompt}>稍後</button>
          <button type="button" onClick={() => void install()}>安裝</button>
        </span>
      </aside>
    );
  }

  if (offlineReady) {
    return (
      <aside className="system-banner system-banner-ready" role="status" aria-live="polite">
        <span>離線使用已準備完成。</span>
        <button type="button" onClick={dismissOfflineReady}>知道了</button>
      </aside>
    );
  }

  return null;
}
