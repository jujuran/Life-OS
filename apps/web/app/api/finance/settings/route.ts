import { NextResponse } from "next/server";
import type {
  FinanceBalanceSettings,
  FinanceDashboardViewModel
} from "@life-os/domain/finance-model";
import { mockFinanceRepository } from "../../../../lib/mock-finance-repository";

type SaveBalanceSettingsBody = {
  periodLabel?: string;
  settings?: FinanceBalanceSettings;
};

type SaveBalanceSettingsResponse = {
  ok: true;
  dashboard: FinanceDashboardViewModel;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SaveBalanceSettingsBody;

  if (!body.periodLabel || !body.settings) {
    return NextResponse.json(
      { error: "Missing periodLabel or settings payload." },
      { status: 400 }
    );
  }

  await mockFinanceRepository.saveBalanceSettings({
    periodLabel: body.periodLabel,
    settings: body.settings
  });

  const dashboard = await mockFinanceRepository.getFinanceDashboard(body.periodLabel);

  return NextResponse.json<SaveBalanceSettingsResponse>({ ok: true, dashboard });
}
