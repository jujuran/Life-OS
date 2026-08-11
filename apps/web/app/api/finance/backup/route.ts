import { NextResponse } from "next/server";
import type { FinanceLedgerBackupSummary } from "@life-os/db/finance-repository";
import { mockFinanceRepository } from "../../../../lib/mock-finance-repository";

type CreateBackupBody = {
  periodLabel?: string;
};

type CreateBackupResponse = {
  ok: true;
  backup: FinanceLedgerBackupSummary;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CreateBackupBody;
  const periodLabel = body.periodLabel ?? "2026 / 04 月";
  const backup = await mockFinanceRepository.createFinanceLedgerBackup(periodLabel);

  return NextResponse.json<CreateBackupResponse>({ ok: true, backup });
}
