import { useCallback, useEffect, useState } from "react";
import { translate, type TranslationKey } from "./i18n";
import type {
  CloudReminders,
  GeneratedInvite,
  MembershipRole,
} from "./cloudTypes";
import {
  clearPendingCloudCleanup,
  currentNotificationPermission,
  hasPendingCloudCleanup,
  pushSubscriptionUsesVapidKey,
  reminderSettingsPayload,
  scheduleCloudCleanup,
  supportsWebPush,
  urlBase64ToUint8Array,
} from "./cloudUtils";
import {
  cloudConfiguration,
  getSupabaseClient,
  isCloudConfigured,
} from "./supabaseClient";
import type { AppLanguage, ReminderSettings } from "./types";

type FunctionErrorPayload = {
  error?: { code?: string; message?: string };
};

async function functionErrorMessage(
  error: unknown,
  fallback: string,
  language: AppLanguage,
): Promise<string> {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    try {
      const payload = await context.clone().json() as FunctionErrorPayload;
      if (payload.error?.message && language === "zh-TW") {
        return payload.error.message;
      }
    } catch {
      // Use the stable reader-facing fallback below.
    }
  }
  return fallback;
}

async function browserSubscription(): Promise<PushSubscription | null> {
  if (!supportsWebPush()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export function useCloudReminders({
  isInstalled,
  isOnline,
  language,
}: {
  isInstalled: boolean;
  isOnline: boolean;
  language: AppLanguage;
}): CloudReminders {
  const t = useCallback(
    (key: TranslationKey) => translate(language, key),
    [language],
  );
  const [loading, setLoading] = useState(isCloudConfigured);
  const [busy, setBusy] = useState(false);
  const [membershipRole, setMembershipRole] =
    useState<MembershipRole | null>(null);
  const [notificationPermission, setNotificationPermission] = useState(
    currentNotificationPermission,
  );
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [nextReminderAt, setNextReminderAt] = useState<string | null>(null);
  const [cloudCleanupPending, setCloudCleanupPending] = useState(
    hasPendingCloudCleanup,
  );
  const [generatedInvite, setGeneratedInvite] =
    useState<GeneratedInvite | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    if (!isOnline) {
      setLoading(false);
      return;
    }
    if (hasPendingCloudCleanup()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setMembershipRole(null);
        setSubscriptionActive(false);
        setNextReminderAt(null);
        return;
      }

      const { data, error: membershipError } = await supabase
        .from("members")
        .select("role")
        .maybeSingle();
      if (membershipError) throw membershipError;
      const role =
        data?.role === "owner" || data?.role === "member"
          ? data.role
          : null;
      setMembershipRole(role);
      setNotificationPermission(currentNotificationPermission());
      setSubscriptionActive(false);
      setNextReminderAt(null);
      if (!role) return;

      const { data: preference, error: preferenceError } = await supabase
        .from("reminder_preferences")
        .select("enabled, next_reminder_at")
        .maybeSingle();
      if (preferenceError) throw preferenceError;
      setNextReminderAt(
        preference?.enabled && typeof preference.next_reminder_at === "string"
          ? preference.next_reminder_at
          : null,
      );

      const subscription = await browserSubscription();
      if (
        !subscription ||
        !pushSubscriptionUsesVapidKey(
          subscription,
          cloudConfiguration.vapidPublicKey,
        )
      ) {
        return;
      }

      const { data: serverSubscription, error: subscriptionError } =
        await supabase
          .from("push_subscriptions")
          .select("disabled_at")
          .eq("endpoint", subscription.endpoint)
          .maybeSingle();
      if (subscriptionError) throw subscriptionError;
      setSubscriptionActive(
        Boolean(serverSubscription && serverSubscription.disabled_at === null),
      );
    } catch {
      setSubscriptionActive(false);
      setError(t("cloud.readFailed"));
    } finally {
      setLoading(false);
    }
  }, [isOnline, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const redeemInvite = useCallback(
    async (code: string, captchaToken: string) => {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error(t("cloud.notConfigured"));
      if (!isOnline) throw new Error(t("cloud.onlineToRedeem"));
      if (!captchaToken) throw new Error(t("cloud.completeSecurity"));

      setBusy(true);
      setError(null);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          const { error: signInError } = await supabase.auth.signInAnonymously({
            options: { captchaToken },
          });
          if (signInError) throw new Error(t("cloud.identityFailed"));
        }

        const { data, error: redeemError } =
          await supabase.functions.invoke("redeem-invite", {
            body: { code },
          });
        if (redeemError) {
          throw new Error(
            await functionErrorMessage(
              redeemError,
              t("cloud.redeemFailed"),
              language,
            ),
          );
        }
        const role = data?.membership?.role;
        if (role !== "owner" && role !== "member") {
          throw new Error(t("cloud.invalidRole"));
        }
        setMembershipRole(role);
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : t("cloud.redeemFailed");
        setError(message);
        throw new Error(message);
      } finally {
        setBusy(false);
      }
    },
    [isOnline, language, t],
  );

  const createInvite = useCallback(async (): Promise<GeneratedInvite> => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error(t("cloud.notConfigured"));
    if (!isOnline) throw new Error(t("cloud.onlineToCreate"));
    setBusy(true);
    setError(null);
    try {
      const { data, error: inviteError } =
        await supabase.functions.invoke("create-invite", { body: {} });
      if (inviteError) {
        throw new Error(
          await functionErrorMessage(
            inviteError,
            t("cloud.createFailed"),
            language,
          ),
        );
      }
      if (
        typeof data?.code !== "string" ||
        typeof data?.expiresAt !== "string"
      ) {
        throw new Error(t("cloud.invalidInvite"));
      }
      const invite = { code: data.code, expiresAt: data.expiresAt };
      setGeneratedInvite(invite);
      return invite;
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : t("cloud.createFailed");
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }, [isOnline, language, t]);

  const syncSettings = useCallback(
    async (settings: ReminderSettings) => {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error(t("cloud.notConfigured"));
      if (!isOnline) throw new Error(t("cloud.onlineToSync"));
      const { data, error: syncError } = await supabase.functions.invoke(
        "sync-reminder-settings",
        { body: reminderSettingsPayload(settings) },
      );
      if (syncError) {
        throw new Error(
          await functionErrorMessage(
            syncError,
            t("cloud.syncFailed"),
            language,
          ),
        );
      }
      setNextReminderAt(
        settings.enabled && typeof data?.settings?.next_reminder_at === "string"
          ? data.settings.next_reminder_at
          : null,
      );
    },
    [isOnline, language, t],
  );

  const registerBrowserPush = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error(t("cloud.notConfigured"));
    if (!supportsWebPush()) {
      throw new Error(t("cloud.unsupported"));
    }
    const iosDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (iosDevice && !isInstalled) {
      throw new Error(t("cloud.installFirst"));
    }

    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    setNotificationPermission(permission);
    if (permission !== "granted") {
      throw new Error(
        permission === "denied"
          ? t("cloud.permissionDenied")
          : t("cloud.permissionRequired"),
      );
    }

    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      throw new Error(
        t("cloud.workerNotReady"),
      );
    }
    let existing = await registration.pushManager.getSubscription();
    if (
      existing &&
      !pushSubscriptionUsesVapidKey(
        existing,
        cloudConfiguration.vapidPublicKey,
      )
    ) {
      const removed = await existing.unsubscribe();
      if (!removed) {
        throw new Error(t("cloud.keyUpdateFailed"));
      }
      existing = null;
    }
    const subscription =
      existing ??
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          cloudConfiguration.vapidPublicKey,
        ),
      });

    const { error: registerError } = await supabase.functions.invoke(
      "register-push",
      { body: { subscription: subscription.toJSON(), language } },
    );
    if (registerError) {
      throw new Error(
        await functionErrorMessage(
          registerError,
          t("cloud.registerFailed"),
          language,
        ),
      );
    }
    setSubscriptionActive(true);
  }, [isInstalled, language, t]);

  const runBusy = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : t("cloud.operationFailed");
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }, [t]);

  const enableReminders = useCallback(
    (settings: ReminderSettings) =>
      runBusy(async () => {
        if (!membershipRole) throw new Error(t("cloud.inviteRequired"));
        await registerBrowserPush();
        await syncSettings({ ...settings, enabled: true });
      }),
    [membershipRole, registerBrowserPush, runBusy, syncSettings, t],
  );

  const disableReminders = useCallback(
    (settings: ReminderSettings) =>
      runBusy(async () => {
        if (!membershipRole) throw new Error(t("cloud.inviteRequired"));
        await syncSettings({ ...settings, enabled: false });
      }),
    [membershipRole, runBusy, syncSettings, t],
  );

  const saveReminderSettings = useCallback(
    (settings: ReminderSettings) =>
      runBusy(async () => {
        if (!membershipRole) throw new Error(t("cloud.inviteRequired"));
        await syncSettings(settings);
      }),
    [membershipRole, runBusy, syncSettings, t],
  );

  const testReminder = useCallback(
    () =>
      runBusy(async () => {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error(t("cloud.notConfigured"));
        if (!isOnline) throw new Error(t("cloud.onlineToTest"));
        if (!membershipRole) throw new Error(t("cloud.inviteRequired"));
        if (notificationPermission !== "granted") {
          throw new Error(t("cloud.allowNotifications"));
        }

        const subscription = await browserSubscription();
        if (!subscription) {
          setSubscriptionActive(false);
          throw new Error(t("cloud.subscriptionMissing"));
        }

        const { data, error: testError } = await supabase.functions.invoke(
          "test-reminder",
          { body: { endpoint: subscription.endpoint, language } },
        );
        if (testError) {
          throw new Error(
            await functionErrorMessage(
              testError,
              t("cloud.testFailed"),
              language,
            ),
          );
        }
        if (data?.sent !== true) {
          throw new Error(t("cloud.testUnconfirmed"));
        }
      }),
    [
      isOnline,
      membershipRole,
      notificationPermission,
      runBusy,
      language,
      t,
    ],
  );

  const prepareCloudIdentityRemoval = useCallback(() => {
    if (!isCloudConfigured) return false;
    const newlyScheduled = scheduleCloudCleanup();
    setCloudCleanupPending(true);
    return newlyScheduled;
  }, []);

  const cancelCloudIdentityRemoval = useCallback(() => {
    clearPendingCloudCleanup();
    setCloudCleanupPending(false);
  }, []);

  const removeCloudIdentity = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      clearPendingCloudCleanup();
      setCloudCleanupPending(false);
      return;
    }
    if (!isOnline) {
      setCloudCleanupPending(true);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        clearPendingCloudCleanup();
        setCloudCleanupPending(false);
        return;
      }

      const { error: disableError } = await supabase.functions.invoke(
        "register-push",
        { method: "DELETE" },
      );
      if (disableError) {
        throw new Error(
          await functionErrorMessage(
            disableError,
            t("cloud.serverRemovalFailed"),
            language,
          ),
        );
      }
      const subscription = await browserSubscription();
      if (subscription && !await subscription.unsubscribe()) {
        throw new Error(t("cloud.browserRemovalFailed"));
      }
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "local",
      });
      if (signOutError) throw signOutError;
      clearPendingCloudCleanup();
      setCloudCleanupPending(false);
      setMembershipRole(null);
      setSubscriptionActive(false);
      setNextReminderAt(null);
      setGeneratedInvite(null);
    } catch {
      scheduleCloudCleanup();
      setCloudCleanupPending(true);
      setError(t("cloud.cleanupFailed"));
    } finally {
      setBusy(false);
    }
  }, [isOnline, language, t]);

  useEffect(() => {
    if (!isOnline || loading || !hasPendingCloudCleanup()) return;
    void removeCloudIdentity();
  }, [isOnline, loading, removeCloudIdentity]);

  useEffect(() => {
    if (
      !isOnline ||
      loading ||
      !membershipRole ||
      !subscriptionActive
    ) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const supabase = getSupabaseClient();
      const subscription = await browserSubscription();
      if (!supabase || !subscription) return;

      const { error: registerError } = await supabase.functions.invoke(
        "register-push",
        { body: { subscription: subscription.toJSON(), language } },
      );
      if (!cancelled && registerError) {
        setError(t("cloud.registerFailed"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isOnline,
    language,
    loading,
    membershipRole,
    subscriptionActive,
    t,
  ]);

  return {
    configured: isCloudConfigured,
    loading,
    busy,
    membershipRole,
    notificationPermission,
    subscriptionActive,
    nextReminderAt,
    cloudCleanupPending,
    generatedInvite,
    error,
    redeemInvite,
    createInvite,
    clearGeneratedInvite: () => setGeneratedInvite(null),
    enableReminders,
    disableReminders,
    saveReminderSettings,
    testReminder,
    prepareCloudIdentityRemoval,
    cancelCloudIdentityRemoval,
    removeCloudIdentity,
    clearError: () => setError(null),
  };
}
