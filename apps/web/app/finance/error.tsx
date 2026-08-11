"use client";

type FinanceErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function FinanceError({ error, reset }: FinanceErrorProps) {
  return (
    <main className="page-shell">
      <div className="state-card">
        <p className="eyebrow">Error</p>
        <h1 className="section-title">财务首页暂时没能正常渲染</h1>
        <p className="section-subtitle section-subtitle--body">
          {error.message || "请稍后重试，或继续完善这页的容错和数据状态。"}
        </p>
        <button className="primary-button" type="button" onClick={reset}>
          重新加载
        </button>
      </div>
    </main>
  );
}
