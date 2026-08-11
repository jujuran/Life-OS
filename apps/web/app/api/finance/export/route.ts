import { mockFinanceRepository } from "../../../../lib/mock-finance-repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const periodLabel = url.searchParams.get("periodLabel") ?? "2026 / 04 月";
  const result = await mockFinanceRepository.exportFinanceLedger(periodLabel);

  return new Response(result.content, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${result.fileName}"`,
      "cache-control": "no-store"
    }
  });
}
