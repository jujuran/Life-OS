import type { FinanceDashboardViewModel as FinanceDashboardData } from "@life-os/domain/finance-model";

type FinanceDashboardProps = {
  data: FinanceDashboardData;
};

function getCashFlowBars(
  points: FinanceDashboardData["cashFlow"],
  width = 620,
  height = 176
) {
  const baselineY = Math.round(height / 2);
  const maxIncome = Math.max(...points.map((point) => point.income));
  const maxExpense = Math.max(...points.map((point) => point.expense));
  const step = width / points.length;
  const barWidth = Math.max(18, Math.round(step * 0.36));
  const balanceMax = Math.max(...points.map((point) => Math.abs(point.balance)));

  const bars = points.map((point, index) => {
    const groupCenter = step * index + step / 2;
    const x = Math.round(groupCenter - barWidth / 2);
    const incomeHeight = Math.max(8, Math.round((point.income / maxIncome) * 70));
    const expenseHeight = Math.max(8, Math.round((point.expense / maxExpense) * 56));

    return {
      ...point,
      x,
      incomeHeight,
      expenseHeight,
      incomeY: baselineY - incomeHeight,
      expenseY: baselineY
    };
  });

  const balancePath = points
    .map((point, index) => {
      const groupCenter = step * index + step / 2;
      const y = baselineY - (point.balance / balanceMax) * 34;
      return `${index === 0 ? "M" : "L"} ${groupCenter.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return {
    bars,
    baselineY,
    balancePath,
    width,
    height
  };
}

function getBudgetWidth(ratio: number) {
  return `${Math.min(Math.max(ratio, 0), 1) * 100}%`;
}

function getRankWidth(ratio: number) {
  return `${Math.min(Math.max(ratio, 0), 1) * 100}%`;
}

export function FinanceDashboard({ data }: FinanceDashboardProps) {
  const chart = getCashFlowBars(data.cashFlow);

  return (
    <div className="finance-shell">
      <header className="finance-header">
        <div className="finance-header__context">
          <span className="eyebrow">财务系统</span>
          <button className="period-button" type="button">
            {data.periodLabel}
          </button>
        </div>
        <button className="ghost-button" type="button">
          设置
        </button>
      </header>

      <section className="capture-card">
        <div className="capture-card__header">
          <div>
            <h1 className="section-title">快速记录</h1>
            <p className="section-subtitle">
              结构化优先，自然语言辅助，后续再接入真实保存逻辑。
            </p>
          </div>
          <div className="pill-row" aria-label="capture mode">
            <button className="pill pill--active" type="button">
              快捷录入
            </button>
            <button className="pill" type="button">
              自然语言辅助
            </button>
          </div>
        </div>

        <div className="capture-card__body">
          <div className="pill-row" aria-label="capture direction">
            {data.capture.directions.map((item, index) => (
              <button
                key={item.value}
                className={`pill ${index === 0 ? "pill--active" : ""}`}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="capture-grid">
            <label className="field">
              <span className="field__label">金额</span>
              <input className="field__input" defaultValue="" placeholder="例如 45" />
            </label>
            <label className="field">
              <span className="field__label">分类</span>
              <select className="field__input" defaultValue={data.capture.categories.expense[0]}>
                {data.capture.categories.expense.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">支付渠道</span>
              <select className="field__input" defaultValue={data.capture.registries.expense[0]}>
                {data.capture.registries.expense.map((registry) => (
                  <option key={registry} value={registry}>
                    {registry}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">转入账户</span>
              <select className="field__input" defaultValue={data.capture.registries.transfer[1]}>
                {data.capture.registries.transfer.map((registry) => (
                  <option key={registry} value={registry}>
                    {registry}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">备注</span>
              <input className="field__input" defaultValue="" placeholder="例如 打车 / 工资 / 还款" />
            </label>
            <div className="field field--action">
              <span className="field__label">保存</span>
              <button className="primary-button" type="button">
                记录这笔交易
              </button>
            </div>
          </div>

          <div className="capture-meta">
            <p className="hint-text">
              自然语言示例：{data.capture.assistantExamples.join(" / ")}
            </p>
            <p className="hint-text">
              当前是 MVP 骨架，交互和真实写入会在下一步接上。
            </p>
          </div>
        </div>
      </section>

      <section className="overview-grid">
        {data.overview.map((item) => (
          <article key={item.id} className="metric-card">
            <span className="metric-card__label">{item.label}</span>
            <strong
              className={`metric-card__value ${item.hero ? "metric-card__value--hero" : ""}`}
            >
              {item.value}
            </strong>
            <span className="metric-card__note">{item.note}</span>
          </article>
        ))}
      </section>

      <section className="finance-columns">
        <div className="finance-column">
          <section className="section-block">
            <div className="section-heading">
              <div>
                <h2 className="section-title">资金账户</h2>
                <p className="section-subtitle">你真正持有的余额与储蓄</p>
              </div>
            </div>
            <div className="list-block">
              {data.fundAccounts.map((account) => (
                <article key={account.id} className="list-row list-row--two">
                  <div className="list-row__main">
                    <div className="list-row__line">
                      <span>{account.name}</span>
                      <span className="tag">{account.tag}</span>
                    </div>
                    <span className="list-row__description">{account.description}</span>
                  </div>
                  <span className="money-text">{account.balance}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <h2 className="section-title">现金流趋势</h2>
                <p className="section-subtitle">收入向上，支出向下，转账不计入</p>
              </div>
            </div>
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-swatch" />
                收入
              </span>
              <span className="legend-item">
                <span className="legend-swatch legend-swatch--soft" />
                支出
              </span>
              <span className="legend-item">
                <span className="legend-line" />
                结余
              </span>
            </div>
            <svg
              className="cashflow-chart"
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              preserveAspectRatio="none"
              aria-label="现金流趋势图"
            >
              <line
                className="cashflow-chart__baseline"
                x1="0"
                y1={chart.baselineY}
                x2={chart.width}
                y2={chart.baselineY}
              />
              {chart.bars.map((bar) => (
                <g key={bar.id}>
                  <rect
                    className="cashflow-chart__bar cashflow-chart__bar--income"
                    x={bar.x}
                    y={bar.incomeY}
                    width="20"
                    height={bar.incomeHeight}
                    rx="4"
                  />
                  <rect
                    className="cashflow-chart__bar cashflow-chart__bar--expense"
                    x={bar.x}
                    y={bar.expenseY}
                    width="20"
                    height={bar.expenseHeight}
                    rx="4"
                  />
                  <text className="cashflow-chart__label" x={bar.x + 10} y={chart.height - 10}>
                    {bar.label}
                  </text>
                </g>
              ))}
              <path className="cashflow-chart__line" d={chart.balancePath} />
            </svg>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <h2 className="section-title">净资产快照</h2>
                <p className="section-subtitle">看长期变化，不和现金流混在一起</p>
              </div>
            </div>
            <div className="snapshot-grid">
              {data.netAssetSnapshots.map((snapshot) => (
                <article key={snapshot.id} className="snapshot-card">
                  <span className="snapshot-card__label">{snapshot.label}</span>
                  <strong className="snapshot-card__value">{snapshot.value}</strong>
                  <span className="snapshot-card__delta">{snapshot.delta}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <h2 className="section-title">最近流水</h2>
                <p className="section-subtitle">收入、支出、转账都在这一屏里</p>
              </div>
            </div>
            <div className="list-block">
              {data.recentFlows.map((flow) => (
                <article key={flow.id} className="list-row list-row--transaction">
                  <span className="list-row__date">{flow.date}</span>
                  <div className="list-row__main">
                    <div className="list-row__line">
                      <span>{flow.label}</span>
                    </div>
                    <span className="list-row__description">{flow.description}</span>
                  </div>
                  <span
                    className={`money-text ${
                      flow.direction === "transfer" ? "money-text--muted" : ""
                    }`}
                  >
                    {flow.amount}
                  </span>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="finance-column">
          <section className="section-block">
            <div className="section-heading">
              <div>
                <h2 className="section-title">预算进度</h2>
                <p className="section-subtitle">本月生活预算</p>
              </div>
            </div>
            <div className="split-line">
              <span className="section-subtitle">已用 / 总额</span>
              <span className="mono-text">
                ¥{data.budget.used.toLocaleString("zh-CN")} / ¥
                {data.budget.total.toLocaleString("zh-CN")}
              </span>
            </div>
            <div className="progress-track" aria-hidden="true">
              <span className="progress-fill" style={{ width: getBudgetWidth(data.budget.ratio) }} />
            </div>
            <span className="section-subtitle">{data.budget.label}</span>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <h2 className="section-title">信用卡与负债</h2>
                <p className="section-subtitle">先看该还的钱</p>
              </div>
            </div>
            <div className="split-line split-line--end">
              <div>
                <span className="section-subtitle">总负债</span>
                <strong className="hero-inline hero-inline--alert">{data.liabilities.total}</strong>
              </div>
              <span className="section-subtitle">本月待还 {data.liabilities.dueThisMonth}</span>
            </div>
            <div className="list-block">
              {data.liabilities.items.map((item) => (
                <article key={item.id} className="list-row list-row--two">
                  <div className="list-row__main">
                    <div className="list-row__line">
                      <span>{item.name}</span>
                      <span className="tag">{item.tag}</span>
                    </div>
                    <span className="list-row__description">{item.description}</span>
                  </div>
                  <span className={`money-text ${item.alert ? "money-text--alert" : ""}`}>
                    {item.dueAmount}
                  </span>
                </article>
              ))}
            </div>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <h2 className="section-title">待处理事项</h2>
                <p className="section-subtitle">本周别漏掉的动作</p>
              </div>
            </div>
            <div className="list-block">
              {data.actionItems.map((item) => (
                <article key={item.id} className="list-row list-row--two">
                  <div className="list-row__main">
                    <div className="list-row__line">
                      <span>{item.label}</span>
                      <span className="tag">{item.tag}</span>
                    </div>
                    <span className="list-row__description">{item.description}</span>
                  </div>
                  <span className="mono-text mono-text--subtle">{item.dueDate}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <h2 className="section-title">收入来源</h2>
                <p className="section-subtitle">钱从哪里进来</p>
              </div>
            </div>
            <div className="rank-list">
              {data.incomeSources.map((item, index) => (
                <div key={item.id} className="rank-row">
                  <span className="rank-row__index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="rank-row__main">
                    <div className="rank-row__top">
                      <span>{item.name}</span>
                      <span className="mono-text">{item.amount}</span>
                    </div>
                    <div className="progress-track progress-track--thin" aria-hidden="true">
                      <span className="progress-fill" style={{ width: getRankWidth(item.ratio) }} />
                    </div>
                  </div>
                  <span className="mono-text mono-text--subtle">
                    {(item.ratio * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <h2 className="section-title">理财概览</h2>
                <p className="section-subtitle">稳健 + 长期</p>
              </div>
            </div>
            <div className="split-line split-line--end">
              <div>
                <span className="section-subtitle">理财总额</span>
                <strong className="hero-inline">{data.investments.total}</strong>
              </div>
              <span className="section-subtitle">浮动收益 {data.investments.pnl}</span>
            </div>
            <div className="list-block">
              {data.investments.items.map((item) => (
                <article key={item.id} className="list-row list-row--two">
                  <div className="list-row__main">
                    <div className="list-row__line">
                      <span>{item.name}</span>
                      <span className="tag">{item.tag}</span>
                    </div>
                    <span className="list-row__description">{item.description}</span>
                  </div>
                  <span className="money-text">{item.amount}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <h2 className="section-title">支出分类</h2>
                <p className="section-subtitle">钱主要花在哪里</p>
              </div>
            </div>
            <div className="rank-list">
              {data.categories.map((item, index) => (
                <div key={item.id} className="rank-row">
                  <span className="rank-row__index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="rank-row__main">
                    <div className="rank-row__top">
                      <span>{item.name}</span>
                      <span className="mono-text">{item.amount}</span>
                    </div>
                    <div className="progress-track progress-track--thin" aria-hidden="true">
                      <span className="progress-fill" style={{ width: getRankWidth(item.ratio) }} />
                    </div>
                  </div>
                  <span className="mono-text mono-text--subtle">
                    {(item.ratio * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <h2 className="section-title">支付渠道</h2>
                <p className="section-subtitle">钱主要从哪里流出</p>
              </div>
            </div>
            <div className="rank-list">
              {data.paymentChannels.map((item, index) => (
                <div key={item.id} className="rank-row">
                  <span className="rank-row__index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="rank-row__main">
                    <div className="rank-row__top">
                      <span>{item.name}</span>
                      <span className="mono-text">{item.amount}</span>
                    </div>
                    <div className="progress-track progress-track--thin" aria-hidden="true">
                      <span className="progress-fill" style={{ width: getRankWidth(item.ratio) }} />
                    </div>
                  </div>
                  <span className="mono-text mono-text--subtle">
                    {(item.ratio * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
