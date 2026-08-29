import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import {
  createAdminClient,
  requireUser,
  userAuthError,
} from "../_shared/supabase.ts";
import {
  isPushSubscriptionInput,
  safeErrorMessage,
} from "../_shared/validation.ts";

type RegisterBody = { subscription?: unknown };

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;
  if (request.method !== "POST" && request.method !== "DELETE") {
    return errorResponse("method_not_allowed", "只接受 POST 或 DELETE。", 405);
  }

  try {
    const user = await requireUser(request);
    const admin = createAdminClient();

    if (request.method === "DELETE") {
      const { error } = await admin.rpc("disable_push_subscriptions", {
        subscription_user_id: user.id,
      });
      if (error) throw error;
      return jsonResponse({ removed: true });
    }

    const body = await readJson<RegisterBody>(request);
    if (!body || !isPushSubscriptionInput(body.subscription)) {
      return errorResponse("invalid_subscription", "推播訂閱格式不正確。");
    }

    const { endpoint, expirationTime, keys } = body.subscription;
    const { data, error } = await admin.rpc("register_push_subscription", {
      subscription_user_id: user.id,
      subscription_endpoint: endpoint,
      subscription_p256dh: keys.p256dh,
      subscription_auth: keys.auth,
      subscription_expiration_time: expirationTime,
    });
    if (error) throw error;
    return jsonResponse({ subscriptionId: data });
  } catch (error) {
    if (userAuthError(error)) {
      return errorResponse("unauthorized", "登入狀態無效。", 401);
    }
    console.error("register-push failed", safeErrorMessage(error));
    return errorResponse("server_error", "暫時無法保存推播訂閱。", 500);
  }
});
