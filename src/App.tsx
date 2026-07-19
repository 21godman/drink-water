import { useEffect, useReducer, useState } from "react";
import { appReducer, initialState } from "./appState";
import HistoryView from "./HistoryView";
import Onboarding from "./Onboarding";
import SettingsView from "./SettingsView";
import TodayView from "./TodayView";
import type { AppView } from "./types";

const navigation: Array<{ id: AppView; label: string; icon: string }> = [
  { id: "today", label: "今日", icon: "⌂" },
  { id: "history", label: "歷史", icon: "▥" },
  { id: "settings", label: "設定", icon: "⌁" },
];

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [view, setView] = useState<AppView>("today");

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [state.isOnboarded, view]);

  if (!state.isOnboarded || !state.profile) {
    return (
      <Onboarding
        onComplete={(profile, container) =>
          dispatch({ type: "completeSetup", profile, container })
        }
      />
    );
  }

  return (
    <div className="app-frame">
      <main className="app-content">
        {view === "today" ? (
          <TodayView state={state} dispatch={dispatch} />
        ) : null}
        {view === "history" ? <HistoryView state={state} /> : null}
        {view === "settings" ? (
          <SettingsView state={state} dispatch={dispatch} />
        ) : null}
      </main>

      <nav className="bottom-nav" aria-label="主要導覽">
        {navigation.map((item) => (
          <button
            aria-current={view === item.id ? "page" : undefined}
            className={view === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setView(item.id)}
            type="button"
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
