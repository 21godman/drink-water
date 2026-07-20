export type GoalMode = "formula" | "custom";

export type UserProfile = {
  heightCm: number;
  weightKg: number;
  goalMode: GoalMode;
  customGoalMl: number | null;
};

export type Container = {
  id: string;
  name: string;
  volumeMl: number;
};

export type DrinkRecord = {
  id: string;
  amountMl: number;
  consumedAt: string;
  containerId: string | null;
  containerName: string;
  isDemo: boolean;
  goalMlAtTime: number;
};

export type ReminderIntervalMinutes = 30 | 60 | 90;

export type ReminderSettings = {
  enabled: boolean;
  startTime: string;
  endTime: string;
  intervalMinutes: ReminderIntervalMinutes;
};

export type AppState = {
  isOnboarded: boolean;
  profile: UserProfile | null;
  containers: Container[];
  records: DrinkRecord[];
  demoEnabled: boolean;
  reminderSettings: ReminderSettings;
};

export type AppAction =
  | {
      type: "completeSetup";
      profile: UserProfile;
      container: Container;
    }
  | { type: "addRecord"; record: DrinkRecord }
  | { type: "updateRecord"; record: DrinkRecord }
  | { type: "deleteRecord"; id: string }
  | { type: "updateProfile"; profile: UserProfile }
  | { type: "addContainer"; container: Container }
  | { type: "updateContainer"; container: Container }
  | { type: "deleteContainer"; id: string }
  | { type: "setDemoData"; enabled: boolean; records: DrinkRecord[] }
  | { type: "updateReminderSettings"; settings: ReminderSettings }
  | { type: "hydrate"; state: AppState }
  | { type: "reset" };

export type AppView = "today" | "history" | "settings";
