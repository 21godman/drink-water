import { getDailyGoal, localDateKey } from "./appState";
import type { AppState } from "./types";

type HistoryViewProps = { state: AppState };

const compactDate = new Intl.DateTimeFormat("zh-TW", {
  month: "numeric",
  day: "numeric",
});

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
          <p className="overline">Last 7 days</p>
          <h1>喝水趨勢</h1>
        </div>
        {state.demoEnabled ? <span className="demo-badge">示範資料</span> : null}
      </header>

      <section className="history-summary" aria-label="7 天喝水摘要">
        <article><span>七日日均</span><strong>{average.toLocaleString()} <small>mL</small></strong></article>
        <article><span>達標天數</span><strong>{completedDays} <small>天</small></strong></article>
        <article><span>目前連續</span><strong>{streak} <small>天</small></strong></article>
      </section>

      <section className="chart-card" aria-labelledby="chart-title">
        <div className="section-title-row">
          <div>
            <p className="overline">Overview</p>
            <h2 id="chart-title">每日飲水量</h2>
          </div>
          <span className="goal-legend"><i /> 今日目標 {dailyGoal.toLocaleString()}</span>
        </div>

        <div className="chart-scroll" role="img" aria-label={`最近 7 天飲水圖表，共 ${completedDays} 天達標`}>
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
                    {index === 6 ? "今天" : compactDate.format(day.date)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      <section className="content-section recent-days" aria-labelledby="recent-days-title">
        <div className="section-title-row">
          <div><p className="overline">Daily details</p><h2 id="recent-days-title">最近七天</h2></div>
        </div>
        <ul className="day-list">
          {days.slice().reverse().map((day, index) => {
            const ratio = Math.min((day.total / day.goal) * 100, 100);
            return (
              <li key={day.key}>
                <div className="day-label"><strong>{index === 0 ? "今天" : compactDate.format(day.date)}</strong><small>{day.total >= day.goal ? "已達標" : day.total ? "繼續保持" : "尚無紀錄"}</small></div>
                <div className="day-progress"><i style={{ width: `${ratio}%` }} /></div>
                <strong className="day-total">{day.total.toLocaleString()} <small>mL</small></strong>
              </li>
            );
          })}
        </ul>
        {!activeDays.length ? (
          <p className="inline-empty">目前沒有歷史資料，可到設定開啟示範資料預覽完整圖表。</p>
        ) : null}
      </section>
    </div>
  );
}
