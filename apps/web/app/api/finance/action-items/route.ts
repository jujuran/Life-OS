import { NextResponse } from "next/server";
import type {
  FinanceActionItem,
  FinanceDashboardViewModel
} from "@life-os/domain/finance-model";
import { mockFinanceRepository } from "../../../../lib/mock-finance-repository";

type SaveActionItemBody = {
  periodLabel?: string;
  item?: FinanceActionItem;
};

type RemoveActionItemBody = {
  periodLabel?: string;
  itemId?: string;
};

type SaveActionItemResponse = {
  ok: true;
  dashboard: FinanceDashboardViewModel;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SaveActionItemBody;

  if (!body.periodLabel || !body.item) {
    return NextResponse.json(
      { error: "Missing periodLabel or action item payload." },
      { status: 400 }
    );
  }

  await mockFinanceRepository.saveActionItem({
    periodLabel: body.periodLabel,
    item: body.item
  });

  const dashboard = await mockFinanceRepository.getFinanceDashboard(body.periodLabel);

  return NextResponse.json<SaveActionItemResponse>({ ok: true, dashboard });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as RemoveActionItemBody;

  if (!body.periodLabel || !body.itemId) {
    return NextResponse.json(
      { error: "Missing periodLabel or action item id." },
      { status: 400 }
    );
  }

  await mockFinanceRepository.removeActionItem({
    periodLabel: body.periodLabel,
    itemId: body.itemId
  });

  const dashboard = await mockFinanceRepository.getFinanceDashboard(body.periodLabel);

  return NextResponse.json<SaveActionItemResponse>({ ok: true, dashboard });
}
