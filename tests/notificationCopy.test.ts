import { describe, expect, it } from "vitest";
import {
  notificationMessage,
  notificationMessages,
} from "../supabase/functions/_shared/notification-copy";

describe("notification copy", () => {
  it.each(["zh-TW", "en", "th"] as const)(
    "%s 有 10 組不含句號的通知文案",
    (language) => {
      expect(notificationMessages[language]).toHaveLength(10);
      for (const message of notificationMessages[language]) {
        expect(message.title).not.toMatch(/[。.]/);
        expect(message.body).not.toMatch(/[。.]/);
      }
    },
  );

  it("可以用亂數選到第一組與最後一組", () => {
    expect(notificationMessage("zh-TW", () => 0)).toEqual(
      notificationMessages["zh-TW"][0],
    );
    expect(notificationMessage("zh-TW", () => 0.999999)).toEqual(
      notificationMessages["zh-TW"][9],
    );
  });

  it("未知語系會安全改用繁體中文", () => {
    expect(notificationMessage("unknown", () => 0)).toEqual(
      notificationMessages["zh-TW"][0],
    );
  });
});
