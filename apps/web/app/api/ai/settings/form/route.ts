import { NextResponse } from "next/server";
import {
  normalizeAiSettings,
  readAiSettingsStore,
  writeAiSettingsStore,
  type AiProvider,
  type AiApiKeyEntry
} from "../../../../../lib/ai-settings-store";

export const runtime = "nodejs";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function normalizeSubmittedApiKeyId(value: string, fallback: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64) || fallback;
}

function normalizeProvider(value: string): AiProvider {
  if (value === "deepseek" || value === "openai" || value === "openai-compatible") {
    return value;
  }

  return "openai-compatible";
}

function parseModels(text: string, defaultModel: string) {
  const models = new Set<string>();

  for (const item of text.split(/\r?\n|,/)) {
    const trimmed = item.trim();

    if (trimmed) {
      models.add(trimmed);
    }
  }

  if (defaultModel) {
    models.add(defaultModel);
  }

  return Array.from(models);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const { settings: currentSettings } = await readAiSettingsStore();
  const provider = normalizeProvider(getFormString(formData, "provider"));
  const baseUrl = getFormString(formData, "baseUrl");
  const defaultModel = getFormString(formData, "defaultModel");
  const availableModels = parseModels(getFormString(formData, "availableModelsText"), defaultModel);
  const requestedId = normalizeSubmittedApiKeyId(
    getFormString(formData, "apiKeyId"),
    `key-${currentSettings.apiKeys.length + 1}`
  );
  const existing = currentSettings.apiKeys.find((entry) => entry.id === requestedId);
  const apiKey = getFormString(formData, "apiKey") || existing?.apiKey || "";
  const now = new Date().toISOString();
  const redirectUrl = new URL(`/ai?config=1&key=${encodeURIComponent(requestedId)}`, request.url);

  if (!apiKey || !baseUrl || !defaultModel) {
    redirectUrl.searchParams.set("error", "missing-ai-config");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const nextEntry: AiApiKeyEntry = {
    id: requestedId,
    label: getFormString(formData, "label") || existing?.label || requestedId,
    apiKey,
    provider,
    baseUrl,
    defaultModel,
    availableModels: availableModels.length ? availableModels : [defaultModel],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  const existingIndex = currentSettings.apiKeys.findIndex((entry) => entry.id === requestedId);
  const nextApiKeys = currentSettings.apiKeys.slice();

  if (existingIndex >= 0) {
    nextApiKeys[existingIndex] = nextEntry;
  } else {
    nextApiKeys.push(nextEntry);
  }

  const nextSettings = normalizeAiSettings({
    ...currentSettings,
    provider,
    baseUrl,
    apiKeys: nextApiKeys,
    activeApiKeyId: requestedId,
    defaultModel,
    availableModels: nextEntry.availableModels,
    updatedAt: now
  });

  await writeAiSettingsStore(nextSettings);

  redirectUrl.searchParams.set("saved", "1");
  return NextResponse.redirect(redirectUrl, 303);
}
