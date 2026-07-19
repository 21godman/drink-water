import { getDailyGoal, localDateKey } from "./appState";
import type { AppState } from "./types";

type HistoryViewProps = { state: AppState };

const compactDate = new Intl.DateTimeFormat("zh-TW", {
  month: "numeric",
  day: "numeric",
});

function buildThirtyDays(state: AppState) {
  const today = new Date();
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setHours(12, 0, 0, 0);
    date.setDate(today.getDate() - (29 - index));
    const key = localDateKey(date);
    return {
      key,
      date,
      total: state.records
        .filter((record) => localDateKey(new Date(record.consumedAt)) === key)
        .reduce((sum, record) => sum + record.amountMl, 0),
    };
  });
}

export default function HistoryView({ state }: HistoryViewProps) {
  const dailyGoal = getDailyGoal(state.profile!);
  const days = buildThirtyDays(state);
  const activeDays = days.filter((day) => day.total > 0);
  const average = activeDays.length
    ? Math.round(activeDays.reduce((sum, day) => sum + day.total, 0) / activeDays.length)
    : 0;
  const completedDays = days.filter((day) => day.total >= dailyGoal).length;
  const maxValue = Math.max(dailyGoal, ...days.map((day) => day.total));
  const chartHeight = 128;

  let streak = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (days[index].total >= dailyGoal) streak += 1;
    else if (days[index].total > 0 || index < days.length - 1) break;
  }

  return (
    <div className="view-shell history-view">
      <header className="app-header">
        <div>
          <p className="overline">Last 30 days</p>
          <h1>喝水趨勢</h1>
        </div>
        {state.demoEnabled ? <span className="demo-badge">示範資料</span> : null}
      </header>

      <section className="history-summary" aria-label="30 天喝水摘要">
        <article><span>日均喝水</span><strong>{average.toLocaleString()} <small>mL</small></strong></article>
        <article><span>達標天數</span><strong>{completedDays} <small>天</small></strong></article>
        <article><span>目前連續</span><strong>{streak} <small>天</small></strong></article>
      </section>

      <section className="chart-card" aria-labelledby="chart-title">
        <div className="section-title-row">
          <div>
            <p className="overline">Overview</p>
            <h2 id="chart-title">每日飲水量</h2>
          </div>
          <span className="goal-legend"><i /> 目標 {dailyGoal.toLocaleString()}</span>
        </div>

        <div className="chart-scroll" role="img" aria-label={`最近 30 天飲水圖表，共 ${completedDays} 天達標`}>
          <svg className="history-chart" viewBox="0 0 660 190" preserveAspectRatio="none">
            <line className="target-line" x1="16" x2="644" y1={150 - (dailyGoal / maxValue) * chartHeight} y2={150 - (dailyGoal / maxValue) * chartHeight} />
            {days.map((day, index) => {
              const barHeight = day.total ? Math.max((day.total / maxValue) * chartHeight, 3) : 2;
              return (
                <g key={day.key}>
                  <rect
                    className={day.total >= dailyGoal ? "chart-bar complete" : "chart-bar"}
                    x={18 + index * 21}
                    y={150 - barHeight}
                    width="12"
                    height={barHeight}
                    rx="6"
                  />
                  {index % 5 === 4 || index === 29 ? (
                    <text x={24 + index * 21} y="177" textAnchor="middle">{compactDate.format(day.date)}</text>
                  ) : null}
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
          {days.slice(-7).reverse().map((day, index) => {
            const ratio = Math.min((day.total / dailyGoal) * 100, 100);
            return (
              <li key={day.key}>
                <div className="day-label"><strong>{index === 0 ? "今天" : compactDate.format(day.date)}</strong><small>{day.total >= dailyGoal ? "已達標" : day.total ? "繼續保持" : "尚無紀錄"}</small></div>
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
