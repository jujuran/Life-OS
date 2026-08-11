import { NextResponse } from "next/server";
import {
  createLedgerEntryFromDraft,
  ensureCaptureDraft,
  type CaptureDirection,
  type FinanceCaptureDraft
} from "@life-os/domain/finance-model";
import { mockFinanceRepository } from "../../../lib/mock-finance-repository";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getDirection(value: string): CaptureDirection {
  if (value === "income" || value === "transfer") {
    return value;
  }

  return "expense";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const periodLabel = getString(formData, "periodLabel") || "2026 / 04 月";
  const mode = getString(formData, "mode") || "quick";
  const dashboard = await mockFinanceRepository.getFinanceDashboard(periodLabel);

  const draft: FinanceCaptureDraft = {
    direction: getDirection(getString(formData, "direction")),
    amountInput: getString(formData, "amountInput"),
    category: getString(formData, "category"),
    channelAccount: getString(formData, "channelAccount"),
    targetAccount: getString(formData, "targetAccount"),
    note: getString(formData, "note"),
    customRegistryName: "",
    naturalText: getString(formData, "naturalText")
  };

  const safeDraft = ensureCaptureDraft(draft, dashboard.capture, draft.direction);
  const entry = createLedgerEntryFromDraft(safeDraft, periodLabel);
  const redirectUrl = new URL("/finance", request.url);
  redirectUrl.searchParams.set("direction", safeDraft.direction);
  redirectUrl.searchParams.set("mode", mode);
  redirectUrl.hash = "capture";

  if (!entry) {
    redirectUrl.searchParams.set("error", "invalid-amount");
    return NextResponse.redirect(redirectUrl);
  }

  await mockFinanceRepository.recordFinanceEntry({
    periodLabel,
    entry
  });

  redirectUrl.searchParams.set("saved", "1");
  return NextResponse.redirect(redirectUrl);
}
