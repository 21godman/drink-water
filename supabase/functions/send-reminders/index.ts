import webpush from "web-push";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { safeErrorMessage } from "../_shared/validation.ts";
import {
  notificationMessage,
  type NotificationLanguage,
} from "../_shared/notification-copy.ts";

type Delivery = {
  delivery_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  attempt_count: number;
  language: NotificationLanguage;
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |=
      (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

function webPushFailure(error: unknown): {
  statusCode: number | null;
  permanent: boolean;
  message: string;
} {
  const candidate = error as {
    statusCode?: unknown;
    message?: unknown;
    body?: unknown;
  };
  const statusCode =
    typeof candidate?.statusCode === "number" ? candidate.statusCode : null;
  return {
    statusCode,
    permanent: statusCode === 404 || statusCode === 410,
    message:
      typeof candidate?.message === "string"
        ? candidate.message
        : "web_push_failed",
  };
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;
  if (request.method !== "POST") {
    return errorResponse("method_not_allowed", "只接受 POST。", 405);
  }

  try {
    const suppliedSecret = request.headers.get("x-cron-secret") ?? "";
    const expectedSecret = requiredEnv("CRON_SECRET");
    if (!constantTimeEqual(suppliedSecret, expectedSecret)) {
      return errorResponse("unauthorized", "排程驗證失敗。", 401);
    }

    webpush.setVapidDetails(
      requiredEnv("VAPID_SUBJECT"),
      requiredEnv("VAPID_PUBLIC_KEY"),
      requiredEnv("VAPID_PRIVATE_KEY"),
    );

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("claim_due_deliveries", {
      claim_time: new Date().toISOString(),
      claim_limit: 100,
    });
    if (error) throw error;

    const deliveries = (data ?? []) as Delivery[];
    let sent = 0;
    let failed = 0;

    for (const delivery of deliveries) {
      try {
        const message = notificationMessage(delivery.language);
        await webpush.sendNotification(
          {
            endpoint: delivery.endpoint,
            keys: {
              p256dh: delivery.p256dh,
              auth: delivery.auth,
            },
          },
          JSON.stringify({
            ...message,
            url: "./",
            tag: "drink-water-reminder",
          }),
          { TTL: 300, urgency: "normal" },
        );
        const { error: finishError } = await admin.rpc(
          "finish_notification_delivery",
          {
            finished_delivery_id: delivery.delivery_id,
            delivery_success: true,
            delivery_permanent_failure: false,
            delivery_response_status: 201,
            delivery_error_message: null,
          },
        );
        if (finishError) throw finishError;
        sent += 1;
      } catch (pushError) {
        const failure = webPushFailure(pushError);
        const { error: finishError } = await admin.rpc(
          "finish_notification_delivery",
          {
            finished_delivery_id: delivery.delivery_id,
            delivery_success: false,
            delivery_permanent_failure: failure.permanent,
            delivery_response_status: failure.statusCode,
            delivery_error_message: failure.message,
          },
        );
        if (finishError) {
          console.error(
            "failed to update delivery",
            delivery.delivery_id,
            finishError.message,
          );
        }
        failed += 1;
      }
    }

    return jsonResponse({
      claimed: deliveries.length,
      sent,
      failed,
    });
  } catch (error) {
    console.error("send-reminders failed", safeErrorMessage(error));
    return errorResponse("server_error", "提醒排程執行失敗。", 500);
  }
});
