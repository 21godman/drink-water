import { useEffect, useRef } from "react";

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      theme: "light";
      language: string;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(
      TURNSTILE_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");

    const handleLoad = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile 載入失敗"));
    };
    const handleError = () => reject(new Error("Turnstile 載入失敗"));

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!existing) {
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
  });
}

export default function TurnstileWidget({
  siteKey,
  onToken,
  onError,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  onError: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let api: TurnstileApi | null = null;
    let widgetId: string | null = null;

    loadTurnstile()
      .then((loadedApi) => {
        if (!active || !containerRef.current) return;
        api = loadedApi;
        widgetId = loadedApi.render(containerRef.current, {
          sitekey: siteKey,
          callback: onToken,
          "expired-callback": () => onToken(""),
          "error-callback": () => onError("安全驗證失敗，請重新整理後再試。"),
          theme: "light",
          language: "zh-TW",
        });
      })
      .catch((error: unknown) => {
        if (active) {
          onError(
            error instanceof Error ? error.message : "安全驗證載入失敗",
          );
        }
      });

    return () => {
      active = false;
      if (api && widgetId) api.remove(widgetId);
    };
  }, [onError, onToken, siteKey]);

  return <div className="turnstile-widget" ref={containerRef} />;
}
