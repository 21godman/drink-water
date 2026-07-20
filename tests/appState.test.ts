import { describe, expect, it } from "vitest";
import {
  appReducer,
  createDemoRecords,
  getDailyGoal,
  initialState,
} from "../src/appState";
import type { AppState, DrinkRecord } from "../src/types";

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

  it("關閉示範資料只移除六天示範紀錄", () => {
    const userRecord: DrinkRecord = {
      id: "user-record",
      amountMl: 600,
      consumedAt: "2026-07-20T02:00:00.000Z",
      containerId: "bottle",
      containerName: "水壺",
      isDemo: false,
      goalMlAtTime: 2350,
    };
    const state: AppState = {
      ...initialState,
      records: [userRecord],
    };
    const demoRecords = createDemoRecords(2350, new Date("2026-07-20T12:00:00"));
    const enabled = appReducer(state, {
      type: "setDemoData",
      enabled: true,
      records: demoRecords,
    });
    const disabled = appReducer(enabled, {
      type: "setDemoData",
      enabled: false,
      records: [],
    });

    expect(enabled.records).toHaveLength(7);
    expect(disabled.records).toEqual([userRecord]);
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
      demoEnabled: false,
    };

    expect(appReducer(initialState, { type: "hydrate", state: saved })).toBe(saved);
    expect(appReducer(saved, { type: "reset" })).toBe(initialState);
  });
});
