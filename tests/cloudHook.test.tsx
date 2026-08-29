import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCloudReminders } from "../src/useCloudReminders";

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
}));

vi.mock("../src/supabaseClient", () => ({
  cloudConfiguration: {
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "sb_publishable_example",
    vapidPublicKey: "AQIDBA",
    turnstileSiteKey: "turnstile-example",
  },
  getSupabaseClient: supabaseMocks.getSupabaseClient,
  isCloudConfigured: true,
}));

function installPushBrowser(subscription: PushSubscription) {
  vi.stubGlobal("Notification", {
    permission: "granted",
    requestPermission: vi.fn(),
  });
  vi.stubGlobal("PushManager", class PushManager {});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration: vi.fn().mockResolvedValue({
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(subscription),
        },
      }),
    },
  });
}

function supabaseClient(disabledAt: string | null) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "session" } },
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === "members") {
        return {
          select: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: "member" },
              error: null,
            }),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { disabled_at: disabledAt },
              error: null,
            }),
          })),
        })),
      };
    }),
  };
}

afterEach(() => {
  cleanup();
  supabaseMocks.getSupabaseClient.mockReset();
  localStorage.clear();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("useCloudReminders subscription reconciliation", () => {
  it("離線時保留既有狀態且不呼叫 Supabase", async () => {
    supabaseMocks.getSupabaseClient.mockReturnValue(supabaseClient(null));

    const { result } = renderHook(() =>
      useCloudReminders({ isInstalled: true, isOnline: false }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(supabaseMocks.getSupabaseClient).toHaveBeenCalledTimes(1);
    expect(supabaseMocks.getSupabaseClient.mock.results[0]?.value.auth.getSession)
      .not.toHaveBeenCalled();
  });

  it.each([
    { disabledAt: null, expected: true },
    { disabledAt: "2026-07-26T00:00:00.000Z", expected: false },
  ])(
    "依伺服器 disabled_at 判定 subscriptionActive=$expected",
    async ({ disabledAt, expected }) => {
      const subscription = {
        endpoint: "https://push.example/subscription",
        options: {
          applicationServerKey: new Uint8Array([1, 2, 3, 4]).buffer,
        },
      } as PushSubscription;
      installPushBrowser(subscription);
      supabaseMocks.getSupabaseClient.mockReturnValue(
        supabaseClient(disabledAt),
      );

      const { result } = renderHook(() =>
        useCloudReminders({ isInstalled: true, isOnline: true }),
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.membershipRole).toBe("member");
      expect(result.current.subscriptionActive).toBe(expected);
    },
  );

  it("VAPID key 不一致時不把瀏覽器 subscription 視為 active", async () => {
    const client = supabaseClient(null);
    const subscription = {
      endpoint: "https://push.example/old-subscription",
      options: {
        applicationServerKey: new Uint8Array([9, 9, 9, 9]).buffer,
      },
    } as PushSubscription;
    installPushBrowser(subscription);
    supabaseMocks.getSupabaseClient.mockReturnValue(client);

    const { result } = renderHook(() =>
      useCloudReminders({ isInstalled: true, isOnline: true }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subscriptionActive).toBe(false);
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("離線時保留待清理旗標，恢復連線後自動解除雲端身分", async () => {
    const subscription = {
      endpoint: "https://push.example/subscription",
      options: {
        applicationServerKey: new Uint8Array([1, 2, 3, 4]).buffer,
      },
      unsubscribe: vi.fn().mockResolvedValue(true),
    } as unknown as PushSubscription;
    const client = supabaseClient(null);
    installPushBrowser(subscription);
    supabaseMocks.getSupabaseClient.mockReturnValue(client);

    const { result, rerender } = renderHook(
      ({ isOnline }) =>
        useCloudReminders({ isInstalled: true, isOnline }),
      { initialProps: { isOnline: false } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.prepareCloudIdentityRemoval();
      await result.current.removeCloudIdentity();
    });
    expect(result.current.cloudCleanupPending).toBe(true);
    expect(client.functions.invoke).not.toHaveBeenCalled();

    rerender({ isOnline: true });

    await waitFor(() =>
      expect(result.current.cloudCleanupPending).toBe(false),
    );
    expect(client.functions.invoke).toHaveBeenCalledWith("register-push", {
      method: "DELETE",
    });
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
