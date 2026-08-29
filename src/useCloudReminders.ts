import { useCallback, useEffect, useState } from "react";
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
import type { ReminderSettings } from "./types";

type FunctionErrorPayload = {
  error?: { code?: string; message?: string };
};

async function functionErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    try {
      const payload = await context.clone().json() as FunctionErrorPayload;
      if (payload.error?.message) return payload.error.message;
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
}: {
  isInstalled: boolean;
  isOnline: boolean;
}): CloudReminders {
  const [loading, setLoading] = useState(isCloudConfigured);
  const [busy, setBusy] = useState(false);
  const [membershipRole, setMembershipRole] =
    useState<MembershipRole | null>(null);
  const [notificationPermission, setNotificationPermission] = useState(
    currentNotificationPermission,
  );
  const [subscriptionActive, setSubscriptionActive] = useState(false);
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
      if (!role) return;

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
      setError("暫時無法讀取雲端提醒狀態。");
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const redeemInvite = useCallback(
    async (code: string, captchaToken: string) => {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("雲端提醒尚未設定完成。");
      if (!isOnline) throw new Error("請先連上網路再兌換邀請碼。");
      if (!captchaToken) throw new Error("請先完成安全驗證。");

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
          if (signInError) throw new Error("無法建立這台裝置的身分。");
        }

        const { data, error: redeemError } =
          await supabase.functions.invoke("redeem-invite", {
            body: { code },
          });
        if (redeemError) {
          throw new Error(
            await functionErrorMessage(redeemError, "無法兌換邀請碼。"),
          );
        }
        const role = data?.membership?.role;
        if (role !== "owner" && role !== "member") {
          throw new Error("伺服器沒有回傳有效的成員身分。");
        }
        setMembershipRole(role);
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "無法兌換邀請碼。";
        setError(message);
        throw new Error(message);
      } finally {
        setBusy(false);
      }
    },
    [isOnline],
  );

  const createInvite = useCallback(async (): Promise<GeneratedInvite> => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("雲端提醒尚未設定完成。");
    if (!isOnline) throw new Error("請先連上網路再產生邀請碼。");
    setBusy(true);
    setError(null);
    try {
      const { data, error: inviteError } =
        await supabase.functions.invoke("create-invite", { body: {} });
      if (inviteError) {
        throw new Error(
          await functionErrorMessage(inviteError, "無法產生邀請碼。"),
        );
      }
      if (
        typeof data?.code !== "string" ||
        typeof data?.expiresAt !== "string"
      ) {
        throw new Error("伺服器沒有回傳有效的邀請碼。");
      }
      const invite = { code: data.code, expiresAt: data.expiresAt };
      setGeneratedInvite(invite);
      return invite;
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "無法產生邀請碼。";
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }, [isOnline]);

  const syncSettings = useCallback(
    async (settings: ReminderSettings) => {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("雲端提醒尚未設定完成。");
      if (!isOnline) throw new Error("請先連上網路再同步提醒設定。");
      const { error: syncError } = await supabase.functions.invoke(
        "sync-reminder-settings",
        { body: reminderSettingsPayload(settings) },
      );
      if (syncError) {
        throw new Error(
          await functionErrorMessage(syncError, "無法同步提醒設定。"),
        );
      }
    },
    [isOnline],
  );

  const registerBrowserPush = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("雲端提醒尚未設定完成。");
    if (!supportsWebPush()) {
      throw new Error("這個瀏覽器不支援系統通知。");
    }
    const iosDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (iosDevice && !isInstalled) {
      throw new Error("請先用 Safari 將 App 加入主畫面，再從主畫面開啟。");
    }

    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    setNotificationPermission(permission);
    if (permission !== "granted") {
      throw new Error(
        permission === "denied"
          ? "通知權限已被拒絕，請到裝置設定中重新允許。"
          : "必須允許通知才能開啟提醒。",
      );
    }

    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      throw new Error(
        "Service Worker 尚未就緒，請使用 production 版本並重新開啟 App。",
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
        throw new Error("無法更新這台裝置的推播金鑰，請重新開啟 App 後再試。");
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
      { body: { subscription: subscription.toJSON() } },
    );
    if (registerError) {
      throw new Error(
        await functionErrorMessage(registerError, "無法登記這台裝置。"),
      );
    }
    setSubscriptionActive(true);
  }, [isInstalled]);

  const runBusy = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "雲端提醒操作失敗。";
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }, []);

  const enableReminders = useCallback(
    (settings: ReminderSettings) =>
      runBusy(async () => {
        if (!membershipRole) throw new Error("請先輸入有效邀請碼。");
        await registerBrowserPush();
        await syncSettings({ ...settings, enabled: true });
      }),
    [membershipRole, registerBrowserPush, runBusy, syncSettings],
  );

  const disableReminders = useCallback(
    (settings: ReminderSettings) =>
      runBusy(async () => {
        if (!membershipRole) throw new Error("請先輸入有效邀請碼。");
        await syncSettings({ ...settings, enabled: false });
      }),
    [membershipRole, runBusy, syncSettings],
  );

  const saveReminderSettings = useCallback(
    (settings: ReminderSettings) =>
      runBusy(async () => {
        if (!membershipRole) throw new Error("請先輸入有效邀請碼。");
        await syncSettings(settings);
      }),
    [membershipRole, runBusy, syncSettings],
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
            "無法移除伺服器推播訂閱。",
          ),
        );
      }
      const subscription = await browserSubscription();
      if (subscription && !await subscription.unsubscribe()) {
        throw new Error("無法解除瀏覽器推播訂閱。");
      }
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "local",
      });
      if (signOutError) throw signOutError;
      clearPendingCloudCleanup();
      setCloudCleanupPending(false);
      setMembershipRole(null);
      setSubscriptionActive(false);
      setGeneratedInvite(null);
    } catch {
      scheduleCloudCleanup();
      setCloudCleanupPending(true);
      setError("本機資料已清除；雲端提醒解除失敗，稍後會自動重試。");
    } finally {
      setBusy(false);
    }
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline || loading || !hasPendingCloudCleanup()) return;
    void removeCloudIdentity();
  }, [isOnline, loading, removeCloudIdentity]);

  return {
    configured: isCloudConfigured,
    loading,
    busy,
    membershipRole,
    notificationPermission,
    subscriptionActive,
    cloudCleanupPending,
    generatedInvite,
    error,
    redeemInvite,
    createInvite,
    clearGeneratedInvite: () => setGeneratedInvite(null),
    enableReminders,
    disableReminders,
    saveReminderSettings,
    prepareCloudIdentityRemoval,
    cancelCloudIdentityRemoval,
    removeCloudIdentity,
    clearError: () => setError(null),
  };
}
