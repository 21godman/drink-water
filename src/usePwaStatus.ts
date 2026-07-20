import { useCallback, useEffect, useMemo, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

const INSTALL_PROMPT_DISMISSED_KEY =
  "drink-water:pwa-install-prompt-dismissed";

export type InstallMode = "native" | "ios-safari" | "ios-other" | "none";
export type InstallResult = "accepted" | "dismissed" | "unavailable";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export type PwaStatus = {
  canInstall: boolean;
  installMode: InstallMode;
  isInstalled: boolean;
  isOnline: boolean;
  showInstallPrompt: boolean;
  install: () => Promise<InstallResult>;
  dismissInstallPrompt: () => void;
  offlineReady: boolean;
  dismissOfflineReady: () => void;
  needRefresh: boolean;
  applyUpdate: () => Promise<void>;
  dismissUpdate: () => void;
};

function readInstallPromptDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

function rememberInstallPromptDismissed() {
  try {
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "true");
  } catch {
    // Installation remains available from settings when storage is unavailable.
  }
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as NavigatorWithStandalone).standalone === true
  );
}

export function detectIosInstallMode(): Exclude<InstallMode, "native"> {
  if (typeof navigator === "undefined") return "none";

  const userAgent = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIos) return "none";

  const isSafari =
    /Safari/i.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(userAgent);
  return isSafari ? "ios-safari" : "ios-other";
}

export function usePwaStatus(): PwaStatus {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandaloneDisplay);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [installPromptDismissed, setInstallPromptDismissed] = useState(
    readInstallPromptDismissed,
  );
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    const displayMode = window.matchMedia?.("(display-mode: standalone)");
    const syncInstalledState = () => setIsInstalled(isStandaloneDisplay());
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      rememberInstallPromptDismissed();
      setInstallPromptDismissed(true);
      setInstallEvent(null);
      setIsInstalled(true);
    };
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    displayMode?.addEventListener?.("change", syncInstalledState);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      displayMode?.removeEventListener?.("change", syncInstalledState);
    };
  }, []);

  useEffect(() => {
    if (!offlineReady) return;
    const timer = window.setTimeout(() => setOfflineReady(false), 5_000);
    return () => window.clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  const fallbackInstallMode = useMemo(detectIosInstallMode, []);
  const installMode: InstallMode = installEvent
    ? "native"
    : fallbackInstallMode;
  const canInstall = !isInstalled && installMode !== "none";

  const dismissInstallPrompt = useCallback(() => {
    rememberInstallPromptDismissed();
    setInstallPromptDismissed(true);
  }, []);

  const install = useCallback(async (): Promise<InstallResult> => {
    if (!installEvent || isInstalled) return "unavailable";

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    rememberInstallPromptDismissed();
    setInstallPromptDismissed(true);
    if (choice.outcome === "accepted") setIsInstalled(true);
    return choice.outcome;
  }, [installEvent, isInstalled]);

  return {
    canInstall,
    installMode,
    isInstalled,
    isOnline,
    showInstallPrompt:
      canInstall &&
      installMode === "native" &&
      !installPromptDismissed,
    install,
    dismissInstallPrompt,
    offlineReady,
    dismissOfflineReady: () => setOfflineReady(false),
    needRefresh,
    applyUpdate: () => updateServiceWorker(true),
    dismissUpdate: () => setNeedRefresh(false),
  };
}
