import { useI18n } from "./i18n";

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
  const { t } = useI18n();
  if (storageError) {
    return (
      <aside className="system-banner system-banner-error" role="alert">
        <span>{t("pwa.unsaved", { error: storageError })}</span>
        <button type="button" onClick={retrySave}>{t("pwa.retry")}</button>
      </aside>
    );
  }

  if (needRefresh) {
    return (
      <aside className="system-banner system-banner-update" role="status" aria-live="polite">
        <span>{t("pwa.updateReady")}</span>
        <span className="system-banner-actions">
          <button type="button" onClick={dismissUpdate}>{t("pwa.later")}</button>
          <button type="button" onClick={() => void applyUpdate()}>{t("pwa.updateNow")}</button>
        </span>
      </aside>
    );
  }

  if (!isOnline) {
    return (
      <aside className="system-banner system-banner-offline" role="status" aria-live="polite">
        <span>{t("pwa.offline")}</span>
      </aside>
    );
  }

  if (showInstallPrompt) {
    return (
      <aside className="system-banner system-banner-install" role="status" aria-live="polite">
        <span>{t("pwa.installPrompt")}</span>
        <span className="system-banner-actions">
          <button type="button" onClick={dismissInstallPrompt}>{t("pwa.later")}</button>
          <button type="button" onClick={() => void install()}>{t("pwa.install")}</button>
        </span>
      </aside>
    );
  }

  if (offlineReady) {
    return (
      <aside className="system-banner system-banner-ready" role="status" aria-live="polite">
        <span>{t("pwa.offlineReady")}</span>
        <button type="button" onClick={dismissOfflineReady}>{t("pwa.gotIt")}</button>
      </aside>
    );
  }

  return null;
}
