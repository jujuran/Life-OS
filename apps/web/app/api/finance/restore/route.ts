import { NextResponse } from "next/server";
import type {
  FinanceDashboardViewModel
} from "@life-os/domain/finance-model";
import type { FinanceLedgerBackupSummary } from "@life-os/db/finance-repository";
import { mockFinanceRepository } from "../../../../lib/mock-finance-repository";

type RestoreFinanceLedgerBody = {
  periodLabel?: string;
  ledgerJson?: string;
};

type RestoreFinanceLedgerResponse = {
  ok: true;
  dashboard: FinanceDashboardViewModel;
  backup: FinanceLedgerBackupSummary;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RestoreFinanceLedgerBody;

  if (!body.ledgerJson) {
    return NextResponse.json(
      { error: "Missing ledgerJson payload." },
      { status: 400 }
    );
  }

  const periodLabel = body.periodLabel ?? "2026 / 04 月";

  try {
    JSON.parse(body.ledgerJson);
  } catch {
    return NextResponse.json(
      { error: "Ledger JSON is not valid." },
      { status: 400 }
    );
  }

  const backup = await mockFinanceRepository.createFinanceLedgerBackup(periodLabel);

  try {
    await mockFinanceRepository.restoreFinanceLedger({
      periodLabel,
      ledgerJson: body.ledgerJson
    });
  } catch {
    return NextResponse.json(
      { error: "Restore failed. Please check the exported ledger format." },
      { status: 400 }
    );
  }

  const dashboard = await mockFinanceRepository.getFinanceDashboard(periodLabel);

  return NextResponse.json<RestoreFinanceLedgerResponse>({
    ok: true,
    dashboard,
    backup
  });
}
