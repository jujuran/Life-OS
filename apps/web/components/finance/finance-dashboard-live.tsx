"use client";

import { useState, type FormEvent } from "react";
import { FinanceLedgerWorkbench, sortEntriesDescending } from "./finance-ledger-workbench";
import {
  addRegistryItem,
  createCaptureDraft,
  createLedgerEntryFromDraft,
  ensureCaptureDraft,
  getCaptureFieldLabels,
  parseNaturalCaptureInput,
  type FinanceBalanceSettings,
  type CaptureMode,
  type CaptureDirection,
  type FinanceActionItem,
  type FinanceDashboardViewModel,
  type FinanceLedgerEntry
} from "@life-os/domain/finance-model";

type FinanceDashboardLiveProps = {
  data: FinanceDashboardViewModel;
  entries: FinanceLedgerEntry[];
  initialDirection?: CaptureDirection;
  initialMode?: CaptureMode;
  initialPanel?: "settings" | "actions" | "records";
};

type DashboardMutationResponse = {
  ok: true;
  dashboard: FinanceDashboardViewModel;
};

type BalanceSettingsSectionKey = "fundAccounts" | "liabilities" | "investments";

type BalanceSettingsRow = {
  name: string;
  description: string;
  amountInput: string;
};

type BalanceSettingsDraft = Record<BalanceSettingsSectionKey, BalanceSettingsRow[]>;

type StatusTone = "default" | "success" | "error";
const RECENT_FLOWS_PAGE_SIZE = 6;
const ACTION_ITEM_TEMPLATES = [
  {
    label: "信用卡还款",
    description: "确认本期账单金额和还款账户。"
  },
  {
    label: "报销到账确认",
    description: "核对报销是否已经回到入账账户。"
  },
  {
    label: "房租与固定支出",
    description: "确认本月固定支出是否已经记录。"
  },
  {
    label: "理财到期检查",
    description: "确认到期产品是否需要续投或赎回。"
  }
] as const;

function getCashFlowBars(
  points: FinanceDashboardViewModel["cashFlow"],
  width = 620,
  height = 176
) {
  const safePoints = points.length
    ? points
    : [{ id: "empty", label: "--", income: 0, expense: 0, balance: 0 }];
  const baselineY = Math.round(height / 2);
  const maxIncome = Math.max(...safePoints.map((point) => point.income), 1);
  const maxExpense = Math.max(...safePoints.map((point) => point.expense), 1);
  const balanceMax = Math.max(
    ...safePoints.map((point) => Math.abs(point.balance)),
    1
  );
  const step = width / safePoints.length;
  const barWidth = Math.max(18, Math.round(step * 0.36));

  const bars = safePoints.map((point, index) => {
    const groupCenter = step * index + step / 2;
    const x = Math.round(groupCenter - barWidth / 2);
    const incomeHeight =
      point.income > 0 ? Math.max(8, Math.round((point.income / maxIncome) * 70)) : 0;
    const expenseHeight =
      point.expense > 0 ? Math.max(8, Math.round((point.expense / maxExpense) * 56)) : 0;
    const balanceY = baselineY - (point.balance / balanceMax) * 34;

    return {
      ...point,
      x,
      barWidth,
      centerX: groupCenter,
      hitX: step * index,
      hitWidth: step,
      incomeHeight,
      expenseHeight,
      incomeY: baselineY - incomeHeight,
      expenseY: baselineY,
      balanceY
    };
  });

  const balancePath = safePoints
    .map((point, index) => {
      const groupCenter = step * index + step / 2;
      const y = baselineY - (point.balance / balanceMax) * 34;
      return `${index === 0 ? "M" : "L"} ${groupCenter.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return {
    bars,
    baselineY,
    balancePath,
    width,
    height
  };
}

function getBudgetWidth(ratio: number) {
  return `${Math.min(Math.max(ratio, 0), 1) * 100}%`;
}

function getRankWidth(ratio: number) {
  return `${Math.min(Math.max(ratio, 0), 1) * 100}%`;
}

function getDirectionLabel(
  directions: FinanceDashboardViewModel["capture"]["directions"],
  direction: CaptureDirection
) {
  return directions.find((item) => item.value === direction)?.label ?? direction;
}

function getToggleHref(direction: CaptureDirection, mode: CaptureMode) {
  return `/finance?direction=${direction}&mode=${mode}#capture`;
}

function getPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, 5];
  }

  if (currentPage >= totalPages - 2) {
    return Array.from({ length: 5 }, (_, index) => totalPages - 4 + index);
  }

  return Array.from({ length: 5 }, (_, index) => currentPage - 2 + index);
}

function formatLegacyCurrencyValue(value: number) {
  return `¥${value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

void formatLegacyCurrencyValue;

function formatCurrencyValue(value: number) {
  return `\u00A5${value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function createBalanceSettingsDraft(
  dashboard: FinanceDashboardViewModel
): BalanceSettingsDraft {
  return {
    fundAccounts: dashboard.fundAccounts.map((item) => ({
      name: item.name,
      description: item.description,
      amountInput: normalizeAmountInput(item.balance)
    })),
    liabilities: dashboard.liabilities.items.map((item) => ({
      name: item.name,
      description: item.description,
      amountInput: normalizeAmountInput(item.dueAmount)
    })),
    investments: dashboard.investments.items.map((item) => ({
      name: item.name,
      description: item.description,
      amountInput: normalizeAmountInput(item.amount)
    }))
  };
}

function normalizeAmountInput(value: string) {
  const normalized = value.replace(/[^\d.-]/g, "");
  if (!normalized) {
    return "0.00";
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "0.00";
}

function parseAmountInput(value: string) {
  const normalized = value.replace(/[^\d.-]/g, "");
  if (!normalized.trim()) {
    return 0;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : null;
}

function formatActionDueDate(value: string) {
  if (!value) {
    return "";
  }

  const parts = value.split("-");
  if (parts.length !== 3) {
    return value;
  }

  return `${parts[1]}-${parts[2]}`;
}

function getActionTag(value: string) {
  if (!value) {
    return "待安排";
  }

  const now = new Date();
  const due = new Date(`${value}T00:00:00`);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) {
    return "尽快";
  }

  if (diffDays <= 7) {
    return "本周";
  }

  return "本月";
}

export function FinanceDashboardLive({
  data,
  entries,
  initialDirection = "expense",
  initialMode = "quick",
  initialPanel
}: FinanceDashboardLiveProps) {
  const [dashboard, setDashboard] = useState(data);
  const [ledgerEntries, setLedgerEntries] = useState(() =>
    sortEntriesDescending(entries)
  );
  const [mode, setMode] = useState<CaptureMode>(initialMode);
  const [draft, setDraft] = useState(() =>
    createCaptureDraft(data.capture, initialDirection)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAction, setIsSavingAction] = useState(false);
  const [isActionComposerOpen, setIsActionComposerOpen] = useState(
    initialPanel === "actions"
  );
  const [isLedgerOpen, setIsLedgerOpen] = useState(initialPanel === "records");
  const [isSettingsOpen, setIsSettingsOpen] = useState(initialPanel === "settings");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [completingActionId, setCompletingActionId] = useState<string | null>(null);
  const [hoveredCashFlowId, setHoveredCashFlowId] = useState<string | null>(null);
  const [recentFlowPage, setRecentFlowPage] = useState(1);
  const [actionLabel, setActionLabel] = useState("");
  const [actionDueDate, setActionDueDate] = useState("");
  const [actionDescription, setActionDescription] = useState("");
  const [settingsDraft, setSettingsDraft] = useState(() =>
    createBalanceSettingsDraft(data)
  );
  const [statusMessage, setStatusMessage] = useState(
    "结构化录入已启用，类型和账户由你确认，保存后首页会联动刷新。"
  );
  const [statusTone, setStatusTone] = useState<StatusTone>("default");

  const captureConfig = dashboard.capture;
  const visibleCashFlowPoints = dashboard.cashFlow.slice(-7);
  const chart = getCashFlowBars(visibleCashFlowPoints);
  const categories = captureConfig.categories[draft.direction];
  const currentRegistries = captureConfig.registries[draft.direction];
  const labels = getCaptureFieldLabels(draft.direction);
  const parsedNatural = parseNaturalCaptureInput(draft.naturalText, captureConfig);
  const recentFlowPageCount = Math.max(
    1,
    Math.ceil(dashboard.recentFlows.length / RECENT_FLOWS_PAGE_SIZE)
  );
  const activeRecentFlowPage = Math.min(recentFlowPage, recentFlowPageCount);
  const recentFlowPageNumbers = getPageNumbers(
    activeRecentFlowPage,
    recentFlowPageCount
  );
  const visibleRecentFlows = dashboard.recentFlows.slice(
    (activeRecentFlowPage - 1) * RECENT_FLOWS_PAGE_SIZE,
    activeRecentFlowPage * RECENT_FLOWS_PAGE_SIZE
  );
  const visibleFundAccounts = dashboard.fundAccounts;
  const topLiabilities = dashboard.liabilities.items.slice(0, 5);
  const topInvestments = dashboard.investments.items.slice(0, 5);
  const topCategories = dashboard.categories.slice(0, 5);
  const topIncomeSources = dashboard.incomeSources.slice(0, 5);
  const topPaymentChannels = dashboard.paymentChannels.slice(0, 5);
  const topActionItems = dashboard.actionItems.slice(0, 6);
  const actionItemCount = dashboard.actionItems.length;
  const cashFlowTotals = visibleCashFlowPoints.reduce(
    (summary, point) => {
      summary.income += point.income;
      summary.expense += point.expense;
      return summary;
    },
    { income: 0, expense: 0 }
  );
  const netCashBalance = cashFlowTotals.income - cashFlowTotals.expense;
  const peakExpensePoint = visibleCashFlowPoints.reduce<
    FinanceDashboardViewModel["cashFlow"][number] | null
  >((selected, point) => {
    if (!selected || point.expense > selected.expense) {
      return point;
    }

    return selected;
  }, null);
  const hoveredCashFlowPoint =
    chart.bars.find((bar) => bar.id === hoveredCashFlowId) ?? null;
  const cashFlowReadout = hoveredCashFlowPoint
    ? `${hoveredCashFlowPoint.label} | 收 ${formatCurrencyValue(
        hoveredCashFlowPoint.income
      )} | 支 ${formatCurrencyValue(hoveredCashFlowPoint.expense)} | 结 ${formatCurrencyValue(
        hoveredCashFlowPoint.balance
      )}`
    : "\u00A0";

  function setDraftSafely(nextDraft: typeof draft) {
    setDraft(ensureCaptureDraft(nextDraft, captureConfig));
  }

  function closeActionComposer() {
    setIsActionComposerOpen(false);
    setActionLabel("");
    setActionDueDate("");
    setActionDescription("");
  }

  function closeSettings() {
    setIsSettingsOpen(false);
  }

  function closeLedger() {
    setIsLedgerOpen(false);
  }

  function updateSettingsRow(
    section: BalanceSettingsSectionKey,
    index: number,
    amountInput: string
  ) {
    setSettingsDraft((current) => ({
      ...current,
      [section]: current[section].map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              amountInput
            }
          : item
      )
    }));
  }

  function applyActionTemplate(label: string, description: string) {
    setActionLabel(label);
    setActionDescription(description);
  }

  async function postFinanceJson<T>(
    url: string,
    payload: unknown,
    method: "POST" | "DELETE" = "POST"
  ): Promise<T> {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  async function handleAddActionItem() {
    const trimmedLabel = actionLabel.trim();
    const trimmedDescription = actionDescription.trim();

    if (!trimmedLabel || !actionDueDate) {
      setStatusMessage("待处理事项至少需要标题和日期。");
      setStatusTone("error");
      return;
    }

    const item: FinanceActionItem = {
      id: `action-${Date.now()}`,
      label: trimmedLabel,
      tag: getActionTag(actionDueDate),
      description: trimmedDescription || "手动添加的待处理事项",
      dueDate: formatActionDueDate(actionDueDate)
    };

    setIsSavingAction(true);

    try {
      const result = await postFinanceJson<DashboardMutationResponse>(
        "/api/finance/action-items",
        {
          periodLabel: dashboard.periodLabel,
          item
        }
      );

      setDashboard(result.dashboard);
      closeActionComposer();
      setStatusMessage(`已加入待处理事项：${trimmedLabel}`);
      setStatusTone("success");
    } catch {
      setStatusMessage("待处理事项保存失败了，请稍后再试。");
      setStatusTone("error");
    } finally {
      setIsSavingAction(false);
    }
  }

  async function handleCompleteActionItem(itemId: string, label: string) {
    setCompletingActionId(itemId);

    try {
      const result = await postFinanceJson<DashboardMutationResponse>(
        "/api/finance/action-items",
        {
          periodLabel: dashboard.periodLabel,
          itemId
        },
        "DELETE"
      );

      setDashboard(result.dashboard);
      setStatusMessage(`已处理待办事项：${label}`);
      setStatusTone("success");
    } catch {
      setStatusMessage("待处理事项更新失败了，请稍后再试。");
      setStatusTone("error");
    } finally {
      setCompletingActionId(null);
    }
  }

  async function handleSaveBalanceSettings() {
    const sections: BalanceSettingsSectionKey[] = [
      "fundAccounts",
      "liabilities",
      "investments"
    ];
    const settings = {
      fundAccounts: [],
      liabilities: [],
      investments: []
    } as FinanceBalanceSettings;

    for (const section of sections) {
      for (const row of settingsDraft[section]) {
        const amount = parseAmountInput(row.amountInput);

        if (amount === null) {
          setStatusMessage(`请检查 ${row.name} 的金额格式。`);
          setStatusTone("error");
          return;
        }

        settings[section].push({
          name: row.name,
          amount
        });
      }
    }

    setIsSavingSettings(true);

    try {
      const result = await postFinanceJson<DashboardMutationResponse>(
        "/api/finance/settings",
        {
          periodLabel: dashboard.periodLabel,
          settings
        }
      );

      setDashboard(result.dashboard);
      setSettingsDraft(createBalanceSettingsDraft(result.dashboard));
      setIsSettingsOpen(false);
      setStatusMessage("期初与当前余额已更新，首页数据已联动刷新。");
      setStatusTone("success");
    } catch {
      setStatusMessage("余额设置保存失败了，请稍后再试。");
      setStatusTone("error");
    } finally {
      setIsSavingSettings(false);
    }
  }

  function updateDirection(nextDirection: CaptureDirection) {
    setDraft((current) =>
      ensureCaptureDraft(
        {
          ...current,
          direction: nextDirection
        },
        captureConfig,
        nextDirection
      )
    );
    setStatusMessage("已切换录入方向，请确认分类和账户。");
    setStatusTone("default");
  }

  async function handleAddRegistry() {
    const trimmed = draft.customRegistryName.trim();
    if (!trimmed) {
      setStatusMessage(
        draft.direction === "transfer" ? "请输入账户名称。" : "请输入渠道名称。"
      );
      setStatusTone("error");
      return;
    }

    const updatedRegistries = addRegistryItem(
      captureConfig.registries,
      draft.direction,
      trimmed
    );

    setIsSaving(true);

    try {
      const result = await postFinanceJson<DashboardMutationResponse>(
        "/api/finance/registries",
        {
          periodLabel: dashboard.periodLabel,
          registries: updatedRegistries
        }
      );

      setDashboard(result.dashboard);
      setRecentFlowPage(1);
      setDraft(
        ensureCaptureDraft(
          {
            ...draft,
            channelAccount: trimmed,
            customRegistryName: ""
          },
          result.dashboard.capture
        )
      );
      setStatusMessage(
        draft.direction === "transfer"
          ? `已添加账户：${trimmed}`
          : `已添加渠道：${trimmed}`
      );
      setStatusTone("success");
    } catch {
      setStatusMessage("渠道保存失败了，请稍后再试。");
      setStatusTone("error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const safeDraft = ensureCaptureDraft(draft, captureConfig);
    const amount = Number(safeDraft.amountInput);

    if (!Number.isFinite(amount) || amount <= 0) {
      setStatusMessage("请输入有效金额。");
      setStatusTone("error");
      return;
    }

    if (
      safeDraft.direction === "transfer" &&
      safeDraft.channelAccount === safeDraft.targetAccount
    ) {
      setStatusMessage("转出账户和转入账户不能相同。");
      setStatusTone("error");
      return;
    }

    const entry = createLedgerEntryFromDraft(safeDraft, dashboard.periodLabel);
    if (!entry) {
      setStatusMessage("这笔记录暂时没生成成功，请检查金额和字段。");
      setStatusTone("error");
      return;
    }

    setIsSaving(true);

    try {
      const result = await postFinanceJson<DashboardMutationResponse>(
        "/api/finance/entries",
        {
          periodLabel: dashboard.periodLabel,
          entry
        }
      );

      setDashboard(result.dashboard);
      setLedgerEntries((current) =>
        sortEntriesDescending([
          entry,
          ...current.filter((currentEntry) => currentEntry.id !== entry.id)
        ])
      );
      setDraft({
        ...createCaptureDraft(result.dashboard.capture, safeDraft.direction),
        naturalText: draft.naturalText
      });
      setStatusMessage(
        safeDraft.direction === "income"
          ? "收入已记录。"
          : safeDraft.direction === "transfer"
            ? "划转已记录。"
            : "支出已记录。"
      );
      setStatusTone("success");
    } catch {
      setStatusMessage("这笔记录没保存下来，请稍后再试。");
      setStatusTone("error");
    } finally {
      setIsSaving(false);
    }
  }

  function handleApplyNatural() {
    if (!parsedNatural || !parsedNatural.amountInput) {
      setStatusMessage("自然语言里还没识别到有效金额。");
      setStatusTone("error");
      return;
    }

    setDraft(
      ensureCaptureDraft(
        {
          ...draft,
          ...parsedNatural,
          naturalText: draft.naturalText
        },
        captureConfig,
        parsedNatural.direction
      )
    );
    setMode("quick");
    setStatusMessage("已从自然语言带入，请确认后再保存。");
    setStatusTone("default");
  }

  return (
    <div className="finance-shell">
      <header className="finance-header">
        <div className="finance-header__context">
          <span className="eyebrow">财务系统</span>
          <button className="period-button" type="button">
            {dashboard.periodLabel}
          </button>
        </div>
        <div className="finance-header__actions">
          <a
            className="ghost-button finance-header__action"
            href="/finance?panel=actions"
            onClick={(event) => {
              event.preventDefault();
              setIsActionComposerOpen(true);
            }}
          >
            <span>待处理</span>
            <span className="action-badge">{actionItemCount}</span>
          </a>
        </div>
        <div className="finance-header__actions">
          <a
            className="ghost-button"
            href="/finance?panel=records"
            onClick={(event) => {
              event.preventDefault();
              setIsLedgerOpen(true);
            }}
          >
            流水明细
          </a>
        </div>
        <div className="finance-header__actions">
          <a className="ghost-button" href="/finance/settings">
            设置
          </a>
        </div>
      </header>

      <section className="capture-card" id="capture">
        <div className="capture-card__header">
          <div>
            <h1 className="section-title">快速记录</h1>
            <p className="section-subtitle">
              结构化优先，自然语言辅助。保存之后，总览、账户和趋势都会同步刷新。
            </p>
          </div>
          <div className="pill-row" aria-label="capture mode">
            <a
              className={`pill ${mode === "quick" ? "pill--active" : ""}`}
              href={getToggleHref(draft.direction, "quick")}
              onClick={(event) => {
                event.preventDefault();
                setMode("quick");
              }}
            >
              快捷录入
            </a>
            <a
              className={`pill ${mode === "natural" ? "pill--active" : ""}`}
              href={getToggleHref(draft.direction, "natural")}
              onClick={(event) => {
                event.preventDefault();
                setMode("natural");
              }}
            >
              自然语言辅助
            </a>
          </div>
        </div>

        <form
          className="capture-card__body"
          method="post"
          action="/finance/record"
          onSubmit={handleSubmit}
        >
          <input type="hidden" name="periodLabel" value={dashboard.periodLabel} />
          <input type="hidden" name="direction" value={draft.direction} />
          <input type="hidden" name="mode" value={mode} />
          <div className="pill-row" aria-label="capture direction">
            {dashboard.capture.directions.map((item) => (
              <a
                key={item.value}
                className={`pill ${
                  draft.direction === item.value ? "pill--active" : ""
                }`}
                href={getToggleHref(item.value, mode)}
                onClick={(event) => {
                  event.preventDefault();
                  updateDirection(item.value);
                }}
              >
                {item.label}
              </a>
            ))}
          </div>

          {mode === "natural" ? (
            <div className="assistant-panel">
              <label className="field">
                <span className="field__label">自然语言输入</span>
                <input
                  className="field__input field__input--large"
                  name="naturalText"
                  value={draft.naturalText}
                  placeholder={dashboard.capture.assistantExamples[0]}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      naturalText: event.target.value
                    }))
                  }
                />
              </label>

              <div className="chip-row">
                {parsedNatural ? (
                  <>
                    <span className="chip">
                      类型：{getDirectionLabel(dashboard.capture.directions, parsedNatural.direction)}
                    </span>
                    <span className="chip">分类：{parsedNatural.category}</span>
                    <span className="chip">账户：{parsedNatural.channelAccount}</span>
                    {parsedNatural.direction === "transfer" ? (
                      <span className="chip">转入：{parsedNatural.targetAccount}</span>
                    ) : null}
                    {parsedNatural.amountInput ? (
                      <span className="chip">金额：¥{parsedNatural.amountInput}</span>
                    ) : (
                      <span className="status-text status-text--error">未识别到金额</span>
                    )}
                  </>
                ) : (
                  <span className="status-text">
                    输入一句话后，我会先帮你带入快捷录入。
                  </span>
                )}
              </div>

              <div className="capture-meta">
                <button className="ghost-button" type="button" onClick={handleApplyNatural}>
                  解析并带入
                </button>
                <p className="hint-text">
                  示例：{dashboard.capture.assistantExamples.join(" / ")}
                </p>
              </div>
            </div>
          ) : null}

          <div className="capture-grid">
            <label className="field">
              <span className="field__label">金额</span>
              <input
                className="field__input"
                name="amountInput"
                value={draft.amountInput}
                placeholder="例如 45"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    amountInput: event.target.value
                  }))
                }
              />
            </label>

            <label className="field">
              <span className="field__label">分类</span>
              <select
                className="field__input"
                name="category"
                value={draft.category}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    category: event.target.value
                  }))
                }
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">{labels.channelLabel}</span>
              <select
                className="field__input"
                name="channelAccount"
                value={draft.channelAccount}
                onChange={(event) =>
                  setDraftSafely({
                    ...draft,
                    channelAccount: event.target.value
                  })
                }
              >
                {currentRegistries.map((registry) => (
                  <option key={registry} value={registry}>
                    {registry}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">
                {draft.direction === "transfer" ? labels.targetLabel : "转入账户"}
              </span>
              <select
                className="field__input"
                name="targetAccount"
                value={
                  draft.direction === "transfer"
                    ? draft.targetAccount
                    : captureConfig.registries.transfer[0] ?? ""
                }
                disabled={draft.direction !== "transfer"}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    targetAccount: event.target.value
                  }))
                }
              >
                {captureConfig.registries.transfer.map((registry) => (
                  <option key={registry} value={registry}>
                    {registry}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">备注</span>
              <input
                className="field__input"
                name="note"
                value={draft.note}
                placeholder="例如 打车 / 工资 / 还款"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    note: event.target.value
                  }))
                }
              />
            </label>

            <div className="field field--action">
              <span className="field__label">保存</span>
              <button
                className="primary-button"
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? "保存中..." : labels.submitLabel}
              </button>
            </div>
          </div>

          <div className="capture-meta capture-meta--between">
            <div className="capture-inline capture-inline--hidden" aria-hidden="true">
              <label className="field field--inline">
                <span className="field__label">{labels.customRegistryLabel}</span>
                <input
                  className="field__input"
                  value={draft.customRegistryName}
                  placeholder={
                    draft.direction === "transfer"
                      ? "例如 平安储蓄卡 / 京东钱包"
                      : "例如 日常银行卡 / 信用账户"
                  }
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      customRegistryName: event.target.value
                    }))
                  }
                />
              </label>
              <button
                className="ghost-button"
                type="button"
                disabled={isSaving}
                onClick={handleAddRegistry}
              >
                添加到当前列表
              </button>
            </div>

            <span
              className={`status-text ${
                statusTone === "success"
                  ? "status-text--success"
                  : statusTone === "error"
                    ? "status-text--error"
                    : ""
              }`}
            >
              {statusMessage}
            </span>
          </div>
        </form>
      </section>

      <section className="overview-grid">
        {dashboard.overview.map((item) => (
          <article key={item.id} className="metric-card">
            <span className="metric-card__label">{item.label}</span>
            <strong
              className={`metric-card__value ${item.hero ? "metric-card__value--hero" : ""}`}
            >
              {item.value}
            </strong>
            <span className="metric-card__note">{item.note}</span>
          </article>
        ))}
      </section>

      <section className="zone-split zone-split--insights">
        <section className="section-block section-block--hero">
          <div className="cashflow-panel">
            <div className="cashflow-panel__header">
              <div>
                <p className="cashflow-panel__eyebrow">CASH FLOW</p>
                <h2 className="section-title">现金流快照</h2>
              </div>
              <span className="section-subtitle">最近 7 天</span>
            </div>

            <div className="cashflow-panel__body">
              <div className="cashflow-panel__summary">
                <article className="cashflow-balance">
                  <span className="cashflow-balance__eyebrow">NET BALANCE / 净结余</span>
                  <strong className="cashflow-balance__value">
                    {formatCurrencyValue(netCashBalance)}
                  </strong>
                </article>

                <article className="cashflow-stat">
                  <span className="cashflow-stat__eyebrow">INCOME / 收入</span>
                  <strong className="cashflow-stat__value">
                    {formatCurrencyValue(cashFlowTotals.income)}
                  </strong>
                </article>

                <article className="cashflow-stat">
                  <span className="cashflow-stat__eyebrow">EXPENSE / 支出</span>
                  <strong className="cashflow-stat__value">
                    {formatCurrencyValue(cashFlowTotals.expense)}
                  </strong>
                </article>

                <article className="cashflow-stat">
                  <span className="cashflow-stat__eyebrow">PEAK / 峰值</span>
                  <strong className="cashflow-stat__value">
                    {peakExpensePoint
                      ? `${peakExpensePoint.label}  -${formatCurrencyValue(peakExpensePoint.expense)}`
                      : "--"}
                  </strong>
                </article>
              </div>

              <div
                className="cashflow-panel__chart"
                onMouseLeave={() => setHoveredCashFlowId(null)}
              >
                <div
                  className={`cashflow-panel__readout ${
                    hoveredCashFlowPoint ? "cashflow-panel__readout--active" : ""
                  }`}
                  aria-live="polite"
                >
                  {cashFlowReadout}
                </div>
                {hoveredCashFlowPoint ? (
                  <div
                    className="cashflow-tooltip"
                    style={{ left: `${hoveredCashFlowPoint.centerX}px` }}
                  >
                    <strong className="cashflow-tooltip__title">{hoveredCashFlowPoint.label}</strong>
                    <span className="cashflow-tooltip__row">
                      收入 {formatCurrencyValue(hoveredCashFlowPoint.income)}
                    </span>
                    <span className="cashflow-tooltip__row">
                      支出 {formatCurrencyValue(hoveredCashFlowPoint.expense)}
                    </span>
                    <span className="cashflow-tooltip__row">
                      结余 {formatCurrencyValue(hoveredCashFlowPoint.balance)}
                    </span>
                  </div>
                ) : null}
                <svg
                  className="cashflow-chart"
                  viewBox={`0 0 ${chart.width} ${chart.height}`}
                  preserveAspectRatio="none"
                  aria-label="现金流趋势图"
                >
                  <line
                    className="cashflow-chart__baseline"
                    x1="0"
                    y1={chart.baselineY}
                    x2={chart.width}
                    y2={chart.baselineY}
                  />
                  {chart.bars.map((bar) => (
                    <g key={bar.id}>
                      {hoveredCashFlowId === bar.id ? (
                        <line
                          className="cashflow-chart__crosshair"
                          x1={bar.centerX}
                          y1="0"
                          x2={bar.centerX}
                          y2={chart.height - 24}
                        />
                      ) : null}
                      <rect
                        className="cashflow-chart__hit"
                        x={bar.hitX}
                        y="0"
                        width={bar.hitWidth}
                        height={chart.height}
                        onMouseEnter={() => setHoveredCashFlowId(bar.id)}
                      />
                      {bar.incomeHeight > 0 ? (
                        <rect
                          className="cashflow-chart__bar cashflow-chart__bar--income"
                          x={bar.x}
                          y={bar.incomeY}
                          width={bar.barWidth}
                          height={bar.incomeHeight}
                          rx="2"
                        />
                      ) : null}
                      {bar.expenseHeight > 0 ? (
                        <rect
                          className="cashflow-chart__bar cashflow-chart__bar--expense"
                          x={bar.x}
                          y={bar.expenseY}
                          width={bar.barWidth}
                          height={bar.expenseHeight}
                          rx="2"
                        />
                      ) : null}
                      <circle
                        className="cashflow-chart__point"
                        cx={bar.centerX}
                        cy={bar.balanceY}
                        r={hoveredCashFlowId === bar.id ? 4 : 3}
                      />
                      <text
                        className="cashflow-chart__label"
                        x={bar.centerX}
                        y={chart.height - 8}
                      >
                        {bar.label}
                      </text>
                    </g>
                  ))}
                  <path className="cashflow-chart__line" d={chart.balancePath} />
                </svg>
              </div>
            </div>
          </div>
        </section>

        <div className="zone-side-stack">
          <section className="section-block section-block--compact">
            <div className="section-heading">
              <div>
                <h2 className="section-title">预算进度</h2>
                <p className="section-subtitle">本月生活预算</p>
              </div>
            </div>
            <div className="split-line">
              <span className="section-subtitle">已用 / 总额</span>
              <span className="mono-text">
                ¥{dashboard.budget.used.toLocaleString("zh-CN")} / ¥
                {dashboard.budget.total.toLocaleString("zh-CN")}
              </span>
            </div>
            <div className="progress-track" aria-hidden="true">
              <span
                className="progress-fill"
                style={{ width: getBudgetWidth(dashboard.budget.ratio) }}
              />
            </div>
            <span className="section-subtitle">{dashboard.budget.label}</span>
          </section>

          <section className="section-block section-block--compact">
            <div className="section-heading">
              <div>
                <h2 className="section-title">净资产快照</h2>
                <p className="section-subtitle">看长期变化，不和现金流混在一起</p>
              </div>
            </div>
            <div className="snapshot-grid snapshot-grid--compact">
              {dashboard.netAssetSnapshots.map((snapshot) => (
                <article key={snapshot.id} className="snapshot-card">
                  <span className="snapshot-card__label">{snapshot.label}</span>
                  <strong className="snapshot-card__value">{snapshot.value}</strong>
                  <span className="snapshot-card__delta">{snapshot.delta}</span>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="zone-grid zone-grid--three">
        <section className="section-block section-block--fixed">
          <div className="section-heading">
            <div>
              <h2 className="section-title">资金账户</h2>
              <p className="section-subtitle">账户余额与储备，按余额从高到低显示</p>
            </div>
          </div>
          <div className="list-block">
            {visibleFundAccounts.map((account) => (
              <article key={account.id} className="list-row list-row--two">
                <div className="list-row__main">
                  <div className="list-row__line">
                    <span>{account.name}</span>
                    <span className="tag">{account.tag}</span>
                  </div>
                  <span className="list-row__description">{account.description}</span>
                </div>
                <span className="money-text">{account.balance}</span>
              </article>
            ))}
          </div>
          <span className="section-footnote">显示全部资金账户，卡片内可滚动查看</span>
        </section>

        <section className="section-block section-block--fixed">
          <div className="section-heading">
            <div>
              <h2 className="section-title">信用卡与负债</h2>
              <p className="section-subtitle">先看该还的钱</p>
            </div>
          </div>
          <div className="split-line split-line--end">
            <div>
              <span className="section-subtitle">总负债</span>
              <strong className="hero-inline hero-inline--alert">
                {dashboard.liabilities.total}
              </strong>
            </div>
            <span className="section-subtitle">本月待还 {dashboard.liabilities.dueThisMonth}</span>
          </div>
          <div className="list-block">
            {topLiabilities.map((item) => (
              <article key={item.id} className="list-row list-row--two">
                <div className="list-row__main">
                  <div className="list-row__line">
                    <span>{item.name}</span>
                    <span className="tag">{item.tag}</span>
                  </div>
                  <span className="list-row__description">{item.description}</span>
                </div>
                <span className={`money-text ${item.alert ? "money-text--alert" : ""}`}>
                  {item.dueAmount}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block section-block--fixed">
          <div className="section-heading">
            <div>
              <h2 className="section-title">理财概览</h2>
              <p className="section-subtitle">稳健、长期和高风险仓位一起看</p>
            </div>
          </div>
          <div className="split-line split-line--end">
            <div>
              <span className="section-subtitle">理财总额</span>
              <strong className="hero-inline">{dashboard.investments.total}</strong>
            </div>
            <span className="section-subtitle">浮动收益 {dashboard.investments.pnl}</span>
          </div>
          <div className="list-block">
            {topInvestments.map((item) => (
              <article key={item.id} className="list-row list-row--two">
                <div className="list-row__main">
                  <div className="list-row__line">
                    <span>{item.name}</span>
                    <span className="tag">{item.tag}</span>
                  </div>
                  <span className="list-row__description">{item.description}</span>
                </div>
                <span className="money-text">{item.amount}</span>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="zone-grid zone-grid--three">
        <section className="section-block section-block--fixed">
          <div className="section-heading">
            <div>
              <h2 className="section-title">支出分类</h2>
              <p className="section-subtitle">钱主要花在哪，只看 Top 5</p>
            </div>
          </div>
          <div className="rank-list">
            {topCategories.map((item, index) => (
              <div key={item.id} className="rank-row">
                <span className="rank-row__index">{String(index + 1).padStart(2, "0")}</span>
                <div className="rank-row__main">
                  <div className="rank-row__top">
                    <span>{item.name}</span>
                    <span className="mono-text">{item.amount}</span>
                  </div>
                  <div className="progress-track progress-track--thin" aria-hidden="true">
                    <span className="progress-fill" style={{ width: getRankWidth(item.ratio) }} />
                  </div>
                </div>
                <span className="mono-text mono-text--subtle">
                  {(item.ratio * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="section-block section-block--fixed">
          <div className="section-heading">
            <div>
              <h2 className="section-title">收入来源</h2>
              <p className="section-subtitle">钱从哪里进来，只看 Top 5</p>
            </div>
          </div>
          <div className="rank-list">
            {topIncomeSources.map((item, index) => (
              <div key={item.id} className="rank-row">
                <span className="rank-row__index">{String(index + 1).padStart(2, "0")}</span>
                <div className="rank-row__main">
                  <div className="rank-row__top">
                    <span>{item.name}</span>
                    <span className="mono-text">{item.amount}</span>
                  </div>
                  <div className="progress-track progress-track--thin" aria-hidden="true">
                    <span className="progress-fill" style={{ width: getRankWidth(item.ratio) }} />
                  </div>
                </div>
                <span className="mono-text mono-text--subtle">
                  {(item.ratio * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="section-block section-block--fixed">
          <div className="section-heading">
            <div>
              <h2 className="section-title">支付渠道</h2>
              <p className="section-subtitle">钱主要从哪里流出，只看 Top 5</p>
            </div>
          </div>
          <div className="rank-list">
            {topPaymentChannels.map((item, index) => (
              <div key={item.id} className="rank-row">
                <span className="rank-row__index">{String(index + 1).padStart(2, "0")}</span>
                <div className="rank-row__main">
                  <div className="rank-row__top">
                    <span>{item.name}</span>
                    <span className="mono-text">{item.amount}</span>
                  </div>
                  <div className="progress-track progress-track--thin" aria-hidden="true">
                    <span className="progress-fill" style={{ width: getRankWidth(item.ratio) }} />
                  </div>
                </div>
                <span className="mono-text mono-text--subtle">
                  {(item.ratio * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="section-block section-block--full">
        <div className="section-heading">
          <div>
            <h2 className="section-title">最近流水</h2>
            <p className="section-subtitle">收入、支出、转账都在这里</p>
          </div>
          <a
            className="ghost-button ghost-button--small"
            href="/finance?panel=records"
            onClick={(event) => {
              event.preventDefault();
              setIsLedgerOpen(true);
            }}
          >
            查看全部
          </a>
        </div>
        <div className="list-block">
          {visibleRecentFlows.map((flow) => (
            <article key={flow.id} className="list-row list-row--transaction">
              <span className="list-row__date">{flow.date}</span>
              <div className="list-row__main">
                <div className="list-row__line">
                  <span>{flow.label}</span>
                </div>
                <span className="list-row__description">{flow.description}</span>
              </div>
              <span
                className={`money-text ${
                  flow.direction === "transfer" ? "money-text--muted" : ""
                }`}
              >
                {flow.amount}
              </span>
            </article>
          ))}
        </div>
        {recentFlowPageCount > 1 ? (
          <div className="pagination-bar" aria-label="recent flow pagination">
            <span className="section-subtitle">
              第 {activeRecentFlowPage} / {recentFlowPageCount} 页 · 共 {dashboard.recentFlows.length} 条
            </span>
            <div className="pagination-controls">
              <button
                className="pagination-button"
                type="button"
                disabled={activeRecentFlowPage === 1}
                onClick={() => setRecentFlowPage((current) => Math.max(1, current - 1))}
              >
                上一页
              </button>
              {recentFlowPageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  className={`pagination-button ${
                    pageNumber === activeRecentFlowPage ? "pagination-button--active" : ""
                  }`}
                  type="button"
                  aria-current={pageNumber === activeRecentFlowPage ? "page" : undefined}
                  onClick={() => setRecentFlowPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                className="pagination-button"
                type="button"
                disabled={activeRecentFlowPage === recentFlowPageCount}
                onClick={() =>
                  setRecentFlowPage((current) => Math.min(recentFlowPageCount, current + 1))
                }
              >
                下一页
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {isLedgerOpen ? (
        <div
          className="action-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ledger-modal-title"
        >
          <div className="action-modal__backdrop" onClick={closeLedger} />
          <div className="action-modal__panel action-modal__panel--wide action-modal__panel--ledger">
            <div className="action-modal__header">
              <div>
                <h2 id="ledger-modal-title" className="section-title">
                  流水工作区
                </h2>
                <p className="section-subtitle">
                  查账、编辑、删除都在这里处理，保存后首页统计会同步刷新。
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={closeLedger}>
                关闭
              </button>
            </div>

            <FinanceLedgerWorkbench
              mode="embedded"
              data={dashboard}
              entries={ledgerEntries}
              onDashboardChange={setDashboard}
              onEntriesChange={setLedgerEntries}
            />
          </div>
        </div>
      ) : null}

      {isSettingsOpen ? (
        <div
          className="action-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-modal-title"
        >
          <div className="action-modal__backdrop" onClick={closeSettings} />
          <div className="action-modal__panel action-modal__panel--wide">
            <div className="action-modal__header">
              <div>
                <h2 id="settings-modal-title" className="section-title">
                  账户设置与期初余额
                </h2>
                <p className="section-subtitle">
                  这里调整的是你当前想看到的账户、负债和理财金额，保存后首页会一起更新。
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={closeSettings}>
                关闭
              </button>
            </div>

            <div className="settings-grid">
              <section className="settings-card">
                <div className="settings-card__header">
                  <div>
                    <h3 className="section-title">资金账户</h3>
                    <p className="section-subtitle">银行卡、钱包和储蓄账户的当前余额</p>
                  </div>
                </div>
                <div className="settings-list">
                  {settingsDraft.fundAccounts.map((item, index) => (
                    <label key={item.name} className="settings-row">
                      <div className="settings-row__meta">
                        <span>{item.name}</span>
                        <span className="list-row__description">{item.description}</span>
                      </div>
                      <input
                        className="field__input mono-text"
                        value={item.amountInput}
                        inputMode="decimal"
                        onChange={(event) =>
                          updateSettingsRow("fundAccounts", index, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section className="settings-card">
                <div className="settings-card__header">
                  <div>
                    <h3 className="section-title">信用卡与负债</h3>
                    <p className="section-subtitle">这里填当前应还金额，不是信用卡额度。</p>
                  </div>
                </div>
                <div className="settings-list">
                  {settingsDraft.liabilities.map((item, index) => (
                    <label key={item.name} className="settings-row">
                      <div className="settings-row__meta">
                        <span>{item.name}</span>
                        <span className="list-row__description">{item.description}</span>
                      </div>
                      <input
                        className="field__input mono-text"
                        value={item.amountInput}
                        inputMode="decimal"
                        onChange={(event) =>
                          updateSettingsRow("liabilities", index, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section className="settings-card">
                <div className="settings-card__header">
                  <div>
                    <h3 className="section-title">理财持仓</h3>
                    <p className="section-subtitle">用于修正现金管理、基金、股票、加密资产等现值。</p>
                  </div>
                </div>
                <div className="settings-list">
                  {settingsDraft.investments.map((item, index) => (
                    <label key={item.name} className="settings-row">
                      <div className="settings-row__meta">
                        <span>{item.name}</span>
                        <span className="list-row__description">{item.description}</span>
                      </div>
                      <input
                        className="field__input mono-text"
                        value={item.amountInput}
                        inputMode="decimal"
                        onChange={(event) =>
                          updateSettingsRow("investments", index, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
              </section>
            </div>

            <div className="action-item-form__actions">
              <span className="section-subtitle">
                先把当前真实余额校准好，后面继续记账时系统会在这个基础上滚动更新。
              </span>
              <button
                className="primary-button"
                type="button"
                disabled={isSavingSettings}
                onClick={handleSaveBalanceSettings}
              >
                {isSavingSettings ? "保存中..." : "保存余额设置"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isActionComposerOpen ? (
        <div
          className="action-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="action-modal-title"
        >
          <div className="action-modal__backdrop" onClick={closeActionComposer} />
          <div className="action-modal__panel">
            <div className="action-modal__header">
              <div>
                <h2 id="action-modal-title" className="section-title">
                  新增待处理事项
                </h2>
                <p className="section-subtitle">把还款、报销、到账确认这些提醒收进系统里</p>
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={closeActionComposer}
              >
                关闭
              </button>
            </div>

            <div className="action-modal__body">
              <section className="action-modal__section">
                <div className="action-modal__section-head">
                  <div>
                    <h3 className="section-title">当前待处理</h3>
                    <p className="section-subtitle">保留最近 6 项，处理完成后这里会自动收口</p>
                  </div>
                  <span className="action-badge">{actionItemCount}</span>
                </div>
                <div className="action-modal__list action-modal__list--scroll">
                  {topActionItems.length > 0 ? (
                    topActionItems.map((item) => (
                      <article key={item.id} className="action-item-card">
                        <div className="action-item-card__main">
                          <div className="list-row__line">
                            <span>{item.label}</span>
                            <span className="tag">{item.tag}</span>
                          </div>
                          <span className="list-row__description">{item.description}</span>
                        </div>
                        <div className="action-item-meta">
                          <span className="mono-text mono-text--subtle">{item.dueDate}</span>
                          <button
                            className="ghost-button ghost-button--small"
                            type="button"
                            disabled={completingActionId === item.id}
                            onClick={() => handleCompleteActionItem(item.id, item.label)}
                          >
                            {completingActionId === item.id ? "处理中..." : "完成"}
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="empty-hint">当前没有待处理事项了。</div>
                  )}
                </div>
              </section>

              <section className="action-modal__section action-modal__section--form">
                <div className="action-modal__section-head">
                  <div>
                    <h3 className="section-title">新增提醒</h3>
                    <p className="section-subtitle">先选一个常用模板，也可以直接手动填写</p>
                  </div>
                </div>
                <div className="pill-row">
                  {ACTION_ITEM_TEMPLATES.map((template) => (
                    <button
                      key={template.label}
                      className="pill"
                      type="button"
                      onClick={() => applyActionTemplate(template.label, template.description)}
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
                <div className="action-item-form action-item-form--modal">
                  <div className="action-item-form__grid action-item-form__grid--stacked">
                    <label className="field">
                      <span className="field__label">事项</span>
                      <input
                        className="field__input"
                        value={actionLabel}
                        placeholder="例如 信用卡还款 / 房租确认"
                        onChange={(event) => setActionLabel(event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">日期</span>
                      <input
                        className="field__input"
                        type="date"
                        value={actionDueDate}
                        onChange={(event) => setActionDueDate(event.target.value)}
                      />
                    </label>
                    <label className="field action-item-form__description">
                      <span className="field__label">说明</span>
                      <input
                        className="field__input"
                        value={actionDescription}
                        placeholder="例如 从日常银行卡还款 3280"
                        onChange={(event) => setActionDescription(event.target.value)}
                      />
                    </label>
                    <div className="action-item-form__actions">
                      <span className="section-subtitle">保存后会同步到首页待处理入口。</span>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={isSavingAction}
                        onClick={handleAddActionItem}
                      >
                        {isSavingAction ? "保存中..." : "确认添加"}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
