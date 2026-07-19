import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "../src/App";

afterEach(cleanup);

function completeSetup() {
  fireEvent.change(screen.getByRole("spinbutton", { name: /身高/ }), {
    target: { value: "170" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: /體重/ }), {
    target: { value: "65" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /容器名稱/ }), {
    target: { value: "藍色水壺" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: /容量/ }), {
    target: { value: "600" },
  });
  fireEvent.click(screen.getByRole("button", { name: /開始記錄喝水/ }));
}

describe("App onboarding", () => {
  it("依身高體重顯示公式目標，並要求至少一個容器", () => {
    render(<App />);

    fireEvent.change(screen.getByRole("spinbutton", { name: /身高/ }), {
      target: { value: "170" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: /體重/ }), {
      target: { value: "65" },
    });

    expect(screen.getByText(/2,350/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /開始記錄喝水/ }));
    expect(screen.getByRole("alert").textContent).toContain("至少一個容器");
  });

  it("可改用自訂每日目標", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("radio", { name: "自訂目標" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /身高/ }), {
      target: { value: "170" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: /體重/ }), {
      target: { value: "65" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: /自訂每日目標/ }), {
      target: { value: "2800" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /容器名稱/ }), {
      target: { value: "玻璃杯" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: /容量/ }), {
      target: { value: "350" },
    });
    fireEvent.click(screen.getByRole("button", { name: /開始記錄喝水/ }));

    expect(screen.getByLabelText(/每日目標 2800 mL/)).toBeTruthy();
  });
});

describe("App drinking flow", () => {
  it("快速記水後可修改並刪除紀錄", () => {
    render(<App />);
    completeSetup();

    fireEvent.click(
      screen.getByRole("button", { name: /藍色水壺 600 mL，記錄喝水/ }),
    );
    expect(screen.getByLabelText(/今日已喝 600 mL/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /編輯 藍色水壺 600 mL/ }));
    const dialog = screen.getByRole("dialog", { name: "藍色水壺" });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: /飲水量/ }), {
      target: { value: "450" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "儲存變更" }));
    expect(screen.getByLabelText(/今日已喝 450 mL/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /編輯 藍色水壺 450 mL/ }));
    fireEvent.click(screen.getByRole("button", { name: "刪除紀錄" }));
    expect(screen.getByText("第一杯水，從現在開始")).toBeTruthy();
  });

  it("可切換今日、歷史、設定三個主分頁", () => {
    render(<App />);
    completeSetup();

    const navigation = screen.getByRole("navigation", { name: "主要導覽" });
    fireEvent.click(within(navigation).getByRole("button", { name: /歷史/ }));
    expect(screen.getByRole("heading", { name: "喝水趨勢" })).toBeTruthy();

    fireEvent.click(within(navigation).getByRole("button", { name: /設定/ }));
    expect(screen.getByRole("heading", { name: "你的設定" })).toBeTruthy();

    fireEvent.click(within(navigation).getByRole("button", { name: /今日/ }));
    expect(screen.getByRole("heading", { name: "今天也好好喝水" })).toBeTruthy();
  });

  it("最後一個容器不可刪除，新增第二個後即可刪除", () => {
    render(<App />);
    completeSetup();
    fireEvent.click(screen.getByRole("button", { name: /設定/ }));

    fireEvent.click(screen.getByRole("button", { name: "編輯 藍色水壺" }));
    expect(screen.getByRole("button", { name: "刪除容器" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "關閉容器設定" }));

    fireEvent.click(screen.getByRole("button", { name: /新增/ }));
    const dialog = screen.getByRole("dialog", { name: "新增容器" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /容器名稱/ }), {
      target: { value: "馬克杯" },
    });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: /容量/ }), {
      target: { value: "320" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "加入容器" }));

    fireEvent.click(screen.getByRole("button", { name: "編輯 藍色水壺" }));
    expect(screen.getByRole("button", { name: "刪除容器" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "刪除容器" }));
    expect(screen.queryByText("藍色水壺")).toBeNull();
    expect(screen.getByText("馬克杯")).toBeTruthy();
  });
});
