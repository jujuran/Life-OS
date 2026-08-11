import Link from "next/link";

const planningItems = [
  "作息与睡眠",
  "运动与恢复",
  "体征记录",
  "长期健康复盘"
];

export default function HealthPage() {
  return (
    <main className="page-shell">
      <section className="home-hero home-hero--current">
        <p className="eyebrow">Health System</p>
        <h1 className="home-hero__title">健康系统</h1>
        <p className="home-hero__body">
          这里会承接你的作息、运动、体征与恢复记录。当前先把入口和结构预留出来，等内容系统稳定后继续往下铺。
        </p>
        <div className="home-hero__actions">
          <Link className="primary-button primary-button--link" href="/">
            返回首页
          </Link>
          <Link className="ghost-button ghost-button--link" href="/content">
            去看内容系统
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
              先明确结构，再接可穿戴设备、Agent 辅助和长期趋势分析。
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
