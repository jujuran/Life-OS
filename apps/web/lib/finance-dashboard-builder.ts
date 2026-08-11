import {
  createRecentFlowFromEntry,
  formatMoney,
  type FinanceActionItem,
  type FinanceBalanceSettings,
  type FinanceCaptureRegistries,
  type FinanceDashboardViewModel,
  type FinanceLedgerEntry,
  type FinanceRecentFlow
} from "@life-os/domain/finance-model";
import {
  resolveConfiguredFinanceAccountName,
  type FinanceAccountMergeRule
} from "./finance-account-merge-rules";

type FundAccountState = FinanceDashboardViewModel["fundAccounts"][number] & {
  numericBalance: number;
};

type LiabilityItemState = FinanceDashboardViewModel["liabilities"]["items"][number] & {
  numericDueAmount: number;
};

type InvestmentItemState = FinanceDashboardViewModel["investments"]["items"][number] & {
  numericAmount: number;
};

type RankItemState = {
  id: string;
  name: string;
  amount: number;
};

type SnapshotState = {
  id: string;
  label: string;
  value: number;
  delta: number;
};

type BuildFinanceDashboardInput = {
  baseDashboard: FinanceDashboardViewModel;
  entries: FinanceLedgerEntry[];
  legacyRecentFlows: FinanceRecentFlow[];
  actionItems: FinanceActionItem[];
  dismissedActionItemIds: string[];
  balanceAdjustments: FinanceBalanceSettings;
  baselineMode: "seed" | "snapshot";
  baselineResetAt: number | null;
  registries: FinanceCaptureRegistries;
  periodLabel: string;
  accountMergeRules?: FinanceAccountMergeRule[];
};

const DEFAULT_LIABILITY_ITEMS = [
  {
    name: "其他负债",
    tag: "手动维护",
    description: "花呗、白条、借款、人情往来等非信用卡负债",
    amount: 0
  }
] as const;
export function buildFinanceDashboard({
  baseDashboard,
  entries,
  legacyRecentFlows,
  actionItems,
  dismissedActionItemIds,
  balanceAdjustments,
  baselineMode,
  baselineResetAt,
  registries,
  periodLabel,
  accountMergeRules = []
}: BuildFinanceDashboardInput): FinanceDashboardViewModel {
  const base =
    periodLabel === baseDashboard.periodLabel
      ? baseDashboard
      : {
          ...baseDashboard,
          periodLabel
        };

  const useCurrentBalancesAsBaseline = baselineMode === "snapshot";
  const activeEntries = entries
    .filter((entry) => entry.periodLabel === periodLabel)
    .filter((entry) =>
      useCurrentBalancesAsBaseline && baselineResetAt
        ? getEntryCreatedAt(entry) >= baselineResetAt
        : true
    )
    .map((entry) => ({
      ...entry,
      channelAccount: resolveConfiguredFinanceAccountName(
        entry.channelAccount,
        accountMergeRules
      ),
      targetAccount: resolveConfiguredFinanceAccountName(
        entry.targetAccount,
        accountMergeRules
      )
    }))
    .sort((left, right) =>
      `${left.occurredOn}-${left.id}`.localeCompare(`${right.occurredOn}-${right.id}`)
    );

  const fundAccounts = createFundAccountStates(base.fundAccounts);
  const liabilities = createLiabilityStates(base.liabilities.items);
  ensureDefaultLiabilityStates(liabilities);
  const investments = createInvestmentStates(base.investments.items);
  ensureRiskInvestmentStates(investments);
  applyBalanceAdjustments(
    fundAccounts,
    liabilities,
    investments,
    balanceAdjustments,
    accountMergeRules
  );
  mergeConfiguredInvestmentAccounts(
    fundAccounts,
    investments,
    accountMergeRules
  );
  const categories = createRankStates(useCurrentBalancesAsBaseline ? [] : base.categories);
  const paymentChannels = createRankStates(
    useCurrentBalancesAsBaseline ? [] : base.paymentChannels
  );
  const incomeSources = createRankStates(
    useCurrentBalancesAsBaseline ? [] : base.incomeSources
  );
  const normalizedRegistries = normalizeCaptureRegistries(
    registries,
    accountMergeRules
  );
  const cashFlow = new Map(
    (useCurrentBalancesAsBaseline ? [] : base.cashFlow).map((point) => [
      point.label,
      {
        ...point
      }
    ])
  );
  const snapshots = base.netAssetSnapshots.map<SnapshotState>((snapshot) => ({
    id: snapshot.id,
    label: snapshot.label,
    value: parseCurrency(snapshot.value),
    delta: parseSignedCurrency(snapshot.delta)
  }));

  let incomeTotal = useCurrentBalancesAsBaseline ? 0 : parseOverviewValue(base, "income");
  let expenseTotal = useCurrentBalancesAsBaseline ? 0 : parseOverviewValue(base, "expense");
  let balanceTotal = useCurrentBalancesAsBaseline ? 0 : parseOverviewValue(base, "balance");
  let assetTotal =
    sumFundAccountBalances(fundAccounts) + sumInvestmentAmounts(investments);
  let liabilityTotal = sumLiabilityAmounts(liabilities);
  let netAssetTotal = assetTotal - liabilityTotal;
  let budgetUsed = useCurrentBalancesAsBaseline ? 0 : base.budget.used;
  const budgetTotal = base.budget.total;
  let netAssetDelta = 0;

  for (const entry of activeEntries) {
    if (entry.direction === "income") {
      incomeTotal += entry.amount;
      balanceTotal += entry.amount;
      netAssetTotal += entry.amount;
      assetTotal += entry.amount;
      netAssetDelta += entry.amount;

      ensureFundAccount(fundAccounts, entry.channelAccount).numericBalance += entry.amount;
      updateRankState(incomeSources, entry.category, entry.amount);
      updateCashFlowState(cashFlow, entry.displayDate, "income", entry.amount);
      updateCashFlowState(cashFlow, entry.displayDate, "balance", entry.amount);
      continue;
    }

    if (entry.direction === "expense") {
      expenseTotal += entry.amount;
      balanceTotal -= entry.amount;
      netAssetTotal -= entry.amount;
      assetTotal -= entry.amount;
      netAssetDelta -= entry.amount;
      budgetUsed += entry.amount;

      ensureFundAccount(fundAccounts, entry.channelAccount).numericBalance -= entry.amount;
      updateRankState(categories, entry.category, entry.amount);
      updateRankState(paymentChannels, entry.channelAccount, entry.amount);
      updateCashFlowState(cashFlow, entry.displayDate, "expense", entry.amount);
      updateCashFlowState(cashFlow, entry.displayDate, "balance", -entry.amount);
      continue;
    }

    const sourceKind = resolveContainerKind(
      entry.channelAccount,
      fundAccounts,
      liabilities,
      investments
    );
    const targetKind = resolveContainerKind(
      entry.targetAccount,
      fundAccounts,
      liabilities,
      investments
    );

    if (sourceKind === "fund") {
      ensureFundAccount(fundAccounts, entry.channelAccount).numericBalance -= entry.amount;
    } else if (sourceKind === "liability") {
      ensureLiabilityItem(liabilities, entry.channelAccount).numericDueAmount += entry.amount;
      liabilityTotal += entry.amount;
      assetTotal += entry.amount;
    } else if (sourceKind === "investment") {
      ensureInvestmentItem(investments, entry.channelAccount).numericAmount -= entry.amount;
    }

    if (targetKind === "fund") {
      ensureFundAccount(fundAccounts, entry.targetAccount).numericBalance += entry.amount;
    } else if (targetKind === "liability") {
      const item = ensureLiabilityItem(liabilities, entry.targetAccount);
      item.numericDueAmount = Math.max(0, item.numericDueAmount - entry.amount);
      liabilityTotal = Math.max(0, liabilityTotal - entry.amount);
      assetTotal -= entry.amount;
    } else if (targetKind === "investment") {
      ensureInvestmentItem(investments, entry.targetAccount).numericAmount += entry.amount;
    }
  }

  if (snapshots.length > 0) {
    const latestSnapshot = snapshots[snapshots.length - 1];
    latestSnapshot.value = netAssetTotal;
    latestSnapshot.delta =
      useCurrentBalancesAsBaseline
        ? roundMoney(netAssetDelta)
        : snapshots.length > 1
        ? roundMoney(netAssetTotal - snapshots[snapshots.length - 2].value)
        : roundMoney(netAssetDelta);
  }

  const dueThisMonth = Array.from(liabilities.values()).reduce(
    (total, item) => total + item.numericDueAmount,
    0
  );
  const investmentTotal = Array.from(investments.values()).reduce(
    (total, item) => total + item.numericAmount,
    0
  );

  return {
    ...base,
    capture: {
      ...base.capture,
      registries: normalizedRegistries
    },
    overview: base.overview.map((item) => {
      if (item.id === "expense") {
        return {
          ...item,
          value: formatCurrency(expenseTotal),
          note: "本月已记录支出"
        };
      }

      if (item.id === "income") {
        return {
          ...item,
          value: formatCurrency(incomeTotal),
          note: "本月已记录收入"
        };
      }

      if (item.id === "balance") {
        return {
          ...item,
          value: formatCurrency(balanceTotal),
          note: balanceTotal >= 0 ? "本月现金结余仍为正" : "本月现金流转为负"
        };
      }

      if (item.id === "net-assets") {
        return {
          ...item,
          value: formatCurrency(netAssetTotal),
          note: `总资产 ${formatCurrency(assetTotal)} · 总负债 ${formatCurrency(liabilityTotal)}`
        };
      }

      return item;
    }),
    fundAccounts: buildFundAccounts(base.fundAccounts, fundAccounts),
    budget: {
      used: roundMoney(budgetUsed),
      total: budgetTotal,
      ratio: budgetTotal > 0 ? Math.min(budgetUsed / budgetTotal, 1.2) : 0,
      label:
        budgetUsed > budgetTotal
          ? `当前进度 ${Math.round((budgetUsed / budgetTotal) * 100)}% · 已超支`
          : `当前进度 ${Math.round((budgetUsed / budgetTotal) * 100)}%`
    },
    liabilities: {
      total: formatCurrency(liabilityTotal),
      dueThisMonth: formatCurrency(dueThisMonth),
      items: buildLiabilityItems(base.liabilities.items, liabilities)
    },
    actionItems: buildActionItems(base.actionItems, actionItems, dismissedActionItemIds),
    incomeSources: buildRankItems(incomeSources),
    cashFlow: buildCashFlowItems(cashFlow),
    netAssetSnapshots: snapshots.map((snapshot) => ({
      id: snapshot.id,
      label: snapshot.label,
      value: formatCurrency(snapshot.value),
      delta: formatSignedCurrency(snapshot.delta)
    })),
    investments: {
      ...base.investments,
      total: formatCurrency(investmentTotal),
      items: buildInvestmentItems(base.investments.items, investments)
    },
    categories: buildRankItems(categories),
    paymentChannels: buildRankItems(paymentChannels),
    recentFlows: buildRecentFlows(
      useCurrentBalancesAsBaseline ? [] : base.recentFlows,
      useCurrentBalancesAsBaseline ? [] : legacyRecentFlows,
      activeEntries
    )
  };
}

function createFundAccountStates(
  items: FinanceDashboardViewModel["fundAccounts"]
) {
  return new Map(
    items.map((item) => [
      item.name,
      {
        ...item,
        numericBalance: parseCurrency(item.balance)
      }
    ])
  );
}

function createLiabilityStates(
  items: FinanceDashboardViewModel["liabilities"]["items"]
) {
  return new Map(
    items.map((item) => [
      item.name,
      {
        ...item,
        numericDueAmount: parseCurrency(item.dueAmount)
      }
    ])
  );
}

function createInvestmentStates(
  items: FinanceDashboardViewModel["investments"]["items"]
) {
  return new Map(
    items.map((item) => [
      item.name,
      {
        ...item,
        numericAmount: parseCurrency(item.amount)
      }
    ])
  );
}

function createRankStates(
  items:
    | FinanceDashboardViewModel["categories"]
    | FinanceDashboardViewModel["paymentChannels"]
    | FinanceDashboardViewModel["incomeSources"]
) {
  return new Map(
    items.map((item) => [
      item.name,
      {
        id: item.id,
        name: item.name,
        amount: parseCurrency(item.amount)
      }
    ])
  );
}

function ensureFundAccount(
  states: Map<string, FundAccountState>,
  name: string
) {
  const resolvedName = resolveFundAccountName(name, states);
  const existing = states.get(resolvedName);
  if (existing) {
    return existing;
  }

  const created: FundAccountState = {
    id: `account-${hashText(resolvedName)}`,
    name: resolvedName,
    tag: "自定义账户",
    description: "由录入自动生成",
    balance: formatCurrency(0),
    numericBalance: 0
  };
  states.set(resolvedName, created);
  return created;
}

function ensureLiabilityItem(
  states: Map<string, LiabilityItemState>,
  name: string
) {
  const existing = states.get(name);
  if (existing) {
    return existing;
  }

  const created: LiabilityItemState = {
    id: `liability-${hashText(name)}`,
    name,
    tag: "账单跟踪",
    description: "由录入自动生成",
    dueAmount: formatCurrency(0),
    numericDueAmount: 0,
    alert: false
  };
  states.set(name, created);
  return created;
}

function ensureDefaultLiabilityStates(
  states: Map<string, LiabilityItemState>
) {
  for (const item of DEFAULT_LIABILITY_ITEMS) {
    const existing = states.get(item.name);
    if (existing) {
      continue;
    }

    states.set(item.name, {
      id: `liability-${hashText(item.name)}`,
      name: item.name,
      tag: item.tag,
      description: item.description,
      dueAmount: formatCurrency(item.amount),
      numericDueAmount: item.amount,
      alert: false
    });
  }
}

function ensureInvestmentItem(
  states: Map<string, InvestmentItemState>,
  name: string
) {
  const existing = states.get(name);
  if (existing) {
    return existing;
  }

  const created: InvestmentItemState = {
    id: `investment-${hashText(name)}`,
    name,
    tag: "自定义理财",
    description: "由录入自动生成",
    amount: formatCurrency(0),
    numericAmount: 0
  };
  states.set(name, created);
  return created;
}

function resolveContainerKind(
  name: string,
  fundAccounts: Map<string, FundAccountState>,
  liabilities: Map<string, LiabilityItemState>,
  investments: Map<string, InvestmentItemState>
) {
  if (liabilities.has(name)) {
    return "liability";
  }

  if (investments.has(name)) {
    return "investment";
  }

  if (fundAccounts.has(resolveFundAccountName(name, fundAccounts))) {
    return "fund";
  }

  return "fund";
}

function resolveFundAccountName(
  name: string,
  fundAccounts: Map<string, FundAccountState>
) {
  if (fundAccounts.has(name)) {
    return name;
  }

  const candidates = [name];


  if (!name.endsWith("余额")) {
    candidates.push(`${name}余额`);
  }

  if (!name.endsWith("钱包")) {
    candidates.push(`${name}钱包`);
  }

  for (const candidate of candidates) {
    if (fundAccounts.has(candidate)) {
      return candidate;
    }
  }

  return name;
}

function updateRankState(
  states: Map<string, RankItemState>,
  name: string,
  delta: number
) {
  const existing = states.get(name);
  if (existing) {
    existing.amount += delta;
    return;
  }

  states.set(name, {
    id: `rank-${hashText(name)}`,
    name,
    amount: delta
  });
}

function updateCashFlowState(
  states: Map<string, FinanceDashboardViewModel["cashFlow"][number]>,
  label: string,
  field: "income" | "expense" | "balance",
  delta: number
) {
  const existing = states.get(label);
  if (existing) {
    existing[field] += delta;
    return;
  }

  states.set(label, {
    id: `cashflow-${hashText(label)}`,
    label,
    income: field === "income" ? delta : 0,
    expense: field === "expense" ? delta : 0,
    balance: field === "balance" ? delta : 0
  });
}

function buildFundAccounts(
  baseItems: FinanceDashboardViewModel["fundAccounts"],
  states: Map<string, FundAccountState>
) {
  const orderedNames = [
    ...baseItems.map((item) => item.name),
    ...Array.from(states.keys()).filter(
      (name) => !baseItems.some((item) => item.name === name)
    )
  ];
  const orderLookup = new Map(
    orderedNames.map((name, index) => [name, index])
  );

  return orderedNames
    .map((name) => states.get(name))
    .filter((item): item is FundAccountState => Boolean(item))
    .sort((left, right) => {
      if (right.numericBalance !== left.numericBalance) {
        return right.numericBalance - left.numericBalance;
      }

      return (orderLookup.get(left.name) ?? 0) - (orderLookup.get(right.name) ?? 0);
    })
    .map((item) => {
      const { numericBalance, ...rest } = item;

      return {
        ...rest,
        balance: formatCurrency(numericBalance)
      };
    });
}

function buildLiabilityItems(
  baseItems: FinanceDashboardViewModel["liabilities"]["items"],
  states: Map<string, LiabilityItemState>
) {
  const orderedNames = [
    ...baseItems.map((item) => item.name),
    ...Array.from(states.keys()).filter(
      (name) => !baseItems.some((item) => item.name === name)
    )
  ];

  return orderedNames
    .map((name) => states.get(name))
    .filter((item): item is LiabilityItemState => Boolean(item))
    .map((item) => {
      const { numericDueAmount, ...rest } = item;
      return {
        ...rest,
        dueAmount: formatCurrency(numericDueAmount),
        alert: rest.alert || numericDueAmount >= 3000
      };
    });
}

function buildInvestmentItems(
  baseItems: FinanceDashboardViewModel["investments"]["items"],
  states: Map<string, InvestmentItemState>
) {
  const orderedNames = [
    ...baseItems.map((item) => item.name),
    ...Array.from(states.keys()).filter(
      (name) => !baseItems.some((item) => item.name === name)
    )
  ];

  return orderedNames
    .map((name) => states.get(name))
    .filter((item): item is InvestmentItemState => Boolean(item))
    .map((item) => {
      const { numericAmount, ...rest } = item;
      return {
        ...rest,
        amount: formatCurrency(numericAmount)
      };
    });
}

function ensureRiskInvestmentStates(
  states: Map<string, InvestmentItemState>
) {
  const defaults: Array<{
    name: string;
    tag: string;
    description: string;
    amount: number;
  }> = [
    {
      name: "股票仓位",
      tag: "高风险",
      description: "主动仓位 · 波动较大",
      amount: 22400
    },
    {
      name: "加密资产",
      tag: "高波动",
      description: "BTC / ETH · 高风险试验仓",
      amount: 8750
    }
  ];

  for (const item of defaults) {
    if (states.has(item.name)) {
      continue;
    }

    states.set(item.name, {
      id: `investment-${hashText(item.name)}`,
      name: item.name,
      tag: item.tag,
      description: item.description,
      amount: formatCurrency(item.amount),
      numericAmount: item.amount
    });
  }
}

function applyBalanceAdjustments(
  fundAccounts: Map<string, FundAccountState>,
  liabilities: Map<string, LiabilityItemState>,
  investments: Map<string, InvestmentItemState>,
  adjustments: FinanceBalanceSettings,
  accountMergeRules: FinanceAccountMergeRule[]
) {
  for (const item of adjustments.fundAccounts) {
    const accountName = resolveConfiguredFinanceAccountName(
      item.name,
      accountMergeRules
    );
    ensureFundAccount(fundAccounts, accountName).numericBalance += item.amount;
  }

  for (const item of adjustments.liabilities) {
    const liability = ensureLiabilityItem(liabilities, item.name);
    liability.numericDueAmount = Math.max(
      0,
      roundMoney(liability.numericDueAmount + item.amount)
    );
  }

  for (const item of adjustments.investments) {
    const investment = ensureInvestmentItem(investments, item.name);
    investment.numericAmount = Math.max(
      0,
      roundMoney(investment.numericAmount + item.amount)
    );
  }
}

function mergeConfiguredInvestmentAccounts(
  fundAccounts: Map<string, FundAccountState>,
  investments: Map<string, InvestmentItemState>,
  accountMergeRules: FinanceAccountMergeRule[]
) {
  for (const rule of accountMergeRules) {
    const sourceInvestment = investments.get(rule.sourceInvestmentName);
    if (!sourceInvestment) {
      continue;
    }

    const targetAccount = ensureFundAccount(
      fundAccounts,
      rule.targetAccountName
    );
    targetAccount.numericBalance = roundMoney(
      targetAccount.numericBalance + sourceInvestment.numericAmount
    );

    if (rule.description) {
      targetAccount.description = rule.description;
    }

    investments.delete(rule.sourceInvestmentName);
  }
}

function normalizeCaptureRegistries(
  registries: FinanceCaptureRegistries,
  accountMergeRules: FinanceAccountMergeRule[]
) {
  const mergedInvestmentNames = new Set(
    accountMergeRules.map((rule) => rule.sourceInvestmentName)
  );

  return {
    expense: registries.expense.filter(
      (item) => !mergedInvestmentNames.has(item)
    ),
    income: registries.income.filter(
      (item) => !mergedInvestmentNames.has(item)
    ),
    transfer: registries.transfer.filter(
      (item) => !mergedInvestmentNames.has(item)
    )
  };
}

function sumFundAccountBalances(states: Map<string, FundAccountState>) {
  return Array.from(states.values()).reduce(
    (total, item) => total + item.numericBalance,
    0
  );
}

function sumLiabilityAmounts(states: Map<string, LiabilityItemState>) {
  return Array.from(states.values()).reduce(
    (total, item) => total + item.numericDueAmount,
    0
  );
}

function sumInvestmentAmounts(states: Map<string, InvestmentItemState>) {
  return Array.from(states.values()).reduce(
    (total, item) => total + item.numericAmount,
    0
  );
}

function buildRankItems(states: Map<string, RankItemState>) {
  const items = Array.from(states.values())
    .filter((item) => item.amount > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    amount: formatCurrency(item.amount),
    ratio: total > 0 ? item.amount / total : 0
  }));
}

function buildCashFlowItems(
  states: Map<string, FinanceDashboardViewModel["cashFlow"][number]>
) {
  return Array.from(states.values())
    .sort((left, right) => left.label.localeCompare(right.label))
    .slice(-8)
    .map((item) => ({
      ...item,
      income: roundMoney(item.income),
      expense: roundMoney(item.expense),
      balance: roundMoney(item.balance)
    }));
}

function buildActionItems(
  baseItems: FinanceActionItem[],
  customItems: FinanceActionItem[],
  dismissedItemIds: string[]
) {
  const dismissed = new Set(dismissedItemIds);
  const merged = [...customItems, ...baseItems];
  const seen = new Set<string>();

  return merged.filter((item) => {
    if (dismissed.has(item.id)) {
      return false;
    }

    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

function buildRecentFlows(
  baseFlows: FinanceRecentFlow[],
  legacyRecentFlows: FinanceRecentFlow[],
  activeEntries: FinanceLedgerEntry[]
) {
  const merged = [
    ...activeEntries.map((entry) => createRecentFlowFromEntry(entry)),
    ...legacyRecentFlows,
    ...baseFlows
  ];
  const seen = new Set<string>();

  return merged
    .filter((flow) => {
      if (seen.has(flow.id)) {
        return false;
      }

      seen.add(flow.id);
      return true;
    })
    .sort((left, right) =>
      `${right.date}-${right.id}`.localeCompare(`${left.date}-${left.id}`)
    )
    .slice(0, 60);
}

function parseOverviewValue(
  dashboard: FinanceDashboardViewModel,
  id: string
) {
  return parseCurrency(
    dashboard.overview.find((item) => item.id === id)?.value ?? "0"
  );
}

function parseAssetTotalFromNetAssetNote(note: string) {
  const match = note.match(/总资产\s*¥?([\d,]+(?:\.\d{1,2})?)/);
  return match ? parseCurrency(match[1]) : null;
}

void parseAssetTotalFromNetAssetNote;

function parseCurrency(value: string) {
  const normalized = value.replace(/[^\d.-]/g, "");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseSignedCurrency(value: string) {
  return parseCurrency(value.startsWith("-") ? value : value.replace("+", ""));
}

function formatCurrency(value: number) {
  return `¥${formatMoney(roundMoney(value))}`;
}

function formatSignedCurrency(value: number) {
  const prefix = value >= 0 ? "+" : "-";
  return `${prefix}¥${formatMoney(Math.abs(roundMoney(value)))}`;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function getEntryCreatedAt(entry: FinanceLedgerEntry) {
  const match = entry.id.match(/-(\d{10,})$/);
  if (!match) {
    return 0;
  }

  const numeric = Number(match[1]);
  return Number.isFinite(numeric) ? numeric : 0;
}

function hashText(text: string) {
  let hash = 0;
  for (const character of text) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash.toString(16);
}
