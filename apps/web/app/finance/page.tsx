import type { Metadata } from "next";
import {
  type CaptureDirection,
  type CaptureMode
} from "@life-os/domain/finance-model";
import { FinanceDashboardLive } from "../../components/finance/finance-dashboard-live";
import { mockFinanceRepository } from "../../lib/mock-finance-repository";

export const metadata: Metadata = {
  title: "财务系统"
};

type FinancePageProps = {
  searchParams?: Promise<{
    direction?: string;
    mode?: string;
    panel?: string;
  }>;
};

function getCaptureDirection(value?: string): CaptureDirection {
  if (value === "income" || value === "transfer") {
    return value;
  }

  return "expense";
}

function getCaptureMode(value?: string): CaptureMode {
  if (value === "natural") {
    return value;
  }

  return "quick";
}

function getInitialPanel(value?: string) {
  if (value === "settings" || value === "actions" || value === "records") {
    return value;
  }

  return undefined;
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const periodLabel = "2026 / 04 月";
  const [financeDashboardData, entries] = await Promise.all([
    mockFinanceRepository.getFinanceDashboard(periodLabel),
    mockFinanceRepository.listFinanceEntries(periodLabel)
  ]);

  return (
    <main className="page-shell">
      <FinanceDashboardLive
        data={financeDashboardData}
        entries={entries}
        initialDirection={getCaptureDirection(params?.direction)}
        initialMode={getCaptureMode(params?.mode)}
        initialPanel={getInitialPanel(params?.panel)}
      />
    </main>
  );
}
