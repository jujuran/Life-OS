"use client";

import type {
  FinanceDashboardViewModel,
  FinanceLedgerEntry
} from "@life-os/domain/finance-model";
import { FinanceLedgerWorkbench } from "./finance-ledger-workbench";

type FinanceLedgerPageProps = {
  data: FinanceDashboardViewModel;
  entries: FinanceLedgerEntry[];
};

export function FinanceLedgerPage({ data, entries }: FinanceLedgerPageProps) {
  return (
    <div className="ledger-page">
      <header className="section-block ledger-page__header">
        <div className="ledger-page__intro">
          <p className="eyebrow">财务系统</p>
          <h1 className="ledger-page__title">流水明细</h1>
          <p className="section-subtitle section-subtitle--body">
            查账、改账、删错账都在这里处理。首页更适合总览，这里更适合把账修准。
          </p>
        </div>
        <div className="ledger-page__actions">
          <span className="section-subtitle">{data.periodLabel}</span>
          <a className="ghost-button" href="/finance">
            返回财务首页
          </a>
          <a className="ghost-button" href="/finance#capture">
            新增记录
          </a>
        </div>
      </header>

      <FinanceLedgerWorkbench data={data} entries={entries} mode="page" />
    </div>
  );
}
