import { NextResponse } from "next/server";
import {
  normalizeAiSettings,
  readAiSettingsStore,
  type AiProvider
} from "../../../../../lib/ai-settings-store";

export const runtime = "nodejs";

type TestAiSettingsRequest = {
  apiKeyId?: string | null;
  provider?: AiProvider;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  availableModels?: string[];
};

type ModelListResponse = {
  data?: unknown;
  models?: unknown;
  result?: unknown;
  items?: unknown;
  model_list?: unknown;
  error?: {
    message?: string;
  };
};

type TestAiSettingsResponse = {
  ok: true;
  message: string;
  availableModels: string[];
};

function uniqueModels(models: string[]) {
  return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));
}

function getCurrentProviderModels(provider: AiProvider) {
  if (provider === "deepseek") {
    return ["deepseek-v4-pro", "deepseek-v4-flash"];
  }

  return [];
}

function collectModelIds(source: unknown) {
  const ids: string[] = [];
  const modelKeys = ["id", "model", "name", "model_id", "modelId", "modelName"];
  const containerKeys = ["data", "models", "result", "items", "model_list"];

  function visit(node: unknown) {
    if (!node) {
      return;
    }

    if (typeof node === "string") {
      ids.push(node);
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (typeof node !== "object") {
      return;
    }

    const record = node as Record<string, unknown>;

    for (const key of modelKeys) {
      const value = record[key];

      if (typeof value === "string") {
        ids.push(value);
      }
    }

    for (const key of containerKeys) {
      visit(record[key]);
    }
  }

  visit(source);

  return uniqueModels(ids);
}

export async function POST(request: Request) {
  const body = (await request.json()) as TestAiSettingsRequest;
  const { settings: currentSettings } = await readAiSettingsStore();
  const selectedKey =
    typeof body.apiKeyId === "string"
      ? currentSettings.apiKeys.find((entry) => entry.id === body.apiKeyId)
      : undefined;
  const effectiveSettings = normalizeAiSettings({
    provider: body.provider ?? selectedKey?.provider ?? currentSettings.provider,
    baseUrl: body.baseUrl ?? selectedKey?.baseUrl ?? currentSettings.baseUrl,
    apiKey:
      typeof body.apiKey === "string" && body.apiKey.trim()
        ? body.apiKey.trim()
        : selectedKey?.apiKey
        ? selectedKey.apiKey
        : currentSettings.apiKey,
    defaultModel: body.defaultModel ?? selectedKey?.defaultModel ?? currentSettings.defaultModel,
    availableModels:
      body.availableModels ?? selectedKey?.availableModels ?? currentSettings.availableModels
  });

  if (!effectiveSettings.baseUrl || !effectiveSettings.apiKey) {
    return NextResponse.json(
      {
        message: "请先填写 Base URL 和 API Key。"
      },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${effectiveSettings.baseUrl.replace(/\/$/, "")}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${effectiveSettings.apiKey}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal
    });
    const data = (await response.json()) as ModelListResponse;

    if (!response.ok) {
      return NextResponse.json(
        {
          message: data.error?.message ?? "模型接口连接失败。"
        },
        { status: response.status }
      );
    }

    const fetchedModels = collectModelIds(data);
    const currentProviderModels = getCurrentProviderModels(effectiveSettings.provider);
    const fallbackModels = uniqueModels([
      effectiveSettings.defaultModel,
      ...currentProviderModels,
      ...effectiveSettings.availableModels
    ]);
    const availableModels = fetchedModels.length
      ? uniqueModels([effectiveSettings.defaultModel, ...currentProviderModels, ...fetchedModels])
      : fallbackModels;
    const message = fetchedModels.length
      ? `连接成功，已读取到 ${fetchedModels.length} 个模型。`
      : "连接成功，但模型接口没有返回可识别的模型列表，暂时保留当前列表。";

    return NextResponse.json<TestAiSettingsResponse>({
      ok: true,
      message,
      availableModels
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "测试连接失败。";

    return NextResponse.json(
      {
        message
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
