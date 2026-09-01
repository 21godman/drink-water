import webpush from "web-push";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import {
  createAdminClient,
  requireUser,
  userAuthError,
} from "../_shared/supabase.ts";
import {
  isPushEndpoint,
  safeErrorMessage,
} from "../_shared/validation.ts";
import {
  isNotificationLanguage,
  notificationMessage,
  type NotificationLanguage,
} from "../_shared/notification-copy.ts";

type TestReminderBody = {
  endpoint?: unknown;
  language?: NotificationLanguage;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function pushStatusCode(error: unknown): number | null {
  const statusCode = (error as { statusCode?: unknown })?.statusCode;
  return typeof statusCode === "number" ? statusCode : null;
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;
  if (request.method !== "POST") {
    return errorResponse("method_not_allowed", "只接受 POST。", 405);
  }

  try {
    const user = await requireUser(request);
    const body = await readJson<TestReminderBody>(request);
    const endpoint = body?.endpoint;
    if (!isPushEndpoint(endpoint)) {
      return errorResponse("invalid_endpoint", "推播訂閱格式不正確。");
    }
    const language = body?.language ?? "zh-TW";
    if (!isNotificationLanguage(language)) {
      return errorResponse("invalid_language", "通知語系格式不正確。");
    }

    const admin = createAdminClient();
    const { data: member, error: memberError } = await admin
      .from("members")
      .select("user_id")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member) {
      return errorResponse("active_member_required", "這台裝置沒有有效身分。", 403);
    }

    const { data, error: subscriptionError } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user.id)
      .eq("endpoint", endpoint)
      .is("disabled_at", null)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;
    if (!data) {
      return errorResponse(
        "active_subscription_required",
        "找不到這台裝置的有效推播訂閱，請重新開啟提醒。",
        409,
      );
    }

    const subscription = data as PushSubscriptionRow;
    webpush.setVapidDetails(
      requiredEnv("VAPID_SUBJECT"),
      requiredEnv("VAPID_PUBLIC_KEY"),
      requiredEnv("VAPID_PRIVATE_KEY"),
    );

    try {
      const message = notificationMessage(language);
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify({
          ...message,
          url: "./",
          tag: "drink-water-test-reminder",
        }),
        { TTL: 60, urgency: "high" },
      );
      return jsonResponse({ sent: true });
    } catch (pushError) {
      const statusCode = pushStatusCode(pushError);
      if (statusCode === 404 || statusCode === 410) {
        const { error: disableError } = await admin
          .from("push_subscriptions")
          .update({
            disabled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id)
          .eq("user_id", user.id);
        if (disableError) throw disableError;
        return errorResponse(
          "subscription_expired",
          "這台裝置的通知連線已失效，請重新開啟提醒。",
          410,
        );
      }
      console.error("test-reminder push failed", safeErrorMessage(pushError));
      return errorResponse(
        "push_failed",
        "測試通知傳送失敗，請稍後再試。",
        502,
      );
    }
  } catch (error) {
    if (userAuthError(error)) {
      return errorResponse("unauthorized", "登入狀態無效。", 401);
    }
    console.error("test-reminder failed", safeErrorMessage(error));
    return errorResponse("server_error", "測試通知傳送失敗。", 500);
  }
});
