import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type Dispatch,
} from "react";
import { appReducer, initialState } from "./appState";
import { clearAppState, loadAppState, saveAppState } from "./indexedDb";
import type { AppAction, AppState } from "./types";

export type PersistenceStatus = "loading" | "ready" | "load-error";

export type PersistentAppState = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  status: PersistenceStatus;
  storageError: string | null;
  retryLoad: () => void;
  retrySave: () => void;
  clearLocalData: () => Promise<void>;
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function usePersistentAppState(): PersistentAppState {
  const [state, baseDispatch] = useReducer(appReducer, initialState);
  const [status, setStatus] = useState<PersistenceStatus>("loading");
  const [storageError, setStorageError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const hydratedRef = useRef(false);
  const latestStateRef = useRef(state);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const writeVersionRef = useRef(0);

  latestStateRef.current = state;

  const enqueueSave = useCallback((stateToSave: AppState) => {
    const version = ++writeVersionRef.current;
    writeQueueRef.current = writeQueueRef.current
      .catch(() => undefined)
      .then(() => saveAppState(stateToSave))
      .then(() => {
        if (version === writeVersionRef.current) setStorageError(null);
      })
      .catch((error: unknown) => {
        if (version === writeVersionRef.current) {
          setStorageError(errorMessage(error, "無法保存本機資料"));
        }
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    hydratedRef.current = false;
    setStatus("loading");
    setStorageError(null);

    loadAppState()
      .then((savedState) => {
        if (cancelled) return;
        baseDispatch({ type: "hydrate", state: savedState ?? initialState });
        hydratedRef.current = true;
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStorageError(errorMessage(error, "無法讀取本機資料"));
        setStatus("load-error");
      });

    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  useEffect(() => {
    if (!hydratedRef.current || status !== "ready") return;
    enqueueSave(state);
  }, [enqueueSave, state, status]);

  const clearLocalData = useCallback(async () => {
    const version = ++writeVersionRef.current;
    const clearOperation = writeQueueRef.current
      .catch(() => undefined)
      .then(() => clearAppState());
    writeQueueRef.current = clearOperation;

    try {
      await clearOperation;
      if (version === writeVersionRef.current) {
        setStorageError(null);
        baseDispatch({ type: "reset" });
      }
    } catch (error) {
      const message = errorMessage(error, "無法清除本機資料");
      setStorageError(message);
      throw new Error(message);
    }
  }, []);

  return {
    state,
    dispatch: baseDispatch,
    status,
    storageError,
    retryLoad: () => setLoadAttempt((attempt) => attempt + 1),
    retrySave: () => enqueueSave(latestStateRef.current),
    clearLocalData,
  };
}
