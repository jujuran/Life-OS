import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getConfiguredFinanceAccountMergeRules,
  resolveConfiguredFinanceAccountName
} from "./finance-account-merge-rules";

const originalRules = process.env.LIFE_OS_FINANCE_ACCOUNT_MERGES;

afterEach(() => {
  vi.restoreAllMocks();

  if (originalRules === undefined) {
    delete process.env.LIFE_OS_FINANCE_ACCOUNT_MERGES;
  } else {
    process.env.LIFE_OS_FINANCE_ACCOUNT_MERGES = originalRules;
  }
});

describe("finance account merge rules", () => {
  it("normalizes valid local rules", () => {
    process.env.LIFE_OS_FINANCE_ACCOUNT_MERGES = JSON.stringify([
      {
        targetAccountName: "Wallet",
        sourceInvestmentName: "Cash management",
        aliases: ["Daily wallet"],
        description: "Combined balance"
      }
    ]);

    expect(getConfiguredFinanceAccountMergeRules()).toEqual([
      {
        targetAccountName: "Wallet",
        sourceInvestmentName: "Cash management",
        aliases: ["Daily wallet"],
        description: "Combined balance"
      }
    ]);
  });

  it("maps aliases and source investments to the configured target", () => {
    const rules = [
      {
        targetAccountName: "Wallet",
        sourceInvestmentName: "Cash management",
        aliases: ["Daily wallet"]
      }
    ];

    expect(resolveConfiguredFinanceAccountName("Daily wallet", rules)).toBe("Wallet");
    expect(resolveConfiguredFinanceAccountName("Cash management", rules)).toBe("Wallet");
    expect(resolveConfiguredFinanceAccountName("Savings", rules)).toBe("Savings");
  });

  it("disables malformed configuration without exposing its value", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.LIFE_OS_FINANCE_ACCOUNT_MERGES = "{not-json";

    expect(getConfiguredFinanceAccountMergeRules()).toEqual([]);
    expect(warning).toHaveBeenCalledOnce();
  });
});
