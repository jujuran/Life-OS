import type { Metadata } from "next";
import { FinanceLedgerPage } from "../../../components/finance/finance-ledger-page";
import { mockFinanceRepository } from "../../../lib/mock-finance-repository";

export const metadata: Metadata = {
  title: "流水明细 | 财务系统"
};

export const dynamic = "force-dynamic";

export default async function FinanceRecordsRoute() {
  const periodLabel = "2026 / 04 月";
  const [financeDashboardData, entries] = await Promise.all([
    mockFinanceRepository.getFinanceDashboard(periodLabel),
    mockFinanceRepository.listFinanceEntries(periodLabel)
  ]);

  return (
    <main className="page-shell">
      <FinanceLedgerPage data={financeDashboardData} entries={entries} />
    </main>
  );
}
