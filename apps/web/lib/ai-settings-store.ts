import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getLifeOsDataPath } from "./life-os-data-paths";

export type AiProvider = "deepseek" | "openai" | "openai-compatible";
export type AiApiKeyEntry = {
  id: string;
  label: string;
  apiKey: string;
  provider: AiProvider;
  baseUrl: string;
  defaultModel: string;
  availableModels: string[];
  createdAt: string;
  updatedAt: string | null;
};

export type AiSettingsStore = {
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  apiKeys: AiApiKeyEntry[];
  activeApiKeyId: string | null;
  defaultModel: string;
  availableModels: string[];
  updatedAt: string | null;
};

export type PublicAiApiKeyEntry = {
  id: string;
  label: string;
  maskedApiKey: string;
  provider: AiProvider;
  baseUrl: string;
  defaultModel: string;
  availableModels: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
};

export type PublicAiSettings = {
  provider: AiProvider;
  baseUrl: string;
  defaultModel: string;
  availableModels: string[];
  hasApiKey: boolean;
  maskedApiKey: string;
  apiKeys: PublicAiApiKeyEntry[];
  activeApiKeyId: string | null;
  updatedAt: string | null;
  source: "file" | "env" | "default";
};

const AI_SETTINGS_FILE_NAME = "ai-settings.json";

function getDefaultBaseUrl(provider: AiProvider) {
  if (provider === "deepseek") {
    return "https://api.deepseek.com/v1";
  }

  return "https://api.openai.com/v1";
}

function getDefaultModels(provider: AiProvider) {
  if (provider === "deepseek") {
    return ["deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"];
  }

  if (provider === "openai") {
    return ["gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini"];
  }

  return [];
}

function normalizeProvider(value: unknown, fallback: AiProvider = "deepseek"): AiProvider {
  if (value === "deepseek" || value === "openai" || value === "openai-compatible") {
    return value;
  }

  return fallback;
}

function inferProviderFromBaseUrl(baseUrl: string) {
  const normalized = baseUrl.toLowerCase();

  if (normalized.includes("deepseek")) {
    return "deepseek" as const;
  }

  if (normalized.includes("openai")) {
    return "openai" as const;
  }

  return "openai-compatible" as const;
}

function normalizeModelList(models: unknown, defaultModel: string, provider: AiProvider) {
  const source = Array.isArray(models)
    ? models
    : typeof models === "string"
    ? models.split(/\r?\n|,/)
    : [];
  const unique = new Set<string>();

  for (const item of source) {
    if (typeof item !== "string") {
      continue;
    }

    const trimmed = item.trim();

    if (trimmed) {
      unique.add(trimmed);
    }
  }

  if (defaultModel) {
    unique.add(defaultModel);
  }

  if (!unique.size) {
    for (const item of getDefaultModels(provider)) {
      unique.add(item);
    }
  }

  return Array.from(unique);
}

function normalizeUpdatedAt(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeApiKeyId(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64) || fallback;
}

function normalizeApiKeys(
  value: unknown,
  legacyApiKey: string,
  fallback: {
    provider: AiProvider;
    baseUrl: string;
    defaultModel: string;
    availableModels: string[];
  }
): AiApiKeyEntry[] {
  const now = new Date().toISOString();
  const source = Array.isArray(value) ? value : [];
  const normalized: AiApiKeyEntry[] = [];

  for (const [index, item] of source.entries()) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const apiKey =
      typeof (item as Partial<AiApiKeyEntry>).apiKey === "string"
        ? (item as Partial<AiApiKeyEntry>).apiKey?.trim()
        : "";

    if (!apiKey) {
      continue;
    }

    const fallbackId = `key-${index + 1}`;
    const id = normalizeApiKeyId((item as Partial<AiApiKeyEntry>).id, fallbackId);
    const label =
      typeof (item as Partial<AiApiKeyEntry>).label === "string" &&
      (item as Partial<AiApiKeyEntry>).label?.trim()
        ? (item as Partial<AiApiKeyEntry>).label?.trim()
        : `Key ${index + 1}`;
    const itemBaseUrl =
      typeof (item as Partial<AiApiKeyEntry>).baseUrl === "string" &&
      (item as Partial<AiApiKeyEntry>).baseUrl?.trim()
        ? (item as Partial<AiApiKeyEntry>).baseUrl?.trim() ?? ""
        : fallback.baseUrl;
    const itemProvider = normalizeProvider(
      (item as Partial<AiApiKeyEntry>).provider,
      itemBaseUrl ? inferProviderFromBaseUrl(itemBaseUrl) : fallback.provider
    );
    const itemDefaultModel =
      typeof (item as Partial<AiApiKeyEntry>).defaultModel === "string" &&
      (item as Partial<AiApiKeyEntry>).defaultModel?.trim()
        ? (item as Partial<AiApiKeyEntry>).defaultModel?.trim() ?? fallback.defaultModel
        : fallback.defaultModel || getDefaultModels(itemProvider)[0] || "";
    const itemAvailableModels = normalizeModelList(
      (item as Partial<AiApiKeyEntry>).availableModels ?? fallback.availableModels,
      itemDefaultModel,
      itemProvider
    );

    if (normalized.some((entry) => entry.id === id)) {
      continue;
    }

    normalized.push({
      id,
      label: label ?? `Key ${index + 1}`,
      apiKey,
      provider: itemProvider,
      baseUrl: itemBaseUrl || getDefaultBaseUrl(itemProvider),
      defaultModel: itemDefaultModel,
      availableModels: itemAvailableModels,
      createdAt: normalizeUpdatedAt((item as Partial<AiApiKeyEntry>).createdAt) ?? now,
      updatedAt: normalizeUpdatedAt((item as Partial<AiApiKeyEntry>).updatedAt)
    });
  }

  if (!normalized.length && legacyApiKey) {
    normalized.push({
      id: "key-1",
      label: "Key 1",
      apiKey: legacyApiKey,
      provider: fallback.provider,
      baseUrl: fallback.baseUrl,
      defaultModel: fallback.defaultModel,
      availableModels: fallback.availableModels,
      createdAt: now,
      updatedAt: null
    });
  }

  return normalized;
}

export function getAiSettingsPath() {
  return getLifeOsDataPath(AI_SETTINGS_FILE_NAME);
}

async function ensureAiSettingsDirectory() {
  await mkdir(dirname(getAiSettingsPath()), { recursive: true });
}

export function createDefaultAiSettings(): AiSettingsStore {
  const provider: AiProvider = "deepseek";
  const defaultModel = "deepseek-v4-pro";

  return {
    provider,
    baseUrl: getDefaultBaseUrl(provider),
    apiKey: "",
    apiKeys: [],
    activeApiKeyId: null,
    defaultModel,
    availableModels: normalizeModelList([], defaultModel, provider),
    updatedAt: null
  };
}

export function normalizeAiSettings(
  value: Partial<AiSettingsStore> | undefined
): AiSettingsStore {
  const baseUrlCandidate =
    typeof value?.baseUrl === "string" && value.baseUrl.trim() ? value.baseUrl.trim() : "";
  const provider = normalizeProvider(
    value?.provider,
    baseUrlCandidate ? inferProviderFromBaseUrl(baseUrlCandidate) : "deepseek"
  );
  const defaultModel =
    typeof value?.defaultModel === "string" && value.defaultModel.trim()
      ? value.defaultModel.trim()
      : getDefaultModels(provider)[0] ?? "";
  const fallbackBaseUrl = baseUrlCandidate || getDefaultBaseUrl(provider);
  const fallbackAvailableModels = normalizeModelList(value?.availableModels, defaultModel, provider);
  const legacyApiKey = typeof value?.apiKey === "string" ? value.apiKey.trim() : "";
  const apiKeys = normalizeApiKeys(
    (value as { apiKeys?: unknown } | undefined)?.apiKeys,
    legacyApiKey,
    {
      provider,
      baseUrl: fallbackBaseUrl,
      defaultModel,
      availableModels: fallbackAvailableModels
    }
  );
  const requestedActiveId =
    typeof (value as { activeApiKeyId?: unknown } | undefined)?.activeApiKeyId === "string"
      ? (value as { activeApiKeyId?: string }).activeApiKeyId?.trim()
      : "";
  const activeApiKeyId =
    apiKeys.find((entry) => entry.id === requestedActiveId)?.id ?? apiKeys[0]?.id ?? null;
  const activeEntry = apiKeys.find((entry) => entry.id === activeApiKeyId);
  const activeApiKey = activeEntry?.apiKey ?? legacyApiKey;

  return {
    provider: activeEntry?.provider ?? provider,
    baseUrl: activeEntry?.baseUrl ?? fallbackBaseUrl,
    apiKey: activeApiKey,
    apiKeys,
    activeApiKeyId,
    defaultModel: activeEntry?.defaultModel ?? defaultModel,
    availableModels: activeEntry?.availableModels ?? fallbackAvailableModels,
    updatedAt: normalizeUpdatedAt(value?.updatedAt)
  };
}

function readAiSettingsFromEnv() {
  const envApiKey = process.env.LIFE_OS_AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  const envModel = process.env.LIFE_OS_AI_MODEL ?? "";
  const envBaseUrl = process.env.LIFE_OS_AI_BASE_URL ?? "";

  if (!envApiKey && !envModel && !envBaseUrl) {
    return null;
  }

  return normalizeAiSettings({
    provider: inferProviderFromBaseUrl(envBaseUrl || getDefaultBaseUrl("openai")),
    baseUrl: envBaseUrl,
    apiKey: envApiKey,
    defaultModel: envModel
  });
}

export async function readAiSettingsStore(): Promise<{
  settings: AiSettingsStore;
  source: "file" | "env" | "default";
}> {
  try {
    const raw = await readFile(getAiSettingsPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AiSettingsStore>;
    const fileSettings = normalizeAiSettings(parsed);
    const envSettings = readAiSettingsFromEnv();

    return {
      settings: {
        ...fileSettings,
        apiKey: fileSettings.apiKey || envSettings?.apiKey || ""
      },
      source: "file"
    };
  } catch {
    const envSettings = readAiSettingsFromEnv();

    if (envSettings) {
      return {
        settings: envSettings,
        source: "env"
      };
    }

    return {
      settings: createDefaultAiSettings(),
      source: "default"
    };
  }
}

export async function writeAiSettingsStore(settings: AiSettingsStore) {
  await ensureAiSettingsDirectory();
  await writeFile(
    getAiSettingsPath(),
    `${JSON.stringify(
      {
        ...settings,
        updatedAt: settings.updatedAt ?? new Date().toISOString()
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

export function maskSecret(secret: string) {
  if (!secret) {
    return "";
  }

  if (secret.length <= 8) {
    return `${secret.slice(0, 2)}***${secret.slice(-2)}`;
  }

  return `${secret.slice(0, 4)}***${secret.slice(-4)}`;
}

export function toPublicAiSettings(
  settings: AiSettingsStore,
  source: "file" | "env" | "default"
): PublicAiSettings {
  return {
    provider: settings.provider,
    baseUrl: settings.baseUrl,
    defaultModel: settings.defaultModel,
    availableModels: settings.availableModels,
    hasApiKey: Boolean(settings.apiKey),
    maskedApiKey: maskSecret(settings.apiKey),
    apiKeys: settings.apiKeys.map((entry) => ({
      id: entry.id,
      label: entry.label,
      maskedApiKey: maskSecret(entry.apiKey),
      provider: entry.provider,
      baseUrl: entry.baseUrl,
      defaultModel: entry.defaultModel,
      availableModels: entry.availableModels,
      isActive: entry.id === settings.activeApiKeyId,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    })),
    activeApiKeyId: settings.activeApiKeyId,
    updatedAt: settings.updatedAt,
    source
  };
}
