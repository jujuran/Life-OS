import { NextResponse } from "next/server";
import type {
  FinanceDashboardViewModel,
  FinanceLedgerEntry
} from "@life-os/domain/finance-model";
import { mockFinanceRepository } from "../../../../../lib/mock-finance-repository";

type EntryMutationBody = {
  periodLabel?: string;
  entry?: FinanceLedgerEntry;
};

type EntryMutationResponse = {
  ok: true;
  dashboard: FinanceDashboardViewModel;
};

type RouteContext = {
  params: Promise<{
    entryId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const body = (await request.json()) as EntryMutationBody;
  const { entryId } = await context.params;

  if (!body.periodLabel || !body.entry) {
    return NextResponse.json(
      { error: "Missing periodLabel or entry payload." },
      { status: 400 }
    );
  }

  await mockFinanceRepository.updateFinanceEntry({
    periodLabel: body.periodLabel,
    entryId,
    entry: body.entry
  });

  const dashboard = await mockFinanceRepository.getFinanceDashboard(body.periodLabel);

  return NextResponse.json<EntryMutationResponse>({ ok: true, dashboard });
}

export async function DELETE(request: Request, context: RouteContext) {
  const body = (await request.json()) as EntryMutationBody;
  const { entryId } = await context.params;

  if (!body.periodLabel) {
    return NextResponse.json(
      { error: "Missing periodLabel payload." },
      { status: 400 }
    );
  }

  await mockFinanceRepository.deleteFinanceEntry({
    periodLabel: body.periodLabel,
    entryId
  });

  const dashboard = await mockFinanceRepository.getFinanceDashboard(body.periodLabel);

  return NextResponse.json<EntryMutationResponse>({ ok: true, dashboard });
}
