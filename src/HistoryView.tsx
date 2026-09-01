import { useMemo } from "react";
import { getDailyGoal, localDateKey } from "./appState";
import { useI18n } from "./i18n";
import type { AppState } from "./types";

type HistoryViewProps = { state: AppState };

function buildSevenDays(state: AppState) {
  const today = new Date();
  const currentGoal = getDailyGoal(state.profile!);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setHours(12, 0, 0, 0);
    date.setDate(today.getDate() - (6 - index));
    const key = localDateKey(date);
    const records = state.records
      .filter((record) => localDateKey(new Date(record.consumedAt)) === key)
      .sort(
        (first, second) =>
          new Date(first.consumedAt).getTime() -
          new Date(second.consumedAt).getTime(),
      );

    return {
      key,
      date,
      total: records.reduce((sum, record) => sum + record.amountMl, 0),
      goal: records[0]?.goalMlAtTime ?? currentGoal,
    };
  });
}

export default function HistoryView({ state }: HistoryViewProps) {
  const { locale, t } = useI18n();
  const compactDate = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric" }),
    [locale],
  );
  const dailyGoal = getDailyGoal(state.profile!);
  const days = buildSevenDays(state);
  const activeDays = days.filter((day) => day.total > 0);
  const average = Math.round(
    days.reduce((sum, day) => sum + day.total, 0) / days.length,
  );
  const completedDays = days.filter((day) => day.total >= day.goal).length;
  const maxValue = Math.max(
    dailyGoal,
    ...days.map((day) => Math.max(day.total, day.goal)),
  );
  const chartHeight = 128;

  let streak = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (days[index].total >= days[index].goal) streak += 1;
    else if (days[index].total > 0 || index < days.length - 1) break;
  }

  return (
    <div className="view-shell history-view">
      <header className="app-header">
        <div>
          <p className="overline">{t("history.eyebrow")}</p>
          <h1>{t("history.heading")}</h1>
        </div>
      </header>

      <section className="history-summary" aria-label={t("history.summaryAria")}>
        <article><span>{t("history.average")}</span><strong>{average.toLocaleString(locale)} <small>mL</small></strong></article>
        <article><span>{t("history.completedDays")}</span><strong>{completedDays} <small>{t("history.daysUnit")}</small></strong></article>
        <article><span>{t("history.currentStreak")}</span><strong>{streak} <small>{t("history.daysUnit")}</small></strong></article>
      </section>

      <section className="chart-card" aria-labelledby="chart-title">
        <div className="section-title-row">
          <div>
            <p className="overline">{t("history.overview")}</p>
            <h2 id="chart-title">{t("history.dailyAmount")}</h2>
          </div>
          <span className="goal-legend"><i /> {t("history.goalLegend", { amount: dailyGoal.toLocaleString(locale) })}</span>
        </div>

        <div className="chart-scroll" role="img" aria-label={t("history.chartAria", { count: completedDays })}>
          <svg className="history-chart seven-day-chart" viewBox="0 0 560 190" preserveAspectRatio="none">
            <line className="target-line" x1="24" x2="536" y1={150 - (dailyGoal / maxValue) * chartHeight} y2={150 - (dailyGoal / maxValue) * chartHeight} />
            {days.map((day, index) => {
              const barHeight = day.total ? Math.max((day.total / maxValue) * chartHeight, 3) : 2;
              return (
                <g key={day.key}>
                  <rect
                    className={day.total >= day.goal ? "chart-bar complete" : "chart-bar"}
                    x={42 + index * 72}
                    y={150 - barHeight}
                    width="30"
                    height={barHeight}
                    rx="10"
                  />
                  <text x={57 + index * 72} y="177" textAnchor="middle">
                    {index === 6 ? t("common.today") : compactDate.format(day.date)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      <section className="content-section recent-days" aria-labelledby="recent-days-title">
        <div className="section-title-row">
          <div><p className="overline">{t("history.details")}</p><h2 id="recent-days-title">{t("history.recentDays")}</h2></div>
        </div>
        <ul className="day-list">
          {days.slice().reverse().map((day, index) => {
            const ratio = Math.min((day.total / day.goal) * 100, 100);
            return (
              <li key={day.key}>
                <div className="day-label"><strong>{index === 0 ? t("common.today") : compactDate.format(day.date)}</strong><small>{day.total >= day.goal ? t("history.completed") : day.total ? t("history.keepGoing") : t("history.noRecord")}</small></div>
                <div className="day-progress"><i style={{ width: `${ratio}%` }} /></div>
                <strong className="day-total">{day.total.toLocaleString(locale)} <small>mL</small></strong>
              </li>
            );
          })}
        </ul>
        {!activeDays.length ? (
          <p className="inline-empty">{t("history.empty")}</p>
        ) : null}
      </section>
    </div>
  );
}
