import type {
  AppAction,
  AppState,
  ReminderSettings,
  UserProfile,
} from "./types";

export const defaultReminderSettings: ReminderSettings = {
  enabled: false,
  startTime: "07:00",
  endTime: "23:00",
  intervalMinutes: 60,
};

export const initialState: AppState = {
  isOnboarded: false,
  profile: null,
  containers: [],
  records: [],
  language: "zh-TW",
  reminderSettings: defaultReminderSettings,
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

export function getRetentionBounds(reference = new Date()): {
  earliest: Date;
  latest: Date;
} {
  const earliest = new Date(reference);
  earliest.setHours(0, 0, 0, 0);
  earliest.setDate(earliest.getDate() - 6);

  return { earliest, latest: new Date(reference) };
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
    case "setLanguage":
      return { ...state, language: action.language };
    case "updateReminderSettings":
      return { ...state, reminderSettings: action.settings };
    case "hydrate":
      return action.state;
    case "reset":
      return initialState;
    default:
      return state;
  }
}
