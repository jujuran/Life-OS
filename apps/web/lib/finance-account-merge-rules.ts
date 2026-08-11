export type FinanceAccountMergeRule = {
  targetAccountName: string;
  sourceInvestmentName: string;
  aliases: string[];
  description?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeRule(value: unknown): FinanceAccountMergeRule | null {
  if (!isRecord(value)) {
    return null;
  }

  const targetAccountName =
    typeof value.targetAccountName === "string"
      ? value.targetAccountName.trim()
      : "";
  const sourceInvestmentName =
    typeof value.sourceInvestmentName === "string"
      ? value.sourceInvestmentName.trim()
      : "";
  const aliases = Array.isArray(value.aliases)
    ? value.aliases
        .filter((alias): alias is string => typeof alias === "string")
        .map((alias) => alias.trim())
        .filter(Boolean)
    : [];
  const description =
    typeof value.description === "string" && value.description.trim()
      ? value.description.trim()
      : undefined;

  if (!targetAccountName || !sourceInvestmentName) {
    return null;
  }

  return {
    targetAccountName,
    sourceInvestmentName,
    aliases,
    ...(description ? { description } : {})
  };
}

export function getConfiguredFinanceAccountMergeRules(): FinanceAccountMergeRule[] {
  const rawValue = process.env.LIFE_OS_FINANCE_ACCOUNT_MERGES?.trim();

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed)
      ? parsed
          .map(normalizeRule)
          .filter((rule): rule is FinanceAccountMergeRule => Boolean(rule))
      : [];
  } catch {
    console.warn(
      "LIFE_OS_FINANCE_ACCOUNT_MERGES is not valid JSON; account merges are disabled."
    );
    return [];
  }
}

export function resolveConfiguredFinanceAccountName(
  name: string,
  rules: FinanceAccountMergeRule[]
) {
  const matchedRule = rules.find(
    (rule) =>
      rule.sourceInvestmentName === name ||
      rule.aliases.includes(name)
  );

  return matchedRule?.targetAccountName ?? name;
}
