import { describe, expect, it } from "vitest";
import {
  appReducer,
  defaultReminderSettings,
  getDailyGoal,
  initialState,
} from "../src/appState";
import type { AppState } from "../src/types";

describe("hydration state", () => {
  it("依公式或自訂模式計算每日目標", () => {
    expect(
      getDailyGoal({
        heightCm: 170,
        weightKg: 65,
        goalMode: "formula",
        customGoalMl: null,
      }),
    ).toBe(2350);
    expect(
      getDailyGoal({
        heightCm: 170,
        weightKg: 65,
        goalMode: "custom",
        customGoalMl: 2800,
      }),
    ).toBe(2800);
  });

  it("可切換 App 語言", () => {
    expect(
      appReducer(initialState, { type: "setLanguage", language: "en" })
        .language,
    ).toBe("en");
    expect(
      appReducer(initialState, { type: "setLanguage", language: "th" })
        .language,
    ).toBe("th");
  });

  it("reducer 不允許刪除最後一個容器", () => {
    const state: AppState = {
      ...initialState,
      containers: [{ id: "only", name: "水壺", volumeMl: 600 }],
    };

    expect(appReducer(state, { type: "deleteContainer", id: "only" })).toBe(state);
  });

  it("可從 IndexedDB hydrate 或重置狀態", () => {
    const saved: AppState = {
      isOnboarded: true,
      profile: {
        heightCm: 170,
        weightKg: 65,
        goalMode: "formula",
        customGoalMl: null,
      },
      containers: [{ id: "bottle", name: "水壺", volumeMl: 600 }],
      records: [],
      language: "th",
      reminderSettings: defaultReminderSettings,
    };

    expect(appReducer(initialState, { type: "hydrate", state: saved })).toBe(saved);
    expect(appReducer(saved, { type: "reset" })).toBe(initialState);
  });

  it("更新提醒設定並在關閉時保留時段與間隔", () => {
    const configured = appReducer(initialState, {
      type: "updateReminderSettings",
      settings: {
        enabled: true,
        startTime: "08:00",
        endTime: "22:00",
        intervalMinutes: 90,
      },
    });
    const disabled = appReducer(configured, {
      type: "updateReminderSettings",
      settings: { ...configured.reminderSettings, enabled: false },
    });

    expect(disabled.reminderSettings).toEqual({
      enabled: false,
      startTime: "08:00",
      endTime: "22:00",
      intervalMinutes: 90,
    });
    expect(appReducer(disabled, { type: "reset" }).reminderSettings).toEqual(
      defaultReminderSettings,
    );
  });
});
