import { NextResponse } from "next/server";
import type {
  FinanceDashboardViewModel,
  FinanceLedgerEntry
} from "@life-os/domain/finance-model";
import { mockFinanceRepository } from "../../../../lib/mock-finance-repository";

type RecordFinanceEntryBody = {
  periodLabel?: string;
  entry?: FinanceLedgerEntry;
};

type RecordFinanceEntryResponse = {
  ok: true;
  dashboard: FinanceDashboardViewModel;
};

export async function POST(request: Request) {
  const body = (await request.json()) as RecordFinanceEntryBody;

  if (!body.periodLabel || !body.entry) {
    return NextResponse.json(
      { error: "Missing periodLabel or entry payload." },
      { status: 400 }
    );
  }

  await mockFinanceRepository.recordFinanceEntry({
    periodLabel: body.periodLabel,
    entry: body.entry
  });

  const dashboard = await mockFinanceRepository.getFinanceDashboard(body.periodLabel);

  return NextResponse.json<RecordFinanceEntryResponse>({ ok: true, dashboard });
}
