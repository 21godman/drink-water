import { useMemo, useState, type Dispatch, type FormEvent } from "react";
import {
  createId,
  getRetentionBounds,
  getDailyGoal,
  isSameLocalDay,
  toDateTimeLocal,
} from "./appState";
import { useI18n } from "./i18n";
import type { AppAction, AppState, DrinkRecord } from "./types";

type TodayViewProps = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

function RecordDialog({
  record,
  onClose,
  dispatch,
}: {
  record: DrinkRecord;
  onClose: () => void;
  dispatch: Dispatch<AppAction>;
}) {
  const { t } = useI18n();
  const [amount, setAmount] = useState(String(record.amountMl));
  const [consumedAt, setConsumedAt] = useState(toDateTimeLocal(record.consumedAt));
  const [error, setError] = useState("");
  const retentionBounds = getRetentionBounds();
  const minDateTime = toDateTimeLocal(retentionBounds.earliest.toISOString());
  const maxDateTime = toDateTimeLocal(retentionBounds.latest.toISOString());

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    const parsedDate = new Date(consumedAt);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || Number.isNaN(parsedDate.getTime())) {
      setError(t("today.invalidRecord"));
      return;
    }
    if (
      parsedDate.getTime() < retentionBounds.earliest.getTime() ||
      parsedDate.getTime() > retentionBounds.latest.getTime()
    ) {
      setError(t("today.invalidTime"));
      return;
    }

    dispatch({
      type: "updateRecord",
      record: {
        ...record,
        amountMl: parsedAmount,
        consumedAt: parsedDate.toISOString(),
      },
    });
    onClose();
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="record-dialog-title">
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-heading">
          <div>
            <p className="overline">{t("today.editEyebrow")}</p>
            <h2 id="record-dialog-title">{record.containerName}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t("today.closeEdit")}>×</button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span>{t("today.amount")}</span>
            <span className="input-with-unit">
              <input min="1" inputMode="numeric" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
              <small>mL</small>
            </span>
          </label>
          <label className="field">
            <span>{t("today.time")}</span>
            <input min={minDateTime} max={maxDateTime} type="datetime-local" value={consumedAt} onChange={(event) => setConsumedAt(event.target.value)} />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="dialog-actions">
            <button
              className="danger-button"
              type="button"
              onClick={() => {
                dispatch({ type: "deleteRecord", id: record.id });
                onClose();
              }}
            >
              {t("today.deleteRecord")}
            </button>
            <button className="primary-button" type="submit">{t("common.saveChanges")}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function TodayView({ state, dispatch }: TodayViewProps) {
  const { locale, t } = useI18n();
  const [selectedRecord, setSelectedRecord] = useState<DrinkRecord | null>(null);
  const now = new Date();
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, {
      month: "long",
      day: "numeric",
      weekday: "long",
    }),
    [locale],
  );
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    [locale],
  );
  const dailyGoal = getDailyGoal(state.profile!);
  const todayRecords = useMemo(
    () =>
      state.records
        .filter((record) => isSameLocalDay(record.consumedAt, now))
        .sort(
          (first, second) =>
            new Date(second.consumedAt).getTime() -
            new Date(first.consumedAt).getTime(),
        ),
    [state.records],
  );
  const total = todayRecords.reduce((sum, record) => sum + record.amountMl, 0);
  const percentage = Math.round((total / dailyGoal) * 100);
  const cappedPercentage = Math.min(percentage, 100);
  const remaining = Math.max(dailyGoal - total, 0);
  const circumference = 2 * Math.PI * 82;

  return (
    <div className="view-shell today-view">
      <header className="app-header">
        <div>
          <p className="overline">{dateFormatter.format(now)}</p>
          <h1>{t("today.heading")}</h1>
        </div>
        <span className="mini-drop" aria-hidden="true">水</span>
      </header>

      <section className="progress-card" aria-label={t("today.progressAria", { total, goal: dailyGoal })}>
        <div className="progress-copy">
          <span className="progress-status">{percentage >= 100 ? t("today.goalComplete") : t("today.progress")}</span>
          <strong>{total.toLocaleString(locale)}<small> mL</small></strong>
          <p>
            {remaining > 0
              ? t("today.remaining", { amount: remaining.toLocaleString(locale) })
              : t("today.exceeded", { amount: (total - dailyGoal).toLocaleString(locale) })}
          </p>
        </div>
        <div className="water-gauge" aria-hidden="true">
          <svg viewBox="0 0 200 200">
            <circle className="gauge-track" cx="100" cy="100" r="82" />
            <circle
              className="gauge-value"
              cx="100"
              cy="100"
              r="82"
              pathLength={circumference}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - cappedPercentage / 100)}
            />
          </svg>
          <div><strong>{percentage}%</strong><span>{t("today.goal", { amount: dailyGoal.toLocaleString(locale) })}</span></div>
        </div>
      </section>

      <section className="content-section" aria-labelledby="quick-add-title">
        <div className="section-title-row">
          <div>
            <p className="overline">{t("today.quickEyebrow")}</p>
            <h2 id="quick-add-title">{t("today.quickTitle")}</h2>
          </div>
          <span className="section-note">{t("today.quickHint")}</span>
        </div>
        <div className="container-grid">
          {state.containers.map((container, index) => (
            <button
              aria-label={t("today.addAria", { name: container.name, amount: container.volumeMl })}
              className="container-button"
              key={container.id}
              onClick={() =>
                dispatch({
                  type: "addRecord",
                  record: {
                    id: createId("record"),
                    amountMl: container.volumeMl,
                    consumedAt: new Date().toISOString(),
                    containerId: container.id,
                    containerName: container.name,
                    isDemo: false,
                    goalMlAtTime: dailyGoal,
                  },
                })
              }
              type="button"
            >
              <span className={`vessel vessel-${(index % 3) + 1}`} aria-hidden="true"><i /></span>
              <span><strong>{container.name}</strong><small>{container.volumeMl.toLocaleString(locale)} mL</small></span>
              <b aria-hidden="true">＋</b>
            </button>
          ))}
        </div>
      </section>

      <section className="content-section records-section" aria-labelledby="today-records-title">
        <div className="section-title-row">
          <div>
            <p className="overline">{t("today.timelineEyebrow")}</p>
            <h2 id="today-records-title">{t("today.recordsTitle")}</h2>
          </div>
          <span className="record-count">{t("today.recordCount", { count: todayRecords.length })}</span>
        </div>

        {todayRecords.length ? (
          <ul className="record-list">
            {todayRecords.map((record) => (
              <li key={record.id}>
                <button type="button" onClick={() => setSelectedRecord(record)} aria-label={t("today.editAria", { name: record.containerName, amount: record.amountMl })}>
                  <span className="record-icon" aria-hidden="true">●</span>
                  <span className="record-main"><strong>{record.containerName}</strong><small>{timeFormatter.format(new Date(record.consumedAt))}</small></span>
                  <strong className="record-amount">{record.amountMl.toLocaleString(locale)} <small>mL</small></strong>
                  <span className="chevron" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <span aria-hidden="true">◌</span>
            <h3>{t("today.emptyTitle")}</h3>
            <p>{t("today.emptyBody")}</p>
          </div>
        )}
      </section>

      {selectedRecord ? (
        <RecordDialog record={selectedRecord} dispatch={dispatch} onClose={() => setSelectedRecord(null)} />
      ) : null}
    </div>
  );
}
