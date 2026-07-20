import type { AppState, Container, DrinkRecord, UserProfile } from "./types";

const DATABASE_NAME = "drink-water";
const DATABASE_VERSION = 1;
const STORE_NAME = "app-state";
const STATE_KEY = "current";

type StoredState = {
  key: typeof STATE_KEY;
  value: AppState;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isUserProfile(value: unknown): value is UserProfile {
  if (!isObject(value)) return false;
  return (
    isFinitePositiveNumber(value.heightCm) &&
    isFinitePositiveNumber(value.weightKg) &&
    (value.goalMode === "formula" || value.goalMode === "custom") &&
    (value.customGoalMl === null || isFinitePositiveNumber(value.customGoalMl))
  );
}

function isContainer(value: unknown): value is Container {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    isFinitePositiveNumber(value.volumeMl)
  );
}

function isDrinkRecord(value: unknown): value is DrinkRecord {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    isFinitePositiveNumber(value.amountMl) &&
    typeof value.consumedAt === "string" &&
    Number.isFinite(new Date(value.consumedAt).getTime()) &&
    (value.containerId === null || typeof value.containerId === "string") &&
    typeof value.containerName === "string" &&
    typeof value.isDemo === "boolean" &&
    isFinitePositiveNumber(value.goalMlAtTime)
  );
}

export function isAppState(value: unknown): value is AppState {
  if (!isObject(value)) return false;
  return (
    typeof value.isOnboarded === "boolean" &&
    (value.profile === null || isUserProfile(value.profile)) &&
    Array.isArray(value.containers) &&
    value.containers.every(isContainer) &&
    Array.isArray(value.records) &&
    value.records.every(isDrinkRecord) &&
    typeof value.demoEnabled === "boolean" &&
    (!value.isOnboarded || (value.profile !== null && value.containers.length > 0))
  );
}

export function pruneExpiredRecords(
  records: DrinkRecord[],
  now = new Date(),
): DrinkRecord[] {
  const earliest = new Date(now);
  earliest.setHours(0, 0, 0, 0);
  earliest.setDate(earliest.getDate() - 6);
  const latestTime = now.getTime();

  return records.filter((record) => {
    const consumedTime = new Date(record.consumedAt).getTime();
    return consumedTime >= earliest.getTime() && consumedTime <= latestTime;
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("無法開啟本機資料庫"));
    request.onblocked = () => reject(new Error("本機資料庫正在被其他分頁使用"));
  });
}

export async function loadAppState(): Promise<AppState | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const transactionComplete = waitForTransaction(transaction);
    const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
    const result = await new Promise<StoredState | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as StoredState | undefined);
      request.onerror = () => reject(request.error ?? new Error("無法讀取本機資料"));
    });
    await transactionComplete;

    if (!result) return null;
    if (!isAppState(result.value)) {
      throw new Error("本機資料格式不正確");
    }

    return {
      ...result.value,
      records: pruneExpiredRecords(result.value.records),
    };
  } finally {
    database.close();
  }
}

export async function saveAppState(state: AppState): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const transactionComplete = waitForTransaction(transaction);
    transaction.objectStore(STORE_NAME).put({
      key: STATE_KEY,
      value: {
        ...state,
        records: pruneExpiredRecords(state.records),
      },
    } satisfies StoredState);
    await transactionComplete;
  } finally {
    database.close();
  }
}

export async function clearAppState(): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const transactionComplete = waitForTransaction(transaction);
    transaction.objectStore(STORE_NAME).delete(STATE_KEY);
    await transactionComplete;
  } finally {
    database.close();
  }
}
