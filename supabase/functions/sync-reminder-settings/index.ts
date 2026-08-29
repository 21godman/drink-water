import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import {
  createAdminClient,
  requireUser,
  userAuthError,
} from "../_shared/supabase.ts";
import {
  isReminderSettingsInput,
  safeErrorMessage,
} from "../_shared/validation.ts";

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;
  if (request.method !== "POST") {
    return errorResponse("method_not_allowed", "只接受 POST。", 405);
  }

  try {
    const user = await requireUser(request);
    const settings = await readJson<unknown>(request);
    if (!isReminderSettingsInput(settings)) {
      return errorResponse("invalid_settings", "提醒設定格式不正確。");
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("upsert_reminder_preferences", {
      preference_user_id: user.id,
      preference_enabled: settings.enabled,
      preference_start: settings.startTime,
      preference_end: settings.endTime,
      preference_interval_minutes: settings.intervalMinutes,
      preference_time_zone: settings.timeZone,
    });
    if (error) throw error;
    return jsonResponse({ settings: data });
  } catch (error) {
    if (userAuthError(error)) {
      return errorResponse("unauthorized", "登入狀態無效。", 401);
    }
    console.error("sync-reminder-settings failed", safeErrorMessage(error));
    return errorResponse("server_error", "暫時無法同步提醒設定。", 500);
  }
});
