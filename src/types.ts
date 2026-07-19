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
};

export type AppState = {
  isOnboarded: boolean;
  profile: UserProfile | null;
  containers: Container[];
  records: DrinkRecord[];
  demoEnabled: boolean;
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
  | { type: "setDemoData"; enabled: boolean; records: DrinkRecord[] };

export type AppView = "today" | "history" | "settings";
