import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearAppState,
  isAppState,
  loadAppState,
  openDatabase,
  pruneExpiredRecords,
  saveAppState,
} from "../src/indexedDb";
import type { AppState, DrinkRecord } from "../src/types";

const savedState: AppState = {
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

function record(id: string, consumedAt: string): DrinkRecord {
  return {
    id,
    amountMl: 600,
    consumedAt,
    containerId: "bottle",
    containerName: "水壺",
    isDemo: false,
    goalMlAtTime: 2350,
  };
}

afterEach(clearAppState);

describe("IndexedDB persistence", () => {
  it("保存、讀取與清除完整 AppState", async () => {
    await saveAppState(savedState);
    expect(await loadAppState()).toEqual(savedState);

    await clearAppState();
    expect(await loadAppState()).toBeNull();
  });

  it("拒絕載入格式不正確的資料", async () => {
    const database = await openDatabase();
    const transaction = database.transaction("app-state", "readwrite");
    transaction.objectStore("app-state").put({
      key: "current",
      value: { isOnboarded: "yes" },
    });
    await new Promise<void>((resolve) => {
      transaction.oncomplete = () => resolve();
    });
    database.close();

    await expect(loadAppState()).rejects.toThrow("本機資料格式不正確");
  });

  it("驗證 AppState 必須包含有效 profile 與容器", () => {
    expect(isAppState(savedState)).toBe(true);
    expect(isAppState({ ...savedState, containers: [] })).toBe(false);
  });
});

describe("seven-day retention", () => {
  it("保留今天與前六個本地日曆日，移除更舊和未來的紀錄", () => {
    const now = new Date(2026, 6, 20, 12, 0, 0);
    const records = [
      record("today", new Date(2026, 6, 20, 11, 59).toISOString()),
      record("boundary", new Date(2026, 6, 14, 0, 0).toISOString()),
      record("expired", new Date(2026, 6, 13, 23, 59).toISOString()),
      record("future", new Date(2026, 6, 20, 12, 1).toISOString()),
    ];

    expect(pruneExpiredRecords(records, now).map(({ id }) => id)).toEqual([
      "today",
      "boundary",
    ]);
  });

  it("正確處理跨月份與跨年份邊界", () => {
    const now = new Date(2027, 0, 3, 9, 0, 0);
    const records = [
      record("kept", new Date(2026, 11, 28, 0, 0).toISOString()),
      record("expired", new Date(2026, 11, 27, 23, 59).toISOString()),
    ];

    expect(pruneExpiredRecords(records, now).map(({ id }) => id)).toEqual([
      "kept",
    ]);
  });

  it("儲存前自動移除過期紀錄", async () => {
    const now = new Date();
    const expired = new Date(now);
    expired.setDate(expired.getDate() - 8);

    await saveAppState({
      ...savedState,
      records: [
        record("current", new Date(now.getTime() - 1000).toISOString()),
        record("expired", expired.toISOString()),
      ],
    });

    expect((await loadAppState())?.records.map(({ id }) => id)).toEqual([
      "current",
    ]);
  });
});
