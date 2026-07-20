import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PwaStatusBanner from "../src/PwaStatusBanner";
import { PwaInstallCard } from "../src/SettingsView";
import {
  detectIosInstallMode,
  isStandaloneDisplay,
  usePwaStatus,
} from "../src/usePwaStatus";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function installPromptEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  });
  return event as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  };
}

function PwaHarness() {
  const pwa = usePwaStatus();
  return (
    <div>
      <span data-testid="install-mode">{pwa.installMode}</span>
      <span data-testid="can-install">{String(pwa.canInstall)}</span>
      <span data-testid="show-install">{String(pwa.showInstallPrompt)}</span>
      <span data-testid="installed">{String(pwa.isInstalled)}</span>
      <span data-testid="online">{String(pwa.isOnline)}</span>
      <button type="button" onClick={pwa.dismissInstallPrompt}>關閉安裝提示</button>
      <button type="button" onClick={() => void pwa.install()}>執行安裝</button>
    </div>
  );
}

describe("PWA installation state", () => {
  it("保存原生安裝事件，關閉主動提示後仍保留設定入口能力", () => {
    render(<PwaHarness />);
    const event = installPromptEvent();

    fireEvent(window, event);
    expect(screen.getByTestId("install-mode").textContent).toBe("native");
    expect(screen.getByTestId("can-install").textContent).toBe("true");
    expect(screen.getByTestId("show-install").textContent).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "關閉安裝提示" }));
    expect(screen.getByTestId("show-install").textContent).toBe("false");
    expect(screen.getByTestId("can-install").textContent).toBe("true");
    expect(localStorage.getItem("drink-water:pwa-install-prompt-dismissed")).toBe("true");
  });

  it("接受安裝後呼叫瀏覽器提示並切換為已安裝", async () => {
    render(<PwaHarness />);
    const event = installPromptEvent("accepted");
    fireEvent(window, event);

    fireEvent.click(screen.getByRole("button", { name: "執行安裝" }));
    await act(() => event.userChoice);

    expect(event.prompt).toHaveBeenCalledOnce();
    expect(screen.getByTestId("installed").textContent).toBe("true");
    expect(screen.getByTestId("can-install").textContent).toBe("false");
  });

  it("追蹤離線與恢復連線事件", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<PwaHarness />);

    fireEvent(window, new Event("offline"));
    expect(screen.getByTestId("online").textContent).toBe("false");
    fireEvent(window, new Event("online"));
    expect(screen.getByTestId("online").textContent).toBe("true");
  });

  it("辨識 iOS Safari、其他 iOS 瀏覽器與 standalone 模式", () => {
    const userAgent = vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    );
    expect(detectIosInstallMode()).toBe("ios-safari");

    userAgent.mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0 Mobile/15E148 Safari/604.1",
    );
    expect(detectIosInstallMode()).toBe("ios-other");

    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    expect(isStandaloneDisplay()).toBe(true);
  });
});

describe("PWA global message priority", () => {
  const defaultProps = {
    storageError: null,
    retrySave: vi.fn(),
    needRefresh: false,
    applyUpdate: vi.fn().mockResolvedValue(undefined),
    dismissUpdate: vi.fn(),
    isOnline: true,
    showInstallPrompt: false,
    install: vi.fn().mockResolvedValue("accepted"),
    dismissInstallPrompt: vi.fn(),
    offlineReady: false,
    dismissOfflineReady: vi.fn(),
  };

  it("依保存錯誤、更新、離線、安裝的順序顯示單一訊息", () => {
    const { rerender } = render(
      <PwaStatusBanner
        {...defaultProps}
        storageError="寫入失敗"
        needRefresh
        isOnline={false}
        showInstallPrompt
      />,
    );
    expect(screen.getByText(/本次變更尚未保存/)).toBeTruthy();
    expect(screen.queryByText(/新版本/)).toBeNull();

    rerender(
      <PwaStatusBanner
        {...defaultProps}
        needRefresh
        isOnline={false}
        showInstallPrompt
      />,
    );
    expect(screen.getByText(/新版本已準備好/)).toBeTruthy();

    rerender(
      <PwaStatusBanner
        {...defaultProps}
        isOnline={false}
        showInstallPrompt
      />,
    );
    expect(screen.getByText(/目前離線/)).toBeTruthy();

    rerender(<PwaStatusBanner {...defaultProps} showInstallPrompt />);
    expect(screen.getByText(/安裝到手機/)).toBeTruthy();
  });

  it("連接更新與安裝提示的操作", () => {
    const dismissUpdate = vi.fn();
    const { rerender } = render(
      <PwaStatusBanner {...defaultProps} needRefresh dismissUpdate={dismissUpdate} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "稍後" }));
    expect(dismissUpdate).toHaveBeenCalledOnce();

    const install = vi.fn().mockResolvedValue("accepted");
    rerender(
      <PwaStatusBanner {...defaultProps} showInstallPrompt install={install} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "安裝" }));
    expect(install).toHaveBeenCalledOnce();
  });
});

describe("PWA settings guidance", () => {
  it("在 iOS Safari 顯示加入主畫面步驟", () => {
    render(
      <PwaInstallCard
        canInstall
        installMode="ios-safari"
        install={vi.fn().mockResolvedValue("unavailable")}
      />,
    );

    expect(screen.getByRole("heading", { name: "安裝到手機" })).toBeTruthy();
    expect(screen.getByText(/Safari 的分享按鈕/)).toBeTruthy();
    expect(screen.getByText(/加入主畫面/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /安裝到裝置/ })).toBeNull();
  });

  it("在其他 iOS 瀏覽器提示改用 Safari，不支援時不顯示入口", () => {
    const { rerender } = render(
      <PwaInstallCard
        canInstall
        installMode="ios-other"
        install={vi.fn().mockResolvedValue("unavailable")}
      />,
    );
    expect(screen.getByText(/請先用 Safari 開啟/)).toBeTruthy();

    rerender(
      <PwaInstallCard
        canInstall={false}
        installMode="none"
        install={vi.fn().mockResolvedValue("unavailable")}
      />,
    );
    expect(screen.queryByRole("heading", { name: "安裝到手機" })).toBeNull();
  });
});
