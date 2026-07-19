import type {
  AppAction,
  AppState,
  DrinkRecord,
  UserProfile,
} from "./types";

export const initialState: AppState = {
  isOnboarded: false,
  profile: null,
  containers: [],
  records: [],
  demoEnabled: false,
};

export function getDailyGoal(profile: UserProfile): number {
  if (profile.goalMode === "custom" && profile.customGoalMl) {
    return Math.round(profile.customGoalMl);
  }

  return Math.round((profile.heightCm + profile.weightKg) * 10);
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isSameLocalDay(isoDate: string, reference: Date): boolean {
  return localDateKey(new Date(isoDate)) === localDateKey(reference);
}

export function toDateTimeLocal(isoDate: string): string {
  const date = new Date(isoDate);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createDemoRecords(
  dailyGoal: number,
  reference = new Date(),
): DrinkRecord[] {
  const completionPattern = [
    0.72, 0.9, 1.08, 0.84, 1.02, 0.65, 0.96, 1.12, 0.78, 0.93,
  ];

  return Array.from({ length: 29 }, (_, index) => {
    const daysAgo = 29 - index;
    const date = new Date(reference);
    date.setDate(reference.getDate() - daysAgo);
    date.setHours(20, 15, 0, 0);

    return {
      id: `demo-${localDateKey(date)}`,
      amountMl: Math.round(
        (dailyGoal * completionPattern[index % completionPattern.length]) / 10,
      ) * 10,
      consumedAt: date.toISOString(),
      containerId: null,
      containerName: "示範紀錄",
      isDemo: true,
    };
  });
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "completeSetup":
      return {
        ...state,
        isOnboarded: true,
        profile: action.profile,
        containers: [action.container],
      };
    case "addRecord":
      return { ...state, records: [...state.records, action.record] };
    case "updateRecord":
      return {
        ...state,
        records: state.records.map((record) =>
          record.id === action.record.id ? action.record : record,
        ),
      };
    case "deleteRecord":
      return {
        ...state,
        records: state.records.filter((record) => record.id !== action.id),
      };
    case "updateProfile":
      return { ...state, profile: action.profile };
    case "addContainer":
      return { ...state, containers: [...state.containers, action.container] };
    case "updateContainer":
      return {
        ...state,
        containers: state.containers.map((container) =>
          container.id === action.container.id ? action.container : container,
        ),
      };
    case "deleteContainer":
      if (state.containers.length === 1) return state;
      return {
        ...state,
        containers: state.containers.filter(
          (container) => container.id !== action.id,
        ),
      };
    case "setDemoData":
      return {
        ...state,
        demoEnabled: action.enabled,
        records: action.enabled
          ? [
              ...state.records.filter((record) => !record.isDemo),
              ...action.records,
            ]
          : state.records.filter((record) => !record.isDemo),
      };
    default:
      return state;
  }
}
