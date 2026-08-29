import type { ReminderSettings } from "./types";

export type MembershipRole = "owner" | "member";

export type GeneratedInvite = {
  code: string;
  expiresAt: string;
};

export type CloudReminderState = {
  configured: boolean;
  loading: boolean;
  busy: boolean;
  membershipRole: MembershipRole | null;
  notificationPermission: NotificationPermission | "unsupported";
  subscriptionActive: boolean;
  cloudCleanupPending: boolean;
  generatedInvite: GeneratedInvite | null;
  error: string | null;
};

export type CloudReminderActions = {
  redeemInvite: (code: string, captchaToken: string) => Promise<void>;
  createInvite: () => Promise<GeneratedInvite>;
  clearGeneratedInvite: () => void;
  enableReminders: (settings: ReminderSettings) => Promise<void>;
  disableReminders: (settings: ReminderSettings) => Promise<void>;
  saveReminderSettings: (settings: ReminderSettings) => Promise<void>;
  prepareCloudIdentityRemoval: () => boolean;
  cancelCloudIdentityRemoval: () => void;
  removeCloudIdentity: () => Promise<void>;
  clearError: () => void;
};

export type CloudReminders = CloudReminderState & CloudReminderActions;
