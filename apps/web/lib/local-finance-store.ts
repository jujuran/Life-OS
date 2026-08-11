import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FinanceLedgerBackupSummary } from "@life-os/db/finance-repository";
import type {
  FinanceActionItem,
  FinanceBalanceSettings,
  FinanceCaptureRegistries,
  FinanceLedgerEntry,
  FinanceRecentFlow
} from "@life-os/domain/finance-model";
import { getLifeOsDataPath } from "./life-os-data-paths";

export type FinanceLedgerStore = {
  entries: FinanceLedgerEntry[];
  registries: FinanceCaptureRegistries;
  legacyRecentFlows: FinanceRecentFlow[];
  actionItems: FinanceActionItem[];
  dismissedActionItemIds: string[];
  balanceAdjustments: FinanceBalanceSettings;
  baselineMode: "seed" | "snapshot";
  baselineResetAt: number | null;
};

const FINANCE_LEDGER_FILE_NAME = "finance-ledger.json";
const FINANCE_LEDGER_BACKUP_DIRECTORY = "backups";

export function getFinanceLedgerStorePath() {
  return getLifeOsDataPath(FINANCE_LEDGER_FILE_NAME);
}

function getFinanceLedgerBackupDirectoryPath() {
  return getLifeOsDataPath(FINANCE_LEDGER_BACKUP_DIRECTORY);
}

async function ensureLedgerStoreDirectory() {
  await mkdir(dirname(getFinanceLedgerStorePath()), { recursive: true });
}

async function ensureLedgerBackupDirectory() {
  await mkdir(getFinanceLedgerBackupDirectoryPath(), { recursive: true });
}

export function createEmptyFinanceLedgerStore(
  seedRegistries: FinanceCaptureRegistries,
  seedRecentFlows: FinanceRecentFlow[]
): FinanceLedgerStore {
  return {
    entries: [],
    registries: seedRegistries,
    legacyRecentFlows: seedRecentFlows,
    actionItems: [],
    dismissedActionItemIds: [],
    balanceAdjustments: emptyBalanceSettings(),
    baselineMode: "seed",
    baselineResetAt: null
  };
}

export function normalizeFinanceLedgerStore(
  parsed: Partial<FinanceLedgerStore> | undefined,
  seedRegistries: FinanceCaptureRegistries,
  seedRecentFlows: FinanceRecentFlow[]
): FinanceLedgerStore {
  const registries =
    parsed?.registries &&
    typeof parsed.registries === "object" &&
    "expense" in parsed.registries &&
    "income" in parsed.registries &&
    "transfer" in parsed.registries &&
    !isLikelyBrokenText(JSON.stringify(parsed.registries))
      ? (parsed.registries as FinanceCaptureRegistries)
      : seedRegistries;

  const legacyRecentFlows = Array.isArray(parsed?.legacyRecentFlows)
    ? !isLikelyBrokenText(JSON.stringify(parsed.legacyRecentFlows))
      ? parsed.legacyRecentFlows
      : seedRecentFlows
    : Array.isArray((parsed as { recentFlows?: FinanceRecentFlow[] } | undefined)?.recentFlows) &&
        !isLikelyBrokenText(
          JSON.stringify(
            (parsed as { recentFlows?: FinanceRecentFlow[] } | undefined)?.recentFlows
          )
        )
      ? (((parsed as { recentFlows?: FinanceRecentFlow[] } | undefined)?.recentFlows ??
          []) as FinanceRecentFlow[])
      : seedRecentFlows;

  return {
    entries: Array.isArray(parsed?.entries)
      ? parsed.entries.filter((entry) => !isLikelyBrokenText(JSON.stringify(entry)))
      : [],
    registries,
    legacyRecentFlows,
    actionItems: Array.isArray((parsed as { actionItems?: FinanceActionItem[] } | undefined)?.actionItems)
      ? ((((parsed as { actionItems?: FinanceActionItem[] } | undefined)?.actionItems ??
          []).filter((item) => !isLikelyBrokenText(JSON.stringify(item))) as FinanceActionItem[]))
      : [],
    dismissedActionItemIds: Array.isArray(
      (parsed as { dismissedActionItemIds?: string[] } | undefined)?.dismissedActionItemIds
    )
      ? (((parsed as { dismissedActionItemIds?: string[] } | undefined)?.dismissedActionItemIds ??
          []).filter((item) => typeof item === "string" && item.length > 0) as string[])
      : [],
    balanceAdjustments: parseBalanceSettings(
      (parsed as { balanceAdjustments?: FinanceBalanceSettings } | undefined)?.balanceAdjustments
    ),
    baselineMode:
      (parsed as { baselineMode?: string } | undefined)?.baselineMode === "snapshot"
        ? "snapshot"
        : "seed",
    baselineResetAt:
      typeof (parsed as { baselineResetAt?: number } | undefined)?.baselineResetAt === "number" &&
      Number.isFinite((parsed as { baselineResetAt?: number } | undefined)?.baselineResetAt)
        ? (((parsed as { baselineResetAt?: number } | undefined)?.baselineResetAt ?? null) as number)
        : null
  };
}

export function parseFinanceLedgerStoreContent(
  raw: string,
  seedRegistries: FinanceCaptureRegistries,
  seedRecentFlows: FinanceRecentFlow[]
) {
  const parsed = JSON.parse(raw) as Partial<FinanceLedgerStore>;
  return normalizeFinanceLedgerStore(parsed, seedRegistries, seedRecentFlows);
}

export function serializeFinanceLedgerStore(store: FinanceLedgerStore) {
  return JSON.stringify(store, null, 2) + "\n";
}

export async function readFinanceLedgerStore(
  seedRegistries: FinanceCaptureRegistries,
  seedRecentFlows: FinanceRecentFlow[]
): Promise<FinanceLedgerStore> {
  try {
    const raw = await readFile(getFinanceLedgerStorePath(), "utf8");
    return parseFinanceLedgerStoreContent(raw, seedRegistries, seedRecentFlows);
  } catch {
    return createEmptyFinanceLedgerStore(seedRegistries, seedRecentFlows);
  }
}

export async function writeFinanceLedgerStore(store: FinanceLedgerStore) {
  await ensureLedgerStoreDirectory();
  await writeFile(getFinanceLedgerStorePath(), serializeFinanceLedgerStore(store), "utf8");
}

export async function createFinanceLedgerBackup(
  store: FinanceLedgerStore,
  timestamp = new Date()
): Promise<FinanceLedgerBackupSummary> {
  await ensureLedgerBackupDirectory();
  const fileName = `finance-ledger-backup-${formatTimestamp(timestamp)}.json`;
  const filePath = join(getFinanceLedgerBackupDirectoryPath(), fileName);

  await writeFile(filePath, serializeFinanceLedgerStore(store), "utf8");

  return {
    fileName,
    filePath,
    createdAt: timestamp.toISOString()
  };
}

function emptyBalanceSettings(): FinanceBalanceSettings {
  return {
    fundAccounts: [],
    liabilities: [],
    investments: []
  };
}

function parseBalanceSettings(value?: FinanceBalanceSettings): FinanceBalanceSettings {
  if (!value || typeof value !== "object") {
    return emptyBalanceSettings();
  }

  return {
    fundAccounts: sanitizeBalanceSettingItems(value.fundAccounts),
    liabilities: sanitizeBalanceSettingItems(value.liabilities),
    investments: sanitizeBalanceSettingItems(value.investments)
  };
}

function sanitizeBalanceSettingItems(
  items: FinanceBalanceSettings["fundAccounts"] | undefined
) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter(
    (item): item is FinanceBalanceSettings["fundAccounts"][number] =>
      Boolean(item) &&
      typeof item.name === "string" &&
      item.name.length > 0 &&
      typeof item.amount === "number" &&
      Number.isFinite(item.amount)
  );
}

function formatTimestamp(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function isLikelyBrokenText(text: string) {
  return [
    "锟",
    "妯搢",
    "閸梶",
    "鏅",
    "鍋嶉拑",
    "锟絴忙"
  ].some((token) => text.includes(token));
}
