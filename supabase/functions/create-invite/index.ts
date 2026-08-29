import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import {
  createAdminClient,
  requireUser,
  userAuthError,
} from "../_shared/supabase.ts";
import { safeErrorMessage } from "../_shared/validation.ts";

type InviteResult = { code: string; expires_at: string };

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;
  if (request.method !== "POST") {
    return errorResponse("method_not_allowed", "只接受 POST。", 405);
  }

  try {
    const user = await requireUser(request);
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("create_member_invite", {
      creating_user_id: user.id,
    });
    if (error) {
      if (error.message.includes("owner_required")) {
        return errorResponse("owner_required", "只有 owner 可以產生邀請碼。", 403);
      }
      throw error;
    }

    const result = (data as InviteResult[] | null)?.[0];
    if (!result) throw new Error("missing_invite_result");
    return jsonResponse({
      code: result.code,
      expiresAt: result.expires_at,
    });
  } catch (error) {
    if (userAuthError(error)) {
      return errorResponse("unauthorized", "登入狀態無效。", 401);
    }
    console.error("create-invite failed", safeErrorMessage(error));
    return errorResponse("server_error", "暫時無法產生邀請碼。", 500);
  }
});
