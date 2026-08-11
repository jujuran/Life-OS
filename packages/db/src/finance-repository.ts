import type {
  FinanceActionItem,
  FinanceBalanceSettings,
  FinanceCaptureRegistries,
  FinanceLedgerEntry,
  FinanceDashboardViewModel,
  FinanceRecentFlow
} from "@life-os/domain/finance-model";

export type RecordFinanceEntryPayload = {
  periodLabel: string;
  entry: FinanceLedgerEntry;
};

export type UpdateFinanceEntryPayload = {
  periodLabel: string;
  entryId: string;
  entry: FinanceLedgerEntry;
};

export type DeleteFinanceEntryPayload = {
  periodLabel: string;
  entryId: string;
};

export type SaveCaptureRegistriesPayload = {
  periodLabel: string;
  registries: FinanceCaptureRegistries;
};

export type SaveActionItemPayload = {
  periodLabel: string;
  item: FinanceActionItem;
};

export type RemoveActionItemPayload = {
  periodLabel: string;
  itemId: string;
};

export type SaveBalanceSettingsPayload = {
  periodLabel: string;
  settings: FinanceBalanceSettings;
};

export type RestoreFinanceLedgerPayload = {
  periodLabel: string;
  ledgerJson: string;
};

export type ExportFinanceLedgerResult = {
  fileName: string;
  content: string;
};

export type FinanceLedgerBackupSummary = {
  fileName: string;
  filePath: string;
  createdAt: string;
};

export interface FinanceDashboardRepository {
  getFinanceDashboard(periodLabel: string): Promise<FinanceDashboardViewModel>;
}

export interface FinanceLedgerRepository {
  listFinanceEntries(periodLabel: string): Promise<FinanceLedgerEntry[]>;
  listRecentFlows(periodLabel: string): Promise<FinanceRecentFlow[]>;
  recordFinanceEntry(payload: RecordFinanceEntryPayload): Promise<void>;
  updateFinanceEntry(payload: UpdateFinanceEntryPayload): Promise<void>;
  deleteFinanceEntry(payload: DeleteFinanceEntryPayload): Promise<void>;
  saveCaptureRegistries(payload: SaveCaptureRegistriesPayload): Promise<void>;
  saveActionItem(payload: SaveActionItemPayload): Promise<void>;
  removeActionItem(payload: RemoveActionItemPayload): Promise<void>;
  saveBalanceSettings(payload: SaveBalanceSettingsPayload): Promise<void>;
  exportFinanceLedger(periodLabel: string): Promise<ExportFinanceLedgerResult>;
  createFinanceLedgerBackup(periodLabel: string): Promise<FinanceLedgerBackupSummary>;
  restoreFinanceLedger(payload: RestoreFinanceLedgerPayload): Promise<void>;
}
