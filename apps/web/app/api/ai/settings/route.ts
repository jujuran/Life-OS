import { NextResponse } from "next/server";
import {
  normalizeAiSettings,
  readAiSettingsStore,
  toPublicAiSettings,
  writeAiSettingsStore,
  type AiProvider,
  type PublicAiSettings
} from "../../../../lib/ai-settings-store";

export const runtime = "nodejs";

type AiSettingsResponse = {
  ok: true;
  settings: PublicAiSettings;
  message?: string;
};

type SaveAiSettingsRequest = {
  provider?: AiProvider;
  baseUrl?: string;
  apiKey?: string;
  apiKeys?: Array<{
    id?: string;
    label?: string;
    apiKey?: string;
    provider?: AiProvider;
    baseUrl?: string;
    defaultModel?: string;
    availableModels?: string[];
  }>;
  activeApiKeyId?: string | null;
  defaultModel?: string;
  availableModels?: string[];
};

function normalizeSubmittedApiKeyId(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64) || fallback;
}

function buildNextApiKeys(
  body: SaveAiSettingsRequest,
  currentSettings: Awaited<ReturnType<typeof readAiSettingsStore>>["settings"]
) {
  if (!Array.isArray(body.apiKeys)) {
    const submittedApiKey =
      typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : "";

    if (submittedApiKey) {
      return [
        {
          id: currentSettings.activeApiKeyId ?? currentSettings.apiKeys[0]?.id ?? "key-1",
          label: currentSettings.apiKeys[0]?.label ?? "Key 1",
          apiKey: submittedApiKey,
          provider: currentSettings.provider,
          baseUrl: currentSettings.baseUrl,
          defaultModel: currentSettings.defaultModel,
          availableModels: currentSettings.availableModels,
          createdAt: currentSettings.apiKeys[0]?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
    }

    return currentSettings.apiKeys;
  }

  const currentKeyMap = new Map(currentSettings.apiKeys.map((entry) => [entry.id, entry]));
  const now = new Date().toISOString();

  return body.apiKeys
    .map((entry, index) => {
      const id = normalizeSubmittedApiKeyId(entry.id, `key-${index + 1}`);
      const existing = currentKeyMap.get(id);
      const apiKey =
        typeof entry.apiKey === "string" && entry.apiKey.trim()
          ? entry.apiKey.trim()
          : existing?.apiKey ?? "";

      if (!apiKey) {
        return null;
      }
      const provider =
        entry.provider === "deepseek" ||
        entry.provider === "openai" ||
        entry.provider === "openai-compatible"
          ? entry.provider
          : existing?.provider ?? body.provider ?? currentSettings.provider;
      const baseUrl =
        typeof entry.baseUrl === "string" && entry.baseUrl.trim()
          ? entry.baseUrl.trim()
          : existing?.baseUrl ?? body.baseUrl ?? currentSettings.baseUrl;
      const defaultModel =
        typeof entry.defaultModel === "string" && entry.defaultModel.trim()
          ? entry.defaultModel.trim()
          : existing?.defaultModel ?? body.defaultModel ?? currentSettings.defaultModel;
      const availableModels = Array.isArray(entry.availableModels)
        ? entry.availableModels.filter((model): model is string => typeof model === "string" && Boolean(model.trim()))
        : existing?.availableModels ?? body.availableModels ?? currentSettings.availableModels;

      return {
        id,
        label:
          typeof entry.label === "string" && entry.label.trim()
            ? entry.label.trim()
            : existing?.label ?? `Key ${index + 1}`,
        apiKey,
        provider,
        baseUrl,
        defaultModel,
        availableModels: availableModels.length ? availableModels : [defaultModel],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

export async function GET() {
  const { settings, source } = await readAiSettingsStore();

  return NextResponse.json<AiSettingsResponse>({
    ok: true,
    settings: toPublicAiSettings(settings, source)
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as SaveAiSettingsRequest;
  const { settings: currentSettings } = await readAiSettingsStore();
  const nextApiKeys = buildNextApiKeys(body, currentSettings);
  const activeApiKeyId =
    typeof body.activeApiKeyId === "string" &&
    nextApiKeys.some((entry) => entry.id === body.activeApiKeyId)
      ? body.activeApiKeyId
      : nextApiKeys[0]?.id ?? null;
  const nextSettings = normalizeAiSettings({
    provider: body.provider ?? currentSettings.provider,
    baseUrl: body.baseUrl ?? currentSettings.baseUrl,
    apiKeys: nextApiKeys,
    activeApiKeyId,
    defaultModel: body.defaultModel ?? currentSettings.defaultModel,
    availableModels: body.availableModels ?? currentSettings.availableModels,
    updatedAt: new Date().toISOString()
  });

  if (!nextSettings.baseUrl || !nextSettings.defaultModel) {
    return NextResponse.json(
      {
        message: "请先填写 Base URL 和默认模型。"
      },
      { status: 400 }
    );
  }

  if (!nextSettings.apiKey) {
    return NextResponse.json(
      {
        message: "请至少保存一个 API Key。"
      },
      { status: 400 }
    );
  }

  await writeAiSettingsStore(nextSettings);

  return NextResponse.json<AiSettingsResponse>({
    ok: true,
    settings: toPublicAiSettings(nextSettings, "file"),
    message: "AI 配置已保存。"
  });
}
