import type { Metadata } from "next";
import { FinanceSettingsPage } from "../../../components/finance/finance-settings-page";
import { mockFinanceRepository } from "../../../lib/mock-finance-repository";

export const metadata: Metadata = {
  title: "账户设置 | 财务系统"
};

export const dynamic = "force-dynamic";

export default async function FinanceSettingsRoute() {
  const financeDashboardData = await mockFinanceRepository.getFinanceDashboard(
    "2026 / 04 月"
  );

  return (
    <main className="page-shell">
      <FinanceSettingsPage data={financeDashboardData} />
    </main>
  );
}
