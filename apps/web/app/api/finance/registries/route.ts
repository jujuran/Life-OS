import { NextResponse } from "next/server";
import type {
  FinanceCaptureRegistries,
  FinanceDashboardViewModel
} from "@life-os/domain/finance-model";
import { mockFinanceRepository } from "../../../../lib/mock-finance-repository";

type SaveCaptureRegistriesBody = {
  periodLabel?: string;
  registries?: FinanceCaptureRegistries;
};

type SaveCaptureRegistriesResponse = {
  ok: true;
  dashboard: FinanceDashboardViewModel;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SaveCaptureRegistriesBody;

  if (!body.periodLabel || !body.registries) {
    return NextResponse.json(
      { error: "Missing periodLabel or registries payload." },
      { status: 400 }
    );
  }

  await mockFinanceRepository.saveCaptureRegistries({
    periodLabel: body.periodLabel,
    registries: body.registries
  });

  const dashboard = await mockFinanceRepository.getFinanceDashboard(body.periodLabel);

  return NextResponse.json<SaveCaptureRegistriesResponse>({ ok: true, dashboard });
}
