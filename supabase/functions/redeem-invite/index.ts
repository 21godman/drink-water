import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import {
  createAdminClient,
  requireUser,
  userAuthError,
} from "../_shared/supabase.ts";
import { safeErrorMessage } from "../_shared/validation.ts";

type RedeemBody = { code?: unknown };
type RedeemResult = { outcome: string; member_role: "owner" | "member" | null };

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;
  if (request.method !== "POST") {
    return errorResponse("method_not_allowed", "只接受 POST。", 405);
  }

  try {
    const user = await requireUser(request);
    const body = await readJson<RedeemBody>(request);
    if (!body || typeof body.code !== "string") {
      return errorResponse("invalid_code", "請輸入邀請碼。");
    }

    const normalized = body.code.replace(/[^0-9a-f]/gi, "").toUpperCase();
    if (!/^[0-9A-F]{20}$/.test(normalized)) {
      return errorResponse("invalid_code", "邀請碼格式不正確。");
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("redeem_invite", {
      redeeming_user_id: user.id,
      invite_code: normalized,
    });
    if (error) throw error;

    const result = (data as RedeemResult[] | null)?.[0];
    if (!result) throw new Error("missing_redeem_result");
    if (result.outcome === "rate_limited") {
      return errorResponse(
        "rate_limited",
        "嘗試次數過多，請 15 分鐘後再試。",
        429,
      );
    }
    if (result.outcome === "invalid") {
      return errorResponse(
        "invalid_code",
        "邀請碼無效、已使用或已過期。",
        400,
      );
    }

    return jsonResponse({
      membership: {
        role: result.member_role,
        joined: true,
      },
    });
  } catch (error) {
    if (userAuthError(error)) {
      return errorResponse("unauthorized", "登入狀態無效。", 401);
    }
    console.error("redeem-invite failed", safeErrorMessage(error));
    return errorResponse("server_error", "暫時無法兌換邀請碼。", 500);
  }
});
