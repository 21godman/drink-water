import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultReminderSettings } from "../src/appState";
import CloudReminderCard from "../src/CloudReminderCard";
import type { CloudReminders } from "../src/cloudTypes";
import {
  clearPendingCloudCleanup,
  hasPendingCloudCleanup,
  isCompleteInviteCode,
  normalizeInviteCode,
  pushSubscriptionUsesVapidKey,
  reminderSettingsPayload,
  scheduleCloudCleanup,
  urlBase64ToUint8Array,
} from "../src/cloudUtils";
import { isPushSubscriptionInput } from "../supabase/functions/_shared/validation";

function cloud(overrides: Partial<CloudReminders> = {}): CloudReminders {
  return {
    configured: true,
    loading: false,
    busy: false,
    membershipRole: "member",
    notificationPermission: "default",
    subscriptionActive: false,
    cloudCleanupPending: false,
    generatedInvite: null,
    error: null,
    redeemInvite: vi.fn(),
    createInvite: vi.fn(),
    clearGeneratedInvite: vi.fn(),
    enableReminders: vi.fn(),
    disableReminders: vi.fn(),
    saveReminderSettings: vi.fn(),
    prepareCloudIdentityRemoval: vi.fn(() => true),
    cancelCloudIdentityRemoval: vi.fn(),
    removeCloudIdentity: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  clearPendingCloudCleanup();
});

describe("cloud reminder helpers", () => {
  it("格式化邀請碼並忽略非十六進位字元", () => {
    expect(normalizeInviteCode("ab cd-ef12_3456 789a bcde")).toBe(
      "ABCD-EF12-3456-789A-BCDE",
    );
    expect(isCompleteInviteCode("abcd-ef12-3456-789a-bcde")).toBe(true);
    expect(isCompleteInviteCode("ABCD-EF12")).toBe(false);
  });

  it("把 VAPID URL-safe base64 轉為訂閱用位元組", () => {
    expect(Array.from(urlBase64ToUint8Array("AQIDBA"))).toEqual([1, 2, 3, 4]);
  });

  it("確認瀏覽器 subscription 使用目前的 VAPID public key", () => {
    const currentKey = urlBase64ToUint8Array("AQIDBA").buffer;
    const subscription = {
      options: { applicationServerKey: currentKey },
    } as PushSubscription;

    expect(pushSubscriptionUsesVapidKey(subscription, "AQIDBA")).toBe(true);
    expect(pushSubscriptionUsesVapidKey(subscription, "AQIDBQ")).toBe(false);
    expect(
      pushSubscriptionUsesVapidKey(
        { options: { applicationServerKey: null } } as PushSubscription,
        "AQIDBA",
      ),
    ).toBe(false);
  });

  it("同步 payload 保留本機提醒設定並附加 IANA 時區", () => {
    const payload = reminderSettingsPayload(defaultReminderSettings);
    expect(payload).toMatchObject(defaultReminderSettings);
    expect(payload.timeZone.length).toBeGreaterThan(0);
  });

  it("只用不含身分或喝水資料的旗標排程雲端清理", () => {
    expect(hasPendingCloudCleanup()).toBe(false);
    expect(scheduleCloudCleanup()).toBe(true);
    expect(scheduleCloudCleanup()).toBe(false);
    expect(hasPendingCloudCleanup()).toBe(true);

    clearPendingCloudCleanup();
    expect(hasPendingCloudCleanup()).toBe(false);
  });

  it("拒絕過大的推播金鑰與無效的到期時間", () => {
    const valid = {
      endpoint: "https://push.example/subscription",
      expirationTime: null,
      keys: { p256dh: "p256dh", auth: "auth" },
    };

    expect(isPushSubscriptionInput(valid)).toBe(true);
    expect(
      isPushSubscriptionInput({
        ...valid,
        expirationTime: -1,
      }),
    ).toBe(false);
    expect(
      isPushSubscriptionInput({
        ...valid,
        keys: { ...valid.keys, p256dh: "x".repeat(513) },
      }),
    ).toBe(false);
  });
});

describe("CloudReminderCard", () => {
  it("iPhone 尚未安裝時先顯示加入主畫面步驟", () => {
    render(
      <CloudReminderCard
        settings={defaultReminderSettings}
        dispatch={vi.fn()}
        cloud={cloud()}
        pwa={{
          canInstall: true,
          installMode: "ios-safari",
          install: vi.fn(),
          isInstalled: false,
        }}
      />,
    );

    expect(screen.getByText("先安裝到 iPhone 主畫面")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "允許通知並開啟提醒" }),
    ).toBeNull();
  });

  it("已加入且可推播時由明確按鈕要求通知權限", () => {
    const enableReminders = vi.fn().mockResolvedValue(undefined);
    render(
      <CloudReminderCard
        settings={defaultReminderSettings}
        dispatch={vi.fn()}
        cloud={cloud({ enableReminders })}
        pwa={{
          canInstall: false,
          installMode: "none",
          install: vi.fn(),
          isInstalled: true,
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "允許通知並開啟提醒" }),
    );
    expect(enableReminders).toHaveBeenCalledWith({
      ...defaultReminderSettings,
      enabled: true,
    });
  });

  it("只有 owner 顯示產生邀請碼操作", () => {
    const createInvite = vi.fn().mockResolvedValue({
      code: "ABCD-EF12-3456-789A-BCDE",
      expiresAt: "2026-07-27T00:00:00.000Z",
    });
    const { rerender } = render(
      <CloudReminderCard
        settings={defaultReminderSettings}
        dispatch={vi.fn()}
        cloud={cloud({ membershipRole: "owner", createInvite })}
        pwa={{
          canInstall: false,
          installMode: "none",
          install: vi.fn(),
          isInstalled: true,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "產生邀請碼" }));
    expect(createInvite).toHaveBeenCalledTimes(1);

    rerender(
      <CloudReminderCard
        settings={defaultReminderSettings}
        dispatch={vi.fn()}
        cloud={cloud({ membershipRole: "member" })}
        pwa={{
          canInstall: false,
          installMode: "none",
          install: vi.fn(),
          isInstalled: true,
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: "產生邀請碼" })).toBeNull();
  });
});
