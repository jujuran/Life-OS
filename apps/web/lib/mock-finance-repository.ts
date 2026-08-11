import type {
  FinanceBalanceSettings,
  FinanceDashboardViewModel,
  FinanceLedgerEntry,
  FinanceRecentFlow
} from "@life-os/domain/finance-model";
import type {
  DeleteFinanceEntryPayload,
  ExportFinanceLedgerResult,
  FinanceDashboardRepository,
  FinanceLedgerBackupSummary,
  FinanceLedgerRepository,
  RemoveActionItemPayload,
  RecordFinanceEntryPayload,
  RestoreFinanceLedgerPayload,
  SaveBalanceSettingsPayload,
  SaveActionItemPayload,
  SaveCaptureRegistriesPayload,
  UpdateFinanceEntryPayload
} from "@life-os/db/finance-repository";
import { financeDashboardSeed } from "./finance-dashboard-seed.public";
import { buildFinanceDashboard } from "./finance-dashboard-builder";
import { getConfiguredFinanceAccountMergeRules } from "./finance-account-merge-rules";
import {
  createFinanceLedgerBackup,
  parseFinanceLedgerStoreContent,
  readFinanceLedgerStore,
  serializeFinanceLedgerStore,
  writeFinanceLedgerStore
} from "./local-finance-store";

class MockFinanceRepository
  implements FinanceDashboardRepository, FinanceLedgerRepository
{
  private readonly dashboard: FinanceDashboardViewModel;

  constructor(seed: FinanceDashboardViewModel) {
    this.dashboard = seed;
  }

  async getFinanceDashboard(periodLabel: string): Promise<FinanceDashboardViewModel> {
    const normalizedPeriodLabel = isLikelyBrokenPeriodLabel(periodLabel)
      ? this.dashboard.periodLabel
      : periodLabel;
    const store = await readFinanceLedgerStore(
      this.dashboard.capture.registries,
      this.dashboard.recentFlows
    );

    return buildFinanceDashboard({
      baseDashboard: this.dashboard,
      entries: store.entries,
      legacyRecentFlows: store.legacyRecentFlows,
      actionItems: store.actionItems,
      dismissedActionItemIds: store.dismissedActionItemIds,
      balanceAdjustments: store.balanceAdjustments,
      baselineMode: store.baselineMode,
      baselineResetAt: store.baselineResetAt,
      registries: store.registries,
      periodLabel: normalizedPeriodLabel,
      accountMergeRules: getConfiguredFinanceAccountMergeRules()
    });
  }

  async listRecentFlows(periodLabel: string): Promise<FinanceRecentFlow[]> {
    const dashboard = await this.getFinanceDashboard(periodLabel);
    return [...dashboard.recentFlows];
  }

  async listFinanceEntries(periodLabel: string): Promise<FinanceLedgerEntry[]> {
    const store = await readFinanceLedgerStore(
      this.dashboard.capture.registries,
      this.dashboard.recentFlows
    );

    return getActiveEntriesForPeriod(store, periodLabel);
  }

  async recordFinanceEntry(payload: RecordFinanceEntryPayload): Promise<void> {
    const store = await readFinanceLedgerStore(
      this.dashboard.capture.registries,
      this.dashboard.recentFlows
    );

    await writeFinanceLedgerStore({
      ...store,
      entries: [payload.entry, ...store.entries].slice(0, 200)
    });
  }

  async updateFinanceEntry(payload: UpdateFinanceEntryPayload): Promise<void> {
    const store = await readFinanceLedgerStore(
      this.dashboard.capture.registries,
      this.dashboard.recentFlows
    );

    await writeFinanceLedgerStore({
      ...store,
      entries: store.entries.map((entry) =>
        entry.id === payload.entryId
          ? {
              ...payload.entry,
              id: payload.entryId,
              periodLabel: payload.periodLabel
            }
          : entry
      )
    });
  }

  async deleteFinanceEntry(payload: DeleteFinanceEntryPayload): Promise<void> {
    const store = await readFinanceLedgerStore(
      this.dashboard.capture.registries,
      this.dashboard.recentFlows
    );

    await writeFinanceLedgerStore({
      ...store,
      entries: store.entries.filter((entry) => entry.id !== payload.entryId)
    });
  }

  async saveCaptureRegistries(payload: SaveCaptureRegistriesPayload): Promise<void> {
    void payload.periodLabel;
    const store = await readFinanceLedgerStore(
      this.dashboard.capture.registries,
      this.dashboard.recentFlows
    );

    await writeFinanceLedgerStore({
      ...store,
      registries: payload.registries
    });
  }

  async saveActionItem(payload: SaveActionItemPayload): Promise<void> {
    void payload.periodLabel;
    const store = await readFinanceLedgerStore(
      this.dashboard.capture.registries,
      this.dashboard.recentFlows
    );

    await writeFinanceLedgerStore({
      ...store,
      actionItems: [payload.item, ...store.actionItems].slice(0, 50),
      dismissedActionItemIds: store.dismissedActionItemIds.filter(
        (id) => id !== payload.item.id
      )
    });
  }

  async removeActionItem(payload: RemoveActionItemPayload): Promise<void> {
    void payload.periodLabel;
    const store = await readFinanceLedgerStore(
      this.dashboard.capture.registries,
      this.dashboard.recentFlows
    );

    await writeFinanceLedgerStore({
      ...store,
      actionItems: store.actionItems.filter((item) => item.id !== payload.itemId),
      dismissedActionItemIds: Array.from(
        new Set([...store.dismissedActionItemIds, payload.itemId])
      )
    });
  }

  async saveBalanceSettings(payload: SaveBalanceSettingsPayload): Promise<void> {
    const store = await readFinanceLedgerStore(
      this.dashboard.capture.registries,
      this.dashboard.recentFlows
    );
    const currentDashboard = await this.getFinanceDashboard(payload.periodLabel);

    await writeFinanceLedgerStore({
      ...store,
      balanceAdjustments: {
        fundAccounts: mergeBalanceAdjustments(
          currentDashboard.fundAccounts.map((item) => ({
            name: item.name,
            amount: parseCurrency(item.balance)
          })),
          payload.settings.fundAccounts,
          store.balanceAdjustments.fundAccounts
        ),
        liabilities: mergeBalanceAdjustments(
          currentDashboard.liabilities.items.map((item) => ({
            name: item.name,
            amount: parseCurrency(item.dueAmount)
          })),
          payload.settings.liabilities,
          store.balanceAdjustments.liabilities
        ),
        investments: mergeBalanceAdjustments(
          currentDashboard.investments.items.map((item) => ({
            name: item.name,
            amount: parseCurrency(item.amount)
          })),
          payload.settings.investments,
          store.balanceAdjustments.investments
        )
      }
    });
  }

  async exportFinanceLedger(periodLabel: string): Promise<ExportFinanceLedgerResult> {
    void periodLabel;
    const store = await readFinanceLedgerStore(
      this.dashboard.capture.registries,
      this.dashboard.recentFlows
    );

    return {
      fileName: `finance-ledger-export-${createFileStamp(new Date())}.json`,
      content: serializeFinanceLedgerStore(store)
    };
  }

  async createFinanceLedgerBackup(periodLabel: string): Promise<FinanceLedgerBackupSummary> {
    void periodLabel;
    const store = await readFinanceLedgerStore(
      this.dashboard.capture.registries,
      this.dashboard.recentFlows
    );

    return createFinanceLedgerBackup(store);
  }

  async restoreFinanceLedger(payload: RestoreFinanceLedgerPayload): Promise<void> {
    void payload.periodLabel;
    const restoredStore = parseFinanceLedgerStoreContent(
      payload.ledgerJson,
      this.dashboard.capture.registries,
      this.dashboard.recentFlows
    );

    await writeFinanceLedgerStore(restoredStore);
  }
}

export const mockFinanceRepository = new MockFinanceRepository(financeDashboardSeed);

function getActiveEntriesForPeriod(
  store: Awaited<ReturnType<typeof readFinanceLedgerStore>>,
  periodLabel: string
) {
  const useCurrentBalancesAsBaseline = store.baselineMode === "snapshot";

  return store.entries
    .filter((entry) => entry.periodLabel === periodLabel)
    .filter((entry) =>
      useCurrentBalancesAsBaseline && store.baselineResetAt
        ? getEntryCreatedAt(entry) >= store.baselineResetAt
        : true
    )
    .sort((left, right) =>
      `${right.occurredOn}-${right.id}`.localeCompare(`${left.occurredOn}-${left.id}`)
    );
}

function mergeBalanceAdjustments(
  currentItems: FinanceBalanceSettings["fundAccounts"],
  targetItems: FinanceBalanceSettings["fundAccounts"],
  existingAdjustments: FinanceBalanceSettings["fundAccounts"]
) {
  const currentMap = new Map(currentItems.map((item) => [item.name, item.amount]));
  const existingMap = new Map(existingAdjustments.map((item) => [item.name, item.amount]));

  return targetItems
    .map((item) => {
      const currentAmount = currentMap.get(item.name) ?? 0;
      const existingAmount = existingMap.get(item.name) ?? 0;
      const nextAdjustment = roundMoney(existingAmount + (item.amount - currentAmount));

      return {
        name: item.name,
        amount: nextAdjustment
      };
    })
    .filter((item) => Math.abs(item.amount) >= 0.005);
}

function parseCurrency(value: string) {
  const normalized = value.replace(/[^\d.-]/g, "");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function isLikelyBrokenPeriodLabel(value: string) {
  return ["忙", "氓", "莽", "茅", "脗", "鏈圽"].some((token) =>
    value.includes(token)
  );
}

function createFileStamp(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function getEntryCreatedAt(entry: FinanceLedgerEntry) {
  const matched = entry.id.match(/(\d{13})$/);
  if (matched) {
    const numeric = Number(matched[1]);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  const parsedDate = new Date(`${entry.occurredOn}T00:00:00`).getTime();
  return Number.isFinite(parsedDate) ? parsedDate : 0;
}
