export type CaptureMode = "quick" | "natural";
export type CaptureDirection = "expense" | "income" | "transfer";

export type FinanceAccountType =
  | "bank"
  | "wallet"
  | "cash"
  | "savings"
  | "transfer";

export type LiabilityType = "credit_card" | "loan" | "other";

export type FinanceCaptureCategories = Record<CaptureDirection, string[]>;
export type FinanceCaptureRegistries = Record<CaptureDirection, string[]>;

export type FinanceCaptureOption = {
  value: CaptureDirection;
  label: string;
};

export type FinanceCaptureConfig = {
  directions: FinanceCaptureOption[];
  categories: FinanceCaptureCategories;
  registries: FinanceCaptureRegistries;
  assistantExamples: string[];
};

export type FinanceCaptureDraft = {
  direction: CaptureDirection;
  amountInput: string;
  category: string;
  channelAccount: string;
  targetAccount: string;
  note: string;
  customRegistryName: string;
  naturalText: string;
};

export type FinanceRecentFlow = {
  id: string;
  date: string;
  label: string;
  description: string;
  amount: string;
  direction: CaptureDirection;
};

export type FinanceActionItem = {
  id: string;
  label: string;
  tag: string;
  description: string;
  dueDate: string;
};

export type FinanceDashboardViewModel = {
  periodLabel: string;
  capture: FinanceCaptureConfig;
  overview: Array<{
    id: string;
    label: string;
    value: string;
    note: string;
    hero?: boolean;
  }>;
  fundAccounts: Array<{
    id: string;
    name: string;
    tag: string;
    description: string;
    balance: string;
    type?: FinanceAccountType;
  }>;
  budget: {
    used: number;
    total: number;
    ratio: number;
    label: string;
  };
  liabilities: {
    total: string;
    dueThisMonth: string;
    items: Array<{
      id: string;
      name: string;
      tag: string;
      description: string;
      dueAmount: string;
      type?: LiabilityType;
      alert?: boolean;
    }>;
  };
  actionItems: FinanceActionItem[];
  incomeSources: Array<{
    id: string;
    name: string;
    amount: string;
    ratio: number;
  }>;
  cashFlow: Array<{
    id: string;
    label: string;
    income: number;
    expense: number;
    balance: number;
  }>;
  netAssetSnapshots: Array<{
    id: string;
    label: string;
    value: string;
    delta: string;
  }>;
  investments: {
    total: string;
    pnl: string;
    items: Array<{
      id: string;
      name: string;
      tag: string;
      description: string;
      amount: string;
    }>;
  };
  categories: Array<{
    id: string;
    name: string;
    amount: string;
    ratio: number;
  }>;
  paymentChannels: Array<{
    id: string;
    name: string;
    amount: string;
    ratio: number;
  }>;
  recentFlows: FinanceRecentFlow[];
};

export type ParsedNaturalCapture = {
  direction: CaptureDirection;
  amountInput: string;
  category: string;
  channelAccount: string;
  targetAccount: string;
  note: string;
};

export function createCaptureDraft(
  config: FinanceCaptureConfig,
  direction: CaptureDirection = "expense"
): FinanceCaptureDraft {
  return {
    direction,
    amountInput: "",
    category: config.categories[direction][0] ?? "",
    channelAccount: config.registries[direction][0] ?? "",
    targetAccount:
      direction === "transfer"
        ? getAlternateRegistryOption(config.registries.transfer, config.registries.transfer[0] ?? "")
        : "",
    note: "",
    customRegistryName: "",
    naturalText: config.assistantExamples[0] ?? ""
  };
}

export function getCaptureFieldLabels(direction: CaptureDirection) {
  if (direction === "income") {
    return {
      channelLabel: "入账账户",
      targetLabel: "目标账户",
      submitLabel: "记录这笔收入",
      customRegistryLabel: "新增入账账户"
    };
  }

  if (direction === "transfer") {
    return {
      channelLabel: "转出账户",
      targetLabel: "转入账户",
      submitLabel: "记录这次划转",
      customRegistryLabel: "新增账户"
    };
  }

  return {
    channelLabel: "支付渠道",
    targetLabel: "转入账户",
    submitLabel: "记录这笔支出",
    customRegistryLabel: "新增支付渠道"
  };
}

export function ensureCaptureDraft(
  draft: FinanceCaptureDraft,
  config: FinanceCaptureConfig,
  direction = draft.direction
): FinanceCaptureDraft {
  const category = ensureOption(draft.category, config.categories[direction]);
  const channelAccount = ensureOption(draft.channelAccount, config.registries[direction]);
  const targetAccount =
    direction === "transfer"
      ? ensureTransferTarget(
          draft.targetAccount,
          config.registries.transfer,
          channelAccount
        )
      : "";

  return {
    ...draft,
    direction,
    category,
    channelAccount,
    targetAccount
  };
}

export function addRegistryItem(
  registries: FinanceCaptureRegistries,
  direction: CaptureDirection,
  value: string
) {
  const trimmed = value.trim();
  if (!trimmed) {
    return registries;
  }

  if (registries[direction].includes(trimmed)) {
    return registries;
  }

  return {
    ...registries,
    [direction]: [...registries[direction], trimmed]
  };
}

export function parseNaturalCaptureInput(
  raw: string,
  config: FinanceCaptureConfig
): ParsedNaturalCapture | null {
  const text = raw.trim();
  if (!text) {
    return null;
  }

  const direction = detectDirection(text);
  const amountMatch = text.match(/(\d+(?:\.\d{1,2})?)/);
  const amountInput = amountMatch?.[1] ?? "";
  const category = detectCategory(text, direction, config.categories);
  const mentionedRegistries =
    direction === "transfer"
      ? detectMentionedRegistries(text, config.registries.transfer)
      : [];
  const channelAccount =
    direction === "transfer"
      ? mentionedRegistries[0] ?? config.registries.transfer[0] ?? ""
      : detectRegistry(text, direction, config.registries);
  const targetAccount =
    direction === "transfer"
      ? mentionedRegistries[1] ??
        getAlternateRegistryOption(config.registries.transfer, channelAccount)
      : "";
  const note = amountMatch
    ? text.replace(amountMatch[1], "").trim() || category
    : text;

  return {
    direction,
    amountInput,
    category,
    channelAccount,
    targetAccount,
    note
  };
}

export function createRecentFlowFromDraft(
  draft: FinanceCaptureDraft,
  dateLabel: string
): FinanceRecentFlow | null {
  const amount = Number(draft.amountInput);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const safeNote = draft.note.trim() || draft.category;
  const description =
    draft.direction === "transfer"
      ? `${draft.category} · ${draft.channelAccount} → ${draft.targetAccount} · 刚刚划转`
      : `${draft.category} · ${draft.channelAccount} · ${
          draft.direction === "income" ? "刚刚入账" : "刚刚支出"
        }`;

  const amountPrefix =
    draft.direction === "income"
      ? "+¥"
      : draft.direction === "transfer"
        ? "→¥"
        : "-¥";

  return {
    id: `flow-${Date.now()}`,
    date: dateLabel,
    label: safeNote,
    description,
    amount: `${amountPrefix}${formatMoney(amount)}`,
    direction: draft.direction
  };
}

export function formatMoney(value: number) {
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function detectDirection(text: string): CaptureDirection {
  if (text.includes("退款回卡")) return "transfer";

  if (
    text.includes("工资") ||
    text.includes("收入") ||
    text.includes("副业") ||
    text.includes("红包") ||
    text.includes("返现") ||
    text.includes("利息") ||
    text.includes("收益") ||
    text.includes("退款收入") ||
    text.includes("退款") ||
    text.includes("报销") ||
    text.includes("到账")
  ) {
    return "income";
  }

  if (
    text.includes("转账") ||
    text.includes("划转") ||
    text.includes("还款") ||
    text.includes("转到") ||
    text.includes("转入") ||
    text.includes("转去") ||
    text.includes("转给自己") ||
    text.includes("提现到") ||
    (text.includes("提现") && !text.includes("收入"))
  ) {
    return "transfer";
  }

  return "expense";
}

function detectCategory(
  text: string,
  direction: CaptureDirection,
  categories: FinanceCaptureCategories
) {
  if (direction === "transfer") {
    if (text.includes("还款")) return "信用卡还款";
    if (text.includes("理财")) return "储蓄转理财";
    if (text.includes("提现")) return "提现";
    if (text.includes("退款")) return "退款回卡";
    return "账户划转";
  }

  if (direction === "income") {
    if (text.includes("工资")) return "工资";
    if (text.includes("副业")) return "副业";
    if (text.includes("红包") || text.includes("返现")) return "红包";
    if (text.includes("退款")) return "退款";
    if (text.includes("报销")) return "报销";
    if (text.includes("利息") || text.includes("收益")) return "理财收益";
    return categories.income[categories.income.length - 1] ?? "其他收入";
  }

  if (text.includes("车") || text.includes("打车")) return "交通";
  if (text.includes("咖啡") || text.includes("饭") || text.includes("外卖")) return "餐饮";
  if (text.includes("房租")) return "居住";
  if (text.includes("超市") || text.includes("补货")) return "日用";
  return categories.expense[categories.expense.length - 1] ?? "其他支出";
}

function detectRegistry(
  text: string,
  direction: CaptureDirection,
  registries: FinanceCaptureRegistries
) {
  const matched = Array.from(
    new Set([
      ...registries.expense,
      ...registries.income,
      ...registries.transfer
    ])
  ).find((registry) => text.includes(registry));

  if (matched) {
    return matched;
  }

  if (direction === "transfer") {
    return registries.transfer[0] ?? "";
  }

  if (text.includes("银行卡") || text.includes("卡")) {
    return direction === "income"
      ? registries.income[0] ?? ""
      : registries.expense[0] ?? "";
  }

  if (text.includes("现金")) {
    return "现金";
  }

  return registries[direction][0] ?? "";
}

function detectMentionedRegistries(text: string, registries: string[]) {
  return registries
    .map((name) => ({ name, index: text.indexOf(name) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.name);
}

function ensureOption(value: string, options: string[]) {
  if (value && options.includes(value)) {
    return value;
  }

  return options[0] ?? "";
}

function ensureTransferTarget(
  value: string,
  options: string[],
  source: string
) {
  if (value && value !== source && options.includes(value)) {
    return value;
  }

  return getAlternateRegistryOption(options, source);
}

function getAlternateRegistryOption(options: string[], source: string) {
  return options.find((option) => option !== source) ?? source;
}
