"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FinanceLedgerBackupSummary } from "@life-os/db/finance-repository";
import type {
  FinanceBalanceSettings,
  FinanceDashboardViewModel
} from "@life-os/domain/finance-model";

type FinanceSettingsPageProps = {
  data: FinanceDashboardViewModel;
};

type BalanceSettingsSectionKey = "fundAccounts" | "liabilities" | "investments";

type BalanceSettingsRow = {
  name: string;
  description: string;
  amountInput: string;
};

type BalanceSettingsDraft = Record<BalanceSettingsSectionKey, BalanceSettingsRow[]>;

type DashboardMutationResponse = {
  ok: true;
  dashboard: FinanceDashboardViewModel;
};

type CreateBackupResponse = {
  ok: true;
  backup: FinanceLedgerBackupSummary;
};

type RestoreLedgerResponse = {
  ok: true;
  dashboard: FinanceDashboardViewModel;
  backup: FinanceLedgerBackupSummary;
};

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

export function FinanceSettingsPage({ data }: FinanceSettingsPageProps) {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(data);
  const [settingsDraft, setSettingsDraft] = useState(() =>
    createBalanceSettingsDraft(data)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreInputKey, setRestoreInputKey] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    "先把当前真实余额校准好，后面继续记录时系统会在这份基线之上滚动更新。"
  );
  const [dataStatusMessage, setDataStatusMessage] = useState(
    "建议先创建一份本地备份，再持续录入真实数据。"
  );
  const [lastBackup, setLastBackup] = useState<FinanceLedgerBackupSummary | null>(null);

  function updateSettingsRow(
    section: BalanceSettingsSectionKey,
    index: number,
    amountInput: string
  ) {
    setSettingsDraft((current) => ({
      ...current,
      [section]: current[section].map((item, itemIndex) =>
        itemIndex === index ? { ...item, amountInput } : item
      )
    }));
  }

  async function handleSave() {
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
      for (const item of settingsDraft[section]) {
        const amount = parseAmountInput(item.amountInput);
        if (amount === null) {
          setStatusMessage(`“${item.name}” 的金额格式不对，先修正再保存。`);
          return;
        }

        settings[section].push({
          name: item.name,
          amount
        });
      }
    }

    setIsSaving(true);
    setStatusMessage("正在保存余额设置...");

    try {
      const response = await fetch("/api/finance/settings", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          periodLabel: dashboard.periodLabel,
          settings
        })
      });

      if (!response.ok) {
        throw new Error("save failed");
      }

      const result = (await response.json()) as DashboardMutationResponse;
      setDashboard(result.dashboard);
      setSettingsDraft(createBalanceSettingsDraft(result.dashboard));
      setStatusMessage("余额设置已经保存，财务首页会同步使用这份最新数据。");
      router.refresh();
    } catch {
      setStatusMessage("保存失败了，我们稍后再试一次。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    setDataStatusMessage("正在导出本地账本...");

    try {
      const response = await fetch(
        `/api/finance/export?periodLabel=${encodeURIComponent(dashboard.periodLabel)}`
      );

      if (!response.ok) {
        throw new Error("export failed");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const fileName =
        extractFileName(response.headers.get("content-disposition")) ??
        `finance-ledger-export-${Date.now()}.json`;
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setDataStatusMessage(`账本已导出：${fileName}`);
    } catch {
      setDataStatusMessage("导出失败了，我们稍后再试一次。");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleBackup() {
    setIsBackingUp(true);
    setDataStatusMessage("正在创建本地备份...");

    try {
      const response = await fetch("/api/finance/backup", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          periodLabel: dashboard.periodLabel
        })
      });

      if (!response.ok) {
        throw new Error("backup failed");
      }

      const result = (await response.json()) as CreateBackupResponse;
      setLastBackup(result.backup);
      setDataStatusMessage(
        `备份已创建：${result.backup.fileName}，位置在 ${result.backup.filePath}`
      );
    } catch {
      setDataStatusMessage("备份失败了，我们稍后再试一次。");
    } finally {
      setIsBackingUp(false);
    }
  }

  async function handleRestore() {
    if (!restoreFile) {
      setDataStatusMessage("先选择一份导出的账本 JSON，再执行恢复。");
      return;
    }

    const shouldRestore = window.confirm(
      "恢复会用选中的账本覆盖当前本地数据。系统会先自动创建一份备份，继续吗？"
    );

    if (!shouldRestore) {
      return;
    }

    setIsRestoring(true);
    setDataStatusMessage(`正在恢复 ${restoreFile.name} ...`);

    try {
      const ledgerJson = await restoreFile.text();
      const response = await fetch("/api/finance/restore", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          periodLabel: dashboard.periodLabel,
          ledgerJson
        })
      });

      if (!response.ok) {
        throw new Error("restore failed");
      }

      const result = (await response.json()) as RestoreLedgerResponse;
      setDashboard(result.dashboard);
      setSettingsDraft(createBalanceSettingsDraft(result.dashboard));
      setLastBackup(result.backup);
      setRestoreFile(null);
      setRestoreInputKey((current) => current + 1);
      setDataStatusMessage(
        `恢复完成，恢复前备份为 ${result.backup.fileName}。`
      );
      router.refresh();
    } catch {
      setDataStatusMessage("恢复失败了，请确认你选择的是系统导出的账本 JSON。");
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-page__header section-block">
        <div className="settings-page__intro">
          <p className="eyebrow">财务系统</p>
          <h1 className="section-title">账户设置与期初余额</h1>
          <p className="section-subtitle section-subtitle--body">
            这里用于校准你当前真实的资金账户、负债和理财金额。保存之后，首页总览、
            账户余额和净资产都会一起更新。
          </p>
        </div>
        <div className="settings-page__actions">
          <span className="section-subtitle">{dashboard.periodLabel}</span>
          <a className="ghost-button" href="/finance">
            返回财务首页
          </a>
        </div>
      </header>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2 className="section-title">余额校准</h2>
            <p className="section-subtitle">
              先把真实余额稳住，后面记录收支、转账和还款时系统会继续在这里滚动。
            </p>
          </div>
        </div>

        <div className="settings-grid">
          <section className="settings-card">
            <div className="settings-card__header">
              <div>
                <h3 className="section-title">资金账户</h3>
                <p className="section-subtitle">
                  银行卡、钱包和储蓄账户的当前余额。
                </p>
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
                <p className="section-subtitle">
                  这里填写当前应还金额，不是信用额度。
                </p>
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
                <p className="section-subtitle">
                  用于修正基金、股票、加密资产等当前金额。
                </p>
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

        <div className="settings-page__footer">
          <span className="section-subtitle">{statusMessage}</span>
          <button
            className="primary-button"
            type="button"
            disabled={isSaving}
            onClick={handleSave}
          >
            {isSaving ? "保存中..." : "保存余额设置"}
          </button>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2 className="section-title">数据导出与备份</h2>
            <p className="section-subtitle">
              先把真实数据护住。导出适合手动留档，备份适合恢复前兜底。
            </p>
          </div>
        </div>

        <div className="settings-grid">
          <section className="settings-card">
            <div className="settings-card__header">
              <div>
                <h3 className="section-title">导出账本</h3>
                <p className="section-subtitle">
                  下载当前本地账本 JSON，适合手动留档或迁移到别的环境。
                </p>
              </div>
            </div>
            <div className="settings-card__actions">
              <p className="section-subtitle">
                导出文件包含当前账本、已记录流水、渠道、待处理事项和余额基线。
              </p>
              <button
                className="ghost-button"
                type="button"
                disabled={isExporting}
                onClick={handleExport}
              >
                {isExporting ? "导出中..." : "导出账本 JSON"}
              </button>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card__header">
              <div>
                <h3 className="section-title">创建备份</h3>
                <p className="section-subtitle">
                  在本机私人数据目录的 backups 文件夹生成时间戳备份，恢复或大改前都能先留底。
                </p>
              </div>
            </div>
            <div className="settings-card__actions">
              <p className="section-subtitle">
                {lastBackup
                  ? `最近一份备份：${lastBackup.fileName}`
                  : "还没有创建过手动备份。"}
              </p>
              <button
                className="ghost-button"
                type="button"
                disabled={isBackingUp}
                onClick={handleBackup}
              >
                {isBackingUp ? "备份中..." : "立即创建备份"}
              </button>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card__header">
              <div>
                <h3 className="section-title">恢复账本</h3>
                <p className="section-subtitle">
                  选择之前导出的账本 JSON 恢复。恢复前系统会自动再做一份本地备份。
                </p>
              </div>
            </div>
            <div className="settings-card__actions">
              <input
                key={restoreInputKey}
                className="field__input"
                type="file"
                accept=".json,application/json"
                onChange={(event) => setRestoreFile(event.target.files?.[0] ?? null)}
              />
              <p className="section-subtitle">
                {restoreFile ? `已选择：${restoreFile.name}` : "还没有选择恢复文件。"}
              </p>
              <button
                className="primary-button"
                type="button"
                disabled={isRestoring || !restoreFile}
                onClick={handleRestore}
              >
                {isRestoring ? "恢复中..." : "恢复本地账本"}
              </button>
            </div>
          </section>
        </div>

        <div className="settings-page__footer">
          <span className="section-subtitle">{dataStatusMessage}</span>
          {lastBackup ? (
            <span className="section-subtitle">
              最近备份时间：{formatBackupTime(lastBackup.createdAt)}
            </span>
          ) : (
            <span className="section-subtitle">备份位置：本机私人数据目录 / backups</span>
          )}
        </div>
      </section>
    </div>
  );
}

function extractFileName(contentDisposition: string | null) {
  if (!contentDisposition) {
    return null;
  }

  const match = contentDisposition.match(/filename="([^"]+)"/i);
  return match?.[1] ?? null;
}

function formatBackupTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}
