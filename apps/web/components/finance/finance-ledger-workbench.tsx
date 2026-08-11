"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CaptureDirection,
  FinanceDashboardViewModel,
  FinanceLedgerEntry
} from "@life-os/domain/finance-model";

type FinanceLedgerWorkbenchProps = {
  data: FinanceDashboardViewModel;
  entries: FinanceLedgerEntry[];
  mode?: "page" | "embedded";
  onEntriesChange?: (entries: FinanceLedgerEntry[]) => void;
  onDashboardChange?: (dashboard: FinanceDashboardViewModel) => void;
};

type LedgerDirectionFilter = CaptureDirection | "all";
type LedgerEditorDraft = {
  id: string;
  occurredOn: string;
  direction: CaptureDirection;
  amountInput: string;
  category: string;
  channelAccount: string;
  targetAccount: string;
  note: string;
};

type DashboardMutationResponse = {
  ok: true;
  dashboard: FinanceDashboardViewModel;
};

type StatusTone = "default" | "success" | "error";

export function FinanceLedgerWorkbench({
  data,
  entries,
  mode = "page",
  onEntriesChange,
  onDashboardChange
}: FinanceLedgerWorkbenchProps) {
  const router = useRouter();
  const [ledgerEntries, setLedgerEntries] = useState(() => sortEntriesDescending(entries));
  const [searchValue, setSearchValue] = useState("");
  const [directionFilter, setDirectionFilter] = useState<LedgerDirectionFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editorDraft, setEditorDraft] = useState<LedgerEditorDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    mode === "embedded"
      ? "这里可以查账、修账、删除误记记录，修改后首页统计会同步刷新。"
      : "这里是流水工作区，适合查账、修账、删除误记记录。"
  );
  const [statusTone, setStatusTone] = useState<StatusTone>("default");

  useEffect(() => {
    setLedgerEntries(sortEntriesDescending(entries));
  }, [entries]);

  const allCategoryOptions = mergeUniqueOptions([
    ...data.capture.categories.expense,
    ...data.capture.categories.income,
    ...data.capture.categories.transfer,
    ...ledgerEntries.map((entry) => entry.category)
  ]);
  const allAccountOptions = mergeUniqueOptions([
    ...data.capture.registries.expense,
    ...data.capture.registries.income,
    ...data.capture.registries.transfer,
    ...ledgerEntries.flatMap((entry) => [entry.channelAccount, entry.targetAccount])
  ]);

  const filteredEntries = ledgerEntries.filter((entry) => {
    if (directionFilter !== "all" && entry.direction !== directionFilter) {
      return false;
    }

    if (categoryFilter !== "all" && entry.category !== categoryFilter) {
      return false;
    }

    if (
      accountFilter !== "all" &&
      entry.channelAccount !== accountFilter &&
      entry.targetAccount !== accountFilter
    ) {
      return false;
    }

    if (dateFrom && entry.occurredOn < dateFrom) {
      return false;
    }

    if (dateTo && entry.occurredOn > dateTo) {
      return false;
    }

    if (searchValue.trim()) {
      const haystack = [
        entry.category,
        entry.channelAccount,
        entry.targetAccount,
        entry.note,
        getDirectionText(entry.direction)
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(searchValue.trim().toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  const incomeTotal = filteredEntries.reduce(
    (total, entry) => total + (entry.direction === "income" ? entry.amount : 0),
    0
  );
  const expenseTotal = filteredEntries.reduce(
    (total, entry) => total + (entry.direction === "expense" ? entry.amount : 0),
    0
  );
  const transferCount = filteredEntries.filter(
    (entry) => entry.direction === "transfer"
  ).length;

  const currentCategoryOptions = editorDraft
    ? mergeUniqueOptions([
        ...data.capture.categories[editorDraft.direction],
        editorDraft.category
      ])
    : [];
  const currentChannelOptions = editorDraft
    ? mergeUniqueOptions([
        ...data.capture.registries[editorDraft.direction],
        editorDraft.channelAccount
      ])
    : [];
  const currentTargetOptions = editorDraft
    ? mergeUniqueOptions([
        ...data.capture.registries.transfer,
        editorDraft.channelAccount,
        editorDraft.targetAccount
      ]).filter(Boolean)
    : [];

  function syncEntries(nextEntries: FinanceLedgerEntry[]) {
    setLedgerEntries(nextEntries);
    onEntriesChange?.(nextEntries);
  }

  function resetFilters() {
    setSearchValue("");
    setDirectionFilter("all");
    setCategoryFilter("all");
    setAccountFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  function openEditor(entry: FinanceLedgerEntry) {
    setEditorDraft(createEditorDraft(entry));
    setStatusMessage(`正在编辑：${entry.note || entry.category}`);
    setStatusTone("default");
  }

  function closeEditor() {
    setEditorDraft(null);
  }

  async function handleSaveEntry() {
    if (!editorDraft) {
      return;
    }

    const amount = parseAmountInput(editorDraft.amountInput);

    if (amount === null || amount <= 0) {
      setStatusMessage("请输入有效金额后再保存。");
      setStatusTone("error");
      return;
    }

    if (!editorDraft.occurredOn) {
      setStatusMessage("请先补上记录日期。");
      setStatusTone("error");
      return;
    }

    if (!editorDraft.category || !editorDraft.channelAccount) {
      setStatusMessage("分类和账户都需要确认好。");
      setStatusTone("error");
      return;
    }

    if (
      editorDraft.direction === "transfer" &&
      (!editorDraft.targetAccount ||
        editorDraft.targetAccount === editorDraft.channelAccount)
    ) {
      setStatusMessage("转账记录需要不同的转出和转入账户。");
      setStatusTone("error");
      return;
    }

    const nextEntry: FinanceLedgerEntry = {
      id: editorDraft.id,
      periodLabel: data.periodLabel,
      occurredOn: editorDraft.occurredOn,
      displayDate: formatMonthDay(editorDraft.occurredOn),
      direction: editorDraft.direction,
      amount,
      category: editorDraft.category,
      channelAccount: editorDraft.channelAccount,
      targetAccount:
        editorDraft.direction === "transfer" ? editorDraft.targetAccount : "",
      note: editorDraft.note.trim() || editorDraft.category
    };

    setIsSaving(true);

    try {
      const response = await fetch(`/api/finance/entries/${editorDraft.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          periodLabel: data.periodLabel,
          entry: nextEntry
        })
      });

      if (!response.ok) {
        throw new Error("update failed");
      }

      const result = (await response.json()) as DashboardMutationResponse;

      syncEntries(
        sortEntriesDescending(
          ledgerEntries.map((entry) => (entry.id === nextEntry.id ? nextEntry : entry))
        )
      );
      onDashboardChange?.(result.dashboard);
      setEditorDraft(null);
      setStatusMessage("这条流水已经更新。");
      setStatusTone("success");
      router.refresh();
    } catch {
      setStatusMessage("保存失败了，我们稍后再试一次。");
      setStatusTone("error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteEntry(entry: FinanceLedgerEntry) {
    const shouldDelete = window.confirm(
      `确定删除这条记录吗？\n${entry.occurredOn} · ${entry.note || entry.category} · ${formatEntryAmount(
        entry
      )}`
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingEntryId(entry.id);

    try {
      const response = await fetch(`/api/finance/entries/${entry.id}`, {
        method: "DELETE",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          periodLabel: data.periodLabel
        })
      });

      if (!response.ok) {
        throw new Error("delete failed");
      }

      const result = (await response.json()) as DashboardMutationResponse;
      const nextEntries = ledgerEntries.filter((item) => item.id !== entry.id);
      syncEntries(nextEntries);
      onDashboardChange?.(result.dashboard);
      if (editorDraft?.id === entry.id) {
        setEditorDraft(null);
      }
      setStatusMessage("这条流水已经删除。");
      setStatusTone("success");
      router.refresh();
    } catch {
      setStatusMessage("删除失败了，我们稍后再试一次。");
      setStatusTone("error");
    } finally {
      setDeletingEntryId(null);
    }
  }

  return (
    <div className="ledger-workbench">
      <section className="section-block">
        <div className="ledger-toolbar">
          <label className="field field--inline">
            <span className="field__label">搜索</span>
            <input
              className="field__input"
              value={searchValue}
              placeholder="搜备注、分类、账户、方向"
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">方向</span>
            <select
              className="field__input"
              value={directionFilter}
              onChange={(event) =>
                setDirectionFilter(event.target.value as LedgerDirectionFilter)
              }
            >
              <option value="all">全部</option>
              <option value="expense">支出</option>
              <option value="income">收入</option>
              <option value="transfer">转账</option>
            </select>
          </label>

          <label className="field">
            <span className="field__label">分类</span>
            <select
              className="field__input"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">全部分类</option>
              {allCategoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">账户 / 渠道</span>
            <select
              className="field__input"
              value={accountFilter}
              onChange={(event) => setAccountFilter(event.target.value)}
            >
              <option value="all">全部账户</option>
              {allAccountOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">开始日期</span>
            <input
              className="field__input"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">结束日期</span>
            <input
              className="field__input"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>

          <button className="ghost-button" type="button" onClick={resetFilters}>
            重置筛选
          </button>
        </div>

        <div className={`ledger-status ledger-status--${statusTone}`}>
          <span>{statusMessage}</span>
        </div>

        <div className="ledger-metrics">
          <article className="ledger-metric">
            <span className="section-subtitle">当前结果</span>
            <strong className="ledger-metric__value">{filteredEntries.length} 条</strong>
          </article>
          <article className="ledger-metric">
            <span className="section-subtitle">收入合计</span>
            <strong className="ledger-metric__value">{formatCurrency(incomeTotal)}</strong>
          </article>
          <article className="ledger-metric">
            <span className="section-subtitle">支出合计</span>
            <strong className="ledger-metric__value">{formatCurrency(expenseTotal)}</strong>
          </article>
          <article className="ledger-metric">
            <span className="section-subtitle">转账条数</span>
            <strong className="ledger-metric__value">{transferCount} 条</strong>
          </article>
        </div>
      </section>

      <section className="section-block section-block--full">
        <div className="section-heading">
          <div>
            <h2 className="section-title">账本记录</h2>
            <p className="section-subtitle">
              共 {ledgerEntries.length} 条，当前筛选后显示 {filteredEntries.length} 条
            </p>
          </div>
        </div>

        {filteredEntries.length > 0 ? (
          <div className="ledger-table">
            {filteredEntries.map((entry) => (
              <article key={entry.id} className="ledger-row">
                <div className="ledger-row__main">
                  <div className="ledger-row__top">
                    <div className="ledger-row__title-group">
                      <span className="ledger-row__title">
                        {entry.note || entry.category}
                      </span>
                      <span className={`tag ${getDirectionTagClass(entry.direction)}`}>
                        {getDirectionText(entry.direction)}
                      </span>
                    </div>
                    <span
                      className={`money-text ledger-row__amount ${
                        entry.direction === "transfer"
                          ? "money-text--muted"
                          : entry.direction === "expense"
                            ? "money-text--alert"
                            : ""
                      }`}
                    >
                      {formatEntryAmount(entry)}
                    </span>
                  </div>

                  <div className="ledger-row__meta">
                    <span>{entry.occurredOn}</span>
                    <span>{entry.category}</span>
                    <span>{formatAccountText(entry)}</span>
                  </div>
                </div>

                <div className="ledger-row__actions">
                  <button
                    className="ghost-button ghost-button--small"
                    type="button"
                    onClick={() => openEditor(entry)}
                  >
                    编辑
                  </button>
                  <button
                    className="ghost-button ghost-button--small"
                    type="button"
                    disabled={deletingEntryId === entry.id}
                    onClick={() => handleDeleteEntry(entry)}
                  >
                    {deletingEntryId === entry.id ? "删除中..." : "删除"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-hint">
            当前筛选条件下没有记录。你可以调整筛选，或者回到首页继续记一笔。
          </div>
        )}
      </section>

      {editorDraft ? (
        <div
          className="action-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ledger-editor-title"
        >
          <div className="action-modal__backdrop" onClick={closeEditor} />
          <div className="action-modal__panel action-modal__panel--wide">
            <div className="action-modal__header">
              <div>
                <h2 id="ledger-editor-title" className="section-title">
                  编辑流水
                </h2>
                <p className="section-subtitle">
                  改金额、改方向、改账户都可以，保存后首页统计会一起变。
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={closeEditor}>
                关闭
              </button>
            </div>

            <div className="ledger-editor">
              <div className="ledger-editor__grid">
                <label className="field">
                  <span className="field__label">日期</span>
                  <input
                    className="field__input"
                    type="date"
                    value={editorDraft.occurredOn}
                    onChange={(event) =>
                      setEditorDraft((current) =>
                        current
                          ? { ...current, occurredOn: event.target.value }
                          : current
                      )
                    }
                  />
                </label>

                <label className="field">
                  <span className="field__label">方向</span>
                  <select
                    className="field__input"
                    value={editorDraft.direction}
                    onChange={(event) =>
                      setEditorDraft((current) =>
                        current
                          ? ensureEditorDraft(
                              {
                                ...current,
                                direction: event.target.value as CaptureDirection
                              },
                              data.capture
                            )
                          : current
                      )
                    }
                  >
                    <option value="expense">支出</option>
                    <option value="income">收入</option>
                    <option value="transfer">转账</option>
                  </select>
                </label>

                <label className="field">
                  <span className="field__label">金额</span>
                  <input
                    className="field__input"
                    value={editorDraft.amountInput}
                    inputMode="decimal"
                    onChange={(event) =>
                      setEditorDraft((current) =>
                        current
                          ? { ...current, amountInput: event.target.value }
                          : current
                      )
                    }
                  />
                </label>

                <label className="field">
                  <span className="field__label">分类</span>
                  <select
                    className="field__input"
                    value={editorDraft.category}
                    onChange={(event) =>
                      setEditorDraft((current) =>
                        current
                          ? { ...current, category: event.target.value }
                          : current
                      )
                    }
                  >
                    {currentCategoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field__label">
                    {editorDraft.direction === "income"
                      ? "入账账户"
                      : editorDraft.direction === "transfer"
                        ? "转出账户"
                        : "支付渠道"}
                  </span>
                  <select
                    className="field__input"
                    value={editorDraft.channelAccount}
                    onChange={(event) =>
                      setEditorDraft((current) =>
                        current
                          ? ensureEditorDraft(
                              {
                                ...current,
                                channelAccount: event.target.value
                              },
                              data.capture
                            )
                          : current
                      )
                    }
                  >
                    {currentChannelOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                {editorDraft.direction === "transfer" ? (
                  <label className="field">
                    <span className="field__label">转入账户</span>
                    <select
                      className="field__input"
                      value={editorDraft.targetAccount}
                      onChange={(event) =>
                        setEditorDraft((current) =>
                          current
                            ? {
                                ...current,
                                targetAccount: event.target.value
                              }
                            : current
                        )
                      }
                    >
                      {currentTargetOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label className="field ledger-editor__note">
                  <span className="field__label">备注</span>
                  <input
                    className="field__input"
                    value={editorDraft.note}
                    placeholder="给这条记录补一句备注"
                    onChange={(event) =>
                      setEditorDraft((current) =>
                        current
                          ? { ...current, note: event.target.value }
                          : current
                      )
                    }
                  />
                </label>
              </div>

              <div className="ledger-editor__actions">
                <span className="section-subtitle">
                  保存会覆盖这条原始记录。如果删错了，也可以用设置页里的备份恢复。
                </span>
                <div className="ledger-editor__buttons">
                  <button className="ghost-button" type="button" onClick={closeEditor}>
                    取消
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveEntry}
                  >
                    {isSaving ? "保存中..." : "保存修改"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function createEditorDraft(entry: FinanceLedgerEntry): LedgerEditorDraft {
  return {
    id: entry.id,
    occurredOn: entry.occurredOn,
    direction: entry.direction,
    amountInput: entry.amount.toFixed(2),
    category: entry.category,
    channelAccount: entry.channelAccount,
    targetAccount: entry.targetAccount,
    note: entry.note
  };
}

function ensureEditorDraft(
  draft: LedgerEditorDraft,
  capture: FinanceDashboardViewModel["capture"]
): LedgerEditorDraft {
  const categoryOptions = mergeUniqueOptions([
    ...capture.categories[draft.direction],
    draft.category
  ]);
  const channelOptions = mergeUniqueOptions([
    ...capture.registries[draft.direction],
    draft.channelAccount
  ]);
  const targetOptions = mergeUniqueOptions([
    ...capture.registries.transfer,
    draft.targetAccount
  ]);

  const category = categoryOptions.includes(draft.category)
    ? draft.category
    : categoryOptions[0] ?? "";
  const channelAccount = channelOptions.includes(draft.channelAccount)
    ? draft.channelAccount
    : channelOptions[0] ?? "";
  const targetAccount =
    draft.direction === "transfer"
      ? targetOptions.find((option) => option !== channelAccount) ??
        targetOptions[0] ??
        ""
      : "";

  return {
    ...draft,
    category,
    channelAccount,
    targetAccount
  };
}

function mergeUniqueOptions(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))
  );
}

function parseAmountInput(value: string) {
  const normalized = value.replace(/[^\d.-]/g, "");
  if (!normalized.trim()) {
    return null;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : null;
}

function formatCurrency(value: number) {
  return `¥${value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatEntryAmount(entry: FinanceLedgerEntry) {
  if (entry.direction === "income") {
    return `+${formatCurrency(entry.amount)}`;
  }

  if (entry.direction === "transfer") {
    return `↔${formatCurrency(entry.amount)}`;
  }

  return `-${formatCurrency(entry.amount)}`;
}

function formatAccountText(entry: FinanceLedgerEntry) {
  if (entry.direction === "transfer") {
    return `${entry.channelAccount} → ${entry.targetAccount}`;
  }

  return entry.channelAccount;
}

function formatMonthDay(isoDate: string) {
  const parts = isoDate.split("-");
  if (parts.length !== 3) {
    return isoDate;
  }

  return `${parts[1]}-${parts[2]}`;
}

function getDirectionText(direction: CaptureDirection) {
  if (direction === "income") {
    return "收入";
  }

  if (direction === "transfer") {
    return "转账";
  }

  return "支出";
}

function getDirectionTagClass(direction: CaptureDirection) {
  if (direction === "income") {
    return "ledger-tag ledger-tag--income";
  }

  if (direction === "transfer") {
    return "ledger-tag ledger-tag--transfer";
  }

  return "ledger-tag ledger-tag--expense";
}

export function sortEntriesDescending(entries: FinanceLedgerEntry[]) {
  return [...entries].sort((left, right) =>
    `${right.occurredOn}-${right.id}`.localeCompare(`${left.occurredOn}-${left.id}`)
  );
}
