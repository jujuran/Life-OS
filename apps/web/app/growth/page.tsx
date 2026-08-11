import Link from "next/link";

const planningItems = [
  "学习与输入",
  "项目推进",
  "周月复盘",
  "长期目标"
];

export default function GrowthPage() {
  return (
    <main className="page-shell">
      <section className="home-hero home-hero--current">
        <p className="eyebrow">Growth System</p>
        <h1 className="home-hero__title">成长系统</h1>
        <p className="home-hero__body">
          这里会慢慢接起学习、复盘、项目推进和长期目标。当前先保留统一入口，等内容系统与健康系统走稳后继续展开。
        </p>
        <div className="home-hero__actions">
          <Link className="primary-button primary-button--link" href="/">
            返回首页
          </Link>
          <Link className="ghost-button ghost-button--link" href="/finance">
            去看财务系统
          </Link>
        </div>
      </section>

      <section className="home-grid home-grid--current">
        {planningItems.map((item) => (
          <article key={item} className="home-card">
            <div className="home-card__header">
              <h2 className="section-title">{item}</h2>
              <span className="tag">规划中</span>
            </div>
            <p className="section-subtitle section-subtitle--body">
              先把信息结构和入口统一起来，后面再接项目节奏、复盘模版和 Agent 辅助。
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
