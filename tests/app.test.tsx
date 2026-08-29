import "fake-indexeddb/auto";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { clearAppState, loadAppState, openDatabase } from "../src/indexedDb";

vi.mock("../src/supabaseClient", () => ({
  cloudConfiguration: {
    supabaseUrl: "",
    supabasePublishableKey: "",
    vapidPublicKey: "",
    turnstileSiteKey: "",
  },
  getSupabaseClient: () => null,
  isCloudConfigured: false,
}));

afterEach(async () => {
  cleanup();
  localStorage.clear();
  await new Promise((resolve) => setTimeout(resolve, 25));
  await clearAppState();
});

async function waitForOnboarding() {
  await screen.findByRole("heading", { name: /找到適合你的/ });
}

async function completeSetup() {
  await waitForOnboarding();
  fireEvent.change(screen.getByRole("spinbutton", { name: /身高/ }), {
    target: { value: "170" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: /體重/ }), {
    target: { value: "65" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /容器名稱/ }), {
    target: { value: "藍色水壺" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: /容量/ }), {
    target: { value: "600" },
  });
  fireEvent.click(screen.getByRole("button", { name: /開始記錄喝水/ }));
  await screen.findByRole("heading", { name: "今天也好好喝水" });
}

describe("App onboarding and hydration", () => {
  it("載入完成前顯示啟動畫面，無資料時進入首次設定", async () => {
    render(<App />);

    expect(screen.getByText("正在讀取本機紀錄…")).toBeTruthy();
    await waitForOnboarding();
  });

  it("依身高體重顯示公式目標，並要求至少一個容器", async () => {
    render(<App />);
    await waitForOnboarding();

    fireEvent.change(screen.getByRole("spinbutton", { name: /身高/ }), {
      target: { value: "170" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: /體重/ }), {
      target: { value: "65" },
    });

    expect(screen.getByText(/2,350/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /開始記錄喝水/ }));
    expect(screen.getByRole("alert").textContent).toContain("至少一個容器");
  });

  it("可改用自訂每日目標", async () => {
    render(<App />);
    await waitForOnboarding();

    fireEvent.click(screen.getByRole("radio", { name: "自訂目標" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /身高/ }), {
      target: { value: "170" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: /體重/ }), {
      target: { value: "65" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: /自訂每日目標/ }), {
      target: { value: "2800" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /容器名稱/ }), {
      target: { value: "玻璃杯" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: /容量/ }), {
      target: { value: "350" },
    });
    fireEvent.click(screen.getByRole("button", { name: /開始記錄喝水/ }));

    expect(await screen.findByLabelText(/每日目標 2800 mL/)).toBeTruthy();
  });

  it("重新掛載後恢復設定與喝水紀錄", async () => {
    const firstRender = render(<App />);
    await completeSetup();
    fireEvent.click(
      screen.getByRole("button", { name: /藍色水壺 600 mL，記錄喝水/ }),
    );

    await waitFor(async () => {
      expect((await loadAppState())?.records).toHaveLength(1);
    });
    firstRender.unmount();

    render(<App />);
    expect(await screen.findByLabelText(/今日已喝 600 mL/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /找到適合你的/ })).toBeNull();
  });

  it("資料格式損壞時顯示錯誤，清除後可重新讀取", async () => {
    const database = await openDatabase();
    const transaction = database.transaction("app-state", "readwrite");
    transaction.objectStore("app-state").put({
      key: "current",
      value: { isOnboarded: "invalid" },
    });
    await new Promise<void>((resolve) => {
      transaction.oncomplete = () => resolve();
    });
    database.close();

    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "暫時讀不到本機資料" }),
    ).toBeTruthy();
    expect(screen.getByText("本機資料格式不正確")).toBeTruthy();

    await clearAppState();
    fireEvent.click(screen.getByRole("button", { name: "重新讀取" }));
    await waitForOnboarding();
  });
});

describe("App drinking flow", () => {
  it("完成設定後顯示一次安裝提示，關閉後設定頁仍可安裝", async () => {
    render(<App />);
    await waitForOnboarding();
    const installEvent = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(installEvent, {
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    });
    fireEvent(window, installEvent);

    await completeSetup();
    expect(screen.getByText(/安裝到手機，之後可從桌面直接開啟/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "稍後" }));
    expect(screen.queryByText(/安裝到手機，之後可從桌面直接開啟/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /設定/ }));
    expect(screen.getByRole("heading", { name: "安裝到手機" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "安裝到裝置" })).toBeTruthy();
  });

  it("快速記水後可修改並刪除紀錄", async () => {
    render(<App />);
    await completeSetup();

    fireEvent.click(
      screen.getByRole("button", { name: /藍色水壺 600 mL，記錄喝水/ }),
    );
    expect(screen.getByLabelText(/今日已喝 600 mL/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /編輯 藍色水壺 600 mL/ }));
    const dialog = screen.getByRole("dialog", { name: "藍色水壺" });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: /飲水量/ }), {
      target: { value: "450" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "儲存變更" }));
    expect(screen.getByLabelText(/今日已喝 450 mL/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /編輯 藍色水壺 450 mL/ }));
    fireEvent.click(screen.getByRole("button", { name: "刪除紀錄" }));
    expect(screen.getByText("第一杯水，從現在開始")).toBeTruthy();
  });

  it("拒絕保存七日範圍外或未來的時間", async () => {
    render(<App />);
    await completeSetup();
    fireEvent.click(
      screen.getByRole("button", { name: /藍色水壺 600 mL，記錄喝水/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /編輯 藍色水壺 600 mL/ }));

    const dialog = screen.getByRole("dialog", { name: "藍色水壺" });
    const timeInput = within(dialog).getByLabelText(/飲用時間/);
    fireEvent.change(timeInput, { target: { value: "2000-01-01T08:00" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "儲存變更" }));

    expect(within(dialog).getByRole("alert").textContent).toContain("前 6 天");
  });

  it("快速連續新增不會讓較舊的寫入覆蓋新狀態", async () => {
    const firstRender = render(<App />);
    await completeSetup();
    const addButton = screen.getByRole("button", {
      name: /藍色水壺 600 mL，記錄喝水/,
    });
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    await waitFor(async () => {
      expect((await loadAppState())?.records).toHaveLength(3);
    });
    firstRender.unmount();
    render(<App />);
    expect(await screen.findByLabelText(/今日已喝 1800 mL/)).toBeTruthy();
  });

  it("寫入失敗時保留畫面資料並可重試", async () => {
    render(<App />);
    await completeSetup();
    await waitFor(async () => {
      expect((await loadAppState())?.isOnboarded).toBe(true);
    });

    const workingIndexedDb = globalThis.indexedDB;
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: {
        open() {
          throw new Error("測試寫入失敗");
        },
      },
    });

    try {
      fireEvent.click(
        screen.getByRole("button", { name: /藍色水壺 600 mL，記錄喝水/ }),
      );
      expect((await screen.findByRole("alert")).textContent).toContain("測試寫入失敗");
      expect(screen.getByLabelText(/今日已喝 600 mL/)).toBeTruthy();
    } finally {
      Object.defineProperty(globalThis, "indexedDB", {
        configurable: true,
        value: workingIndexedDb,
      });
    }

    fireEvent.click(screen.getByRole("button", { name: "重試" }));
    await waitFor(async () => {
      expect((await loadAppState())?.records).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.queryByText(/本次變更尚未保存/)).toBeNull();
    });
  });

  it("修改目前目標不會回頭改變舊紀錄的達標標準", async () => {
    render(<App />);
    await completeSetup();
    fireEvent.click(
      screen.getByRole("button", { name: /藍色水壺 600 mL，記錄喝水/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /設定/ }));
    fireEvent.click(screen.getByRole("radio", { name: "自訂目標" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /自訂每日目標/ }), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "儲存個人設定" }));
    fireEvent.click(screen.getByRole("button", { name: /歷史/ }));

    expect(screen.getByText("繼續保持")).toBeTruthy();
    expect(screen.queryByText("已達標")).toBeNull();
  });

  it("可切換今日、歷史、設定三個主分頁", async () => {
    render(<App />);
    await completeSetup();

    const navigation = screen.getByRole("navigation", { name: "主要導覽" });
    fireEvent.click(within(navigation).getByRole("button", { name: /歷史/ }));
    expect(screen.getByRole("heading", { name: "喝水趨勢" })).toBeTruthy();
    expect(screen.getByLabelText("7 天喝水摘要")).toBeTruthy();

    fireEvent.click(within(navigation).getByRole("button", { name: /設定/ }));
    expect(screen.getByRole("heading", { name: "你的設定" })).toBeTruthy();

    fireEvent.click(within(navigation).getByRole("button", { name: /今日/ }));
    expect(screen.getByRole("heading", { name: "今天也好好喝水" })).toBeTruthy();
  });

  it("可設定、關閉並重新載入本機提醒偏好", async () => {
    const firstRender = render(<App />);
    await completeSetup();
    fireEvent.click(screen.getByRole("button", { name: /設定/ }));

    const toggle = screen.getByRole("checkbox", { name: "切換喝水提醒" });
    expect(toggle.hasAttribute("checked")).toBe(false);
    expect(screen.getByText(/目前保存：每天 07:00–23:00，每 60 分鐘/)).toBeTruthy();

    fireEvent.click(toggle);
    expect((toggle as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("radio", { name: "30 分鐘" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "60 分鐘" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "90 分鐘" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("每日開始時間"), {
      target: { value: "08:00" },
    });
    fireEvent.change(screen.getByLabelText("每日結束時間"), {
      target: { value: "22:00" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "90 分鐘" }));
    fireEvent.click(screen.getByRole("button", { name: "儲存提醒設定" }));
    expect(screen.getByText("提醒設定已儲存")).toBeTruthy();

    await waitFor(async () => {
      expect((await loadAppState())?.reminderSettings).toEqual({
        enabled: true,
        startTime: "08:00",
        endTime: "22:00",
        intervalMinutes: 90,
      });
    });

    fireEvent.click(toggle);
    expect(screen.getByText(/目前保存：每天 08:00–22:00，每 90 分鐘/)).toBeTruthy();
    await waitFor(async () => {
      expect((await loadAppState())?.reminderSettings.enabled).toBe(false);
    });
    firstRender.unmount();

    render(<App />);
    await screen.findByRole("heading", { name: "今天也好好喝水" });
    fireEvent.click(screen.getByRole("button", { name: /設定/ }));
    expect((screen.getByRole("checkbox", { name: "切換喝水提醒" }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(/目前保存：每天 08:00–22:00，每 90 分鐘/)).toBeTruthy();
  });

  it("拒絕相同、反向與空白的提醒時間", async () => {
    render(<App />);
    await completeSetup();
    fireEvent.click(screen.getByRole("button", { name: /設定/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "切換喝水提醒" }));

    const start = screen.getByLabelText("每日開始時間");
    const end = screen.getByLabelText("每日結束時間");
    const save = screen.getByRole("button", { name: "儲存提醒設定" });

    fireEvent.change(start, { target: { value: "23:00" } });
    fireEvent.change(end, { target: { value: "23:00" } });
    fireEvent.click(save);
    expect(screen.getByRole("alert").textContent).toContain("結束時間必須晚於開始時間");

    fireEvent.change(end, { target: { value: "07:00" } });
    fireEvent.click(save);
    expect(screen.getByRole("alert").textContent).toContain("不能跨越午夜");

    fireEvent.change(start, { target: { value: "" } });
    fireEvent.click(save);
    expect(screen.getByRole("alert").textContent).toContain("結束時間必須晚於開始時間");
  });

  it("最後一個容器不可刪除，新增第二個後即可刪除", async () => {
    render(<App />);
    await completeSetup();
    fireEvent.click(screen.getByRole("button", { name: /設定/ }));

    fireEvent.click(screen.getByRole("button", { name: "編輯 藍色水壺" }));
    expect(screen.getByRole("button", { name: "刪除容器" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "關閉容器設定" }));

    fireEvent.click(screen.getByRole("button", { name: /新增/ }));
    const dialog = screen.getByRole("dialog", { name: "新增容器" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /容器名稱/ }), {
      target: { value: "馬克杯" },
    });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: /容量/ }), {
      target: { value: "320" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "加入容器" }));

    fireEvent.click(screen.getByRole("button", { name: "編輯 藍色水壺" }));
    expect(screen.getByRole("button", { name: "刪除容器" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "刪除容器" }));
    expect(screen.queryByText("藍色水壺")).toBeNull();
    expect(screen.getByText("馬克杯")).toBeTruthy();
  });

  it("確認後清除 IndexedDB 並回到首次設定", async () => {
    render(<App />);
    await completeSetup();
    fireEvent.click(screen.getByRole("button", { name: /設定/ }));
    fireEvent.click(screen.getByRole("button", { name: "清除全部本機資料" }));
    const dialog = screen.getByRole("alertdialog", { name: "清除全部本機資料？" });
    fireEvent.click(within(dialog).getByRole("button", { name: "確認清除" }));

    await waitForOnboarding();
    expect((await loadAppState())?.isOnboarded ?? false).toBe(false);
  });
});
