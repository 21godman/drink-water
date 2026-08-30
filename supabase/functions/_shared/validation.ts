export type ReminderSettingsInput = {
  enabled: boolean;
  startTime: string;
  endTime: string;
  intervalMinutes: 30 | 60 | 90;
  timeZone: string;
};

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):(?:00|30)$/;

export function isPushEndpoint(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("https://") &&
    value.length <= 2048
  );
}

export function isReminderSettingsInput(
  value: unknown,
): value is ReminderSettingsInput {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.enabled === "boolean" &&
    typeof candidate.startTime === "string" &&
    typeof candidate.endTime === "string" &&
    TIME_PATTERN.test(candidate.startTime) &&
    TIME_PATTERN.test(candidate.endTime) &&
    candidate.startTime < candidate.endTime &&
    (candidate.intervalMinutes === 30 ||
      candidate.intervalMinutes === 60 ||
      candidate.intervalMinutes === 90) &&
    typeof candidate.timeZone === "string" &&
    candidate.timeZone.length > 0 &&
    candidate.timeZone.length <= 100
  );
}

export function isPushSubscriptionInput(value: unknown): value is {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (!candidate.keys || typeof candidate.keys !== "object") return false;
  const keys = candidate.keys as Record<string, unknown>;
  return (
    isPushEndpoint(candidate.endpoint) &&
    (candidate.expirationTime === undefined ||
      candidate.expirationTime === null ||
      (typeof candidate.expirationTime === "number" &&
        Number.isSafeInteger(candidate.expirationTime) &&
        candidate.expirationTime >= 0)) &&
    typeof keys.p256dh === "string" &&
    keys.p256dh.length > 0 &&
    keys.p256dh.length <= 512 &&
    typeof keys.auth === "string" &&
    keys.auth.length > 0 &&
    keys.auth.length <= 256
  );
}

export function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown_error";
}
