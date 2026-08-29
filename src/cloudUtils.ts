import type { ReminderSettings } from "./types";

const PENDING_CLOUD_CLEANUP_KEY = "drink-water:pending-cloud-cleanup";

export function normalizeInviteCode(value: string): string {
  const normalized = value.replace(/[^0-9a-f]/gi, "").toUpperCase().slice(0, 20);
  return normalized.match(/.{1,4}/g)?.join("-") ?? "";
}

export function isCompleteInviteCode(value: string): boolean {
  return /^[0-9A-F]{4}(?:-[0-9A-F]{4}){4}$/.test(
    normalizeInviteCode(value),
  );
}

export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function reminderSettingsPayload(settings: ReminderSettings) {
  return {
    ...settings,
    timeZone: getDeviceTimeZone(),
  };
}

export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const decoded = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(decoded.length));
  for (let index = 0; index < decoded.length; index += 1) {
    output[index] = decoded.charCodeAt(index);
  }
  return output;
}

export function pushSubscriptionUsesVapidKey(
  subscription: PushSubscription,
  vapidPublicKey: string,
): boolean {
  const applicationServerKey = subscription.options.applicationServerKey;
  if (!applicationServerKey) return false;

  const actual = new Uint8Array(applicationServerKey);
  const expected = urlBase64ToUint8Array(vapidPublicKey);
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

export function supportsWebPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "PushManager" in window &&
    "serviceWorker" in navigator
  );
}

export function currentNotificationPermission():
  | NotificationPermission
  | "unsupported" {
  return supportsWebPush() ? Notification.permission : "unsupported";
}

export function hasPendingCloudCleanup(): boolean {
  return (
    typeof window !== "undefined" &&
    window.localStorage.getItem(PENDING_CLOUD_CLEANUP_KEY) !== null
  );
}

export function scheduleCloudCleanup(): boolean {
  const alreadyPending = hasPendingCloudCleanup();
  window.localStorage.setItem(
    PENDING_CLOUD_CLEANUP_KEY,
    new Date().toISOString(),
  );
  return !alreadyPending;
}

export function clearPendingCloudCleanup(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(PENDING_CLOUD_CLEANUP_KEY);
  }
}
