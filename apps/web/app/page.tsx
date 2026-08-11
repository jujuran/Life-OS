import Link from "next/link";

const systems = [
  {
    title: "财务系统",
    eyebrow: "FINANCE",
    description: "记账、账户、负债、理财与现金流。",
    href: "/finance",
    status: "已启用",
    action: "进入财务",
    signal: "本月结余已同步",
    meta: "现金流 / 资产 / 流水"
  },
  {
    title: "内容系统",
    eyebrow: "CONTENT",
    description: "项目、写作 SOP、AI 初稿与审稿动作。",
    href: "/content",
    status: "建设中",
    action: "进入内容",
    signal: "Phase 1 可演练",
    meta: "SOP / 任务 / 成稿"
  },
  {
    title: "AI 模块",
    eyebrow: "AI CORE",
    description: "统一管理模型、API Key、基础地址与可切换模型列表。",
    href: "/ai",
    status: "已接入",
    action: "进入 AI",
    signal: "系统级 AI 配置",
    meta: "模型 / Key / 路由"
  },
  {
    title: "健康系统",
    eyebrow: "HEALTH",
    description: "作息、运动、体征与恢复记录。",
    href: "/health",
    status: "规划中",
    action: "查看方向",
    signal: "等待建模",
    meta: "睡眠 / 运动 / 恢复"
  },
  {
    title: "工具台",
    eyebrow: "TOOLS",
    description: "番茄钟、文字处理、图片入口与日常小工具。",
    href: "/tools",
    status: "建设中",
    action: "进入工具",
    signal: "框架已接入",
    meta: "本地 / 站内 / 工具库"
  }
];

const systemPulse = [
  {
    label: "当前稳定",
    value: "财务系统",
    detail: "第一块真实可用模块"
  },
  {
    label: "正在建设",
    value: "内容系统",
    detail: "AI + SOP 创作台"
  },
  {
    label: "下一步",
    value: "AI Core",
    detail: "统一接入模型与外部 Agent"
  }
];

export default function HomePage() {
  return (
    <main className="page-shell page-shell--home">
      <section className="home-console" aria-label="system overview">
        <div className="home-console__main">
          <p className="eyebrow">LIFE OS / SYSTEM HUB</p>
          <h1 className="home-console__title">人生系统</h1>
          <p className="home-console__body">
            一个给自己长期使用的私有人生系统。先把财务、内容与工具台做稳，再逐步接入健康和统一 AI 中枢。
          </p>
          <div className="home-console__actions">
            <Link className="primary-button primary-button--link" href="/finance">
              打开财务
            </Link>
            <Link className="ghost-button ghost-button--link" href="/content">
              打开内容
            </Link>
          </div>
        </div>

        <aside className="home-focus-panel" aria-label="current focus">
          <div className="home-focus-panel__header">
            <p className="eyebrow">NOW</p>
            <span className="tag">本地优先</span>
          </div>
          <strong className="home-focus-panel__title">先完成可长期使用的核心模块</strong>
          <div className="home-focus-panel__list">
            {systemPulse.map((item) => (
              <div key={item.label} className="home-focus-row">
                <span className="section-subtitle">{item.label}</span>
                <strong>{item.value}</strong>
                <span className="section-subtitle">{item.detail}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="home-system-section" id="systems">
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">SYSTEMS</p>
            <h2 className="section-title">系统入口</h2>
          </div>
          <span className="section-subtitle">统一入口，分模块推进。</span>
        </div>

        <div className="home-system-grid">
          {systems.map((system) => (
            <article key={system.title} className="home-system-card">
              <div className="home-system-card__top">
                <span className="eyebrow">{system.eyebrow}</span>
                <span className="tag">{system.status}</span>
              </div>
              <div className="home-system-card__body">
                <h3 className="section-title">{system.title}</h3>
                <p className="section-subtitle section-subtitle--body">{system.description}</p>
              </div>
              <div className="home-system-card__signal">
                <span className="section-subtitle">{system.signal}</span>
                <span className="mono-text mono-text--subtle">{system.meta}</span>
              </div>
              <Link className="ghost-button ghost-button--link" href={system.href}>
                {system.action}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="home-roadmap" aria-label="system roadmap">
        <article className="home-roadmap__item">
          <span className="section-subtitle">01</span>
          <strong>数据先稳</strong>
          <p className="section-subtitle section-subtitle--body">
            财务、内容先以本地数据跑通，保证你自己能长期用。
          </p>
        </article>
        <article className="home-roadmap__item">
          <span className="section-subtitle">02</span>
          <strong>AI 再接入</strong>
          <p className="section-subtitle section-subtitle--body">
            统一 AI Core 后，各模块通过同一层能力调用模型。
          </p>
        </article>
        <article className="home-roadmap__item">
          <span className="section-subtitle">03</span>
          <strong>Agent 连接层</strong>
          <p className="section-subtitle section-subtitle--body">
            让可替换的外部 Agent 成为人生系统的长期执行与理解入口。
          </p>
        </article>
      </section>

      <section className="home-grid home-grid--legacy" id="legacy-systems" aria-hidden="true">
        {systems.map((system) => (
          <article key={`legacy-${system.title}`} className="home-card">
            <div className="home-card__header">
              <h2 className="section-title">{system.title}</h2>
              <span className="tag">{system.status}</span>
            </div>
            <p className="section-subtitle section-subtitle--body">{system.description}</p>
            <div className="home-card__footer">
              <Link className="ghost-button ghost-button--link" href={system.href}>
                {system.action}
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
