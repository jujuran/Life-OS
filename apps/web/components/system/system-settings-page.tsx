"use client";

import { useEffect, useState, type FormEvent } from "react";

type AiProvider = "deepseek" | "openai" | "openai-compatible";

type PublicAiSettings = {
  provider: AiProvider;
  baseUrl: string;
  defaultModel: string;
  availableModels: string[];
  hasApiKey: boolean;
  maskedApiKey: string;
  updatedAt: string | null;
  source: "file" | "env" | "default";
};

type AiSettingsDraft = {
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  availableModelsText: string;
};

type AiSettingsResponse = {
  ok?: boolean;
  settings?: PublicAiSettings;
  message?: string;
  availableModels?: string[];
};

const aiProviderOptions: Array<{ value: AiProvider; label: string }> = [
  { value: "deepseek", label: "DeepSeek" },
  { value: "openai", label: "OpenAI" },
  { value: "openai-compatible", label: "OpenAI Compatible" }
];

const defaultAiSettingsDraft: AiSettingsDraft = {
  provider: "deepseek",
  baseUrl: "https://api.deepseek.com/v1",
  apiKey: "",
  defaultModel: "deepseek-v4-pro",
  availableModelsText: ["deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"].join("\n")
};

function getDefaultBaseUrlByProvider(provider: AiProvider) {
  if (provider === "deepseek") {
    return "https://api.deepseek.com/v1";
  }

  return "https://api.openai.com/v1";
}

function getDefaultModelsByProvider(provider: AiProvider) {
  if (provider === "deepseek") {
    return ["deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"];
  }

  if (provider === "openai") {
    return ["gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini"];
  }

  return [];
}

function createAiSettingsDraft(settings?: PublicAiSettings): AiSettingsDraft {
  if (!settings) {
    return defaultAiSettingsDraft;
  }

  return {
    provider: settings.provider,
    baseUrl: settings.baseUrl,
    apiKey: "",
    defaultModel: settings.defaultModel,
    availableModelsText: settings.availableModels.join("\n")
  };
}

function parseAiModelsText(text: string, defaultModel: string) {
  const unique = new Set<string>();

  for (const line of text.split(/\r?\n|,/)) {
    const trimmed = line.trim();

    if (trimmed) {
      unique.add(trimmed);
    }
  }

  if (defaultModel.trim()) {
    unique.add(defaultModel.trim());
  }

  return Array.from(unique);
}

function formatAiConfigSource(source: PublicAiSettings["source"]) {
  if (source === "file") {
    return "系统内配置";
  }

  if (source === "env") {
    return "环境变量";
  }

  return "默认占位";
}

function formatAiUpdatedAt(updatedAt: string | null) {
  if (!updatedAt) {
    return "尚未保存";
  }

  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(updatedAt));
  } catch {
    return updatedAt;
  }
}

export function SystemSettingsPage() {
  const [savedAiSettings, setSavedAiSettings] = useState<PublicAiSettings | null>(null);
  const [aiSettingsDraft, setAiSettingsDraft] = useState<AiSettingsDraft>(defaultAiSettingsDraft);
  const [statusMessage, setStatusMessage] = useState(
    "AI 统一在这里配置。保存后，内容系统会直接读取这份设置。"
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadAiSettings() {
      setIsLoading(true);

      try {
        const response = await fetch("/api/ai/settings");
        const data = (await response.json()) as AiSettingsResponse;

        if (!response.ok || !data.settings || isCancelled) {
          throw new Error(data.message || "load failed");
        }

        setSavedAiSettings(data.settings);
        setAiSettingsDraft(createAiSettingsDraft(data.settings));
        setStatusMessage(
          data.settings.hasApiKey
            ? `当前已连接 ${formatAiConfigSource(data.settings.source)}，默认模型 ${data.settings.defaultModel}。`
            : "AI 还没有保存 API Key，保存后系统就会切到真实模型。"
        );
      } catch {
        if (!isCancelled) {
          setStatusMessage("AI 设置暂时还没读到，我们稍后可以再试一次。");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAiSettings();

    return () => {
      isCancelled = true;
    };
  }, []);

  function handleAiProviderChange(provider: AiProvider) {
    setAiSettingsDraft((current) => {
      const nextDefaultModels = getDefaultModelsByProvider(provider);
      const shouldReplaceBaseUrl =
        !current.baseUrl.trim() ||
        current.baseUrl === getDefaultBaseUrlByProvider(current.provider);
      const shouldReplaceDefaultModel =
        !current.defaultModel.trim() ||
        getDefaultModelsByProvider(current.provider).includes(current.defaultModel);
      const nextDefaultModel = shouldReplaceDefaultModel
        ? nextDefaultModels[0] ?? current.defaultModel
        : current.defaultModel;
      const shouldReplaceModelList =
        !current.availableModelsText.trim() ||
        current.availableModelsText === getDefaultModelsByProvider(current.provider).join("\n");

      return {
        ...current,
        provider,
        baseUrl: shouldReplaceBaseUrl ? getDefaultBaseUrlByProvider(provider) : current.baseUrl,
        defaultModel: nextDefaultModel,
        availableModelsText: shouldReplaceModelList
          ? nextDefaultModels.join("\n")
          : current.availableModelsText
      };
    });
  }

  async function handleTestAiSettings() {
    setIsTesting(true);
    setStatusMessage("正在测试连接，并尝试读取模型列表...");

    try {
      const response = await fetch("/api/ai/settings/test", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          provider: aiSettingsDraft.provider,
          baseUrl: aiSettingsDraft.baseUrl,
          apiKey: aiSettingsDraft.apiKey,
          defaultModel: aiSettingsDraft.defaultModel,
          availableModels: parseAiModelsText(
            aiSettingsDraft.availableModelsText,
            aiSettingsDraft.defaultModel
          )
        })
      });
      const data = (await response.json()) as AiSettingsResponse;

      if (!response.ok) {
        throw new Error(data.message || "test failed");
      }

      if (Array.isArray(data.availableModels) && data.availableModels.length) {
        setAiSettingsDraft((current) => ({
          ...current,
          availableModelsText: data.availableModels?.join("\n") ?? current.availableModelsText
        }));
      }

      setStatusMessage(data.message || "连接成功。");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "测试连接失败了，我们稍后再试一次。"
      );
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSaveAiSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatusMessage("正在保存 AI 设置...");

    try {
      const response = await fetch("/api/ai/settings", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          provider: aiSettingsDraft.provider,
          baseUrl: aiSettingsDraft.baseUrl,
          apiKey: aiSettingsDraft.apiKey,
          defaultModel: aiSettingsDraft.defaultModel,
          availableModels: parseAiModelsText(
            aiSettingsDraft.availableModelsText,
            aiSettingsDraft.defaultModel
          )
        })
      });
      const data = (await response.json()) as AiSettingsResponse;

      if (!response.ok || !data.settings) {
        throw new Error(data.message || "save failed");
      }

      const savedSettings = data.settings;
      setSavedAiSettings(savedSettings);
      setAiSettingsDraft(createAiSettingsDraft(savedSettings));
      setStatusMessage(data.message || `AI 设置已保存，当前默认模型 ${savedSettings.defaultModel}。`);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "保存失败了，我们稍后再试一次。"
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="settings-page">
      <header className="settings-page__header">
        <div className="settings-page__intro">
          <p className="eyebrow">AI MODULE</p>
          <h1 className="home-console__title">AI 模块</h1>
          <p className="section-subtitle section-subtitle--body">
            这里先作为人生系统的 AI 接入中心。现在先放统一配置，后面再慢慢扩展成提示词、
            Agent、任务分发和模型策略的工作台。
          </p>
        </div>
        <div className="settings-page__actions">
          <span className="mono-text mono-text--subtle">
            {savedAiSettings
              ? `${formatAiConfigSource(savedAiSettings.source)} / ${savedAiSettings.defaultModel}`
              : "等待读取"}
          </span>
        </div>
      </header>

      <div className="settings-grid">
        <section className="settings-card settings-card--span-2" id="ai-config">
          <div className="settings-card__header">
            <div className="settings-page__intro">
              <p className="eyebrow">AI CORE</p>
              <h2 className="section-title">AI 接入设置</h2>
              <p className="section-subtitle section-subtitle--body">
                保存的是整个人生系统的统一 AI 配置，不再打断内容系统、财务系统或工具模块本身的页面布局。
              </p>
            </div>
          </div>

          <form className="system-settings-form" onSubmit={handleSaveAiSettings}>
            <div className="content-modal__form-grid">
              <label className="field">
                <span className="field__label">Provider</span>
                <select
                  className="field__input"
                  value={aiSettingsDraft.provider}
                  onChange={(event) => handleAiProviderChange(event.target.value as AiProvider)}
                >
                  {aiProviderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field__label">Base URL</span>
                <input
                  className="field__input"
                  value={aiSettingsDraft.baseUrl}
                  placeholder="https://api.deepseek.com/v1"
                  onChange={(event) =>
                    setAiSettingsDraft((current) => ({
                      ...current,
                      baseUrl: event.target.value
                    }))
                  }
                />
              </label>
            </div>

            <div className="content-modal__form-grid">
              <label className="field">
                <span className="field__label">API Key</span>
                <input
                  className="field__input"
                  type="password"
                  value={aiSettingsDraft.apiKey}
                  placeholder={
                    savedAiSettings?.hasApiKey
                      ? `已保存：${savedAiSettings.maskedApiKey}，留空则保持不变`
                      : "输入新的 API Key"
                  }
                  onChange={(event) =>
                    setAiSettingsDraft((current) => ({
                      ...current,
                      apiKey: event.target.value
                    }))
                  }
                />
              </label>

              <label className="field">
                <span className="field__label">默认模型</span>
                <input
                  className="field__input"
                  value={aiSettingsDraft.defaultModel}
                  placeholder="例如 deepseek-v4-pro"
                  onChange={(event) =>
                    setAiSettingsDraft((current) => ({
                      ...current,
                      defaultModel: event.target.value
                    }))
                  }
                />
              </label>
            </div>

            <label className="field">
              <span className="field__label">可切换模型列表</span>
              <textarea
                className="field__input system-settings__models"
                value={aiSettingsDraft.availableModelsText}
                placeholder={["deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"].join("\n")}
                onChange={(event) =>
                  setAiSettingsDraft((current) => ({
                    ...current,
                    availableModelsText: event.target.value
                  }))
                }
              />
            </label>

            <div className="system-settings__meta">
              <span>配置来源：{savedAiSettings ? formatAiConfigSource(savedAiSettings.source) : "未读取"}</span>
              <span>最近更新：{savedAiSettings ? formatAiUpdatedAt(savedAiSettings.updatedAt) : "尚未保存"}</span>
              <span>保存位置：本机私人数据目录</span>
            </div>

            <p className="content-form-note system-settings__note">
              先点“测试连接”，确认接口可用后再保存。保存后，内容系统会自动读取这里的默认模型。
            </p>

            <div className="settings-page__footer">
              <span className="section-subtitle">{statusMessage}</span>
              <div className="settings-page__actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={handleTestAiSettings}
                  disabled={isTesting || isSaving}
                >
                  {isTesting ? "测试中..." : "测试连接"}
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={isSaving || isTesting}
                >
                  {isSaving ? "保存中..." : "保存设置"}
                </button>
              </div>
            </div>
          </form>
        </section>

        <aside className="settings-card">
          <div className="settings-card__header">
            <div className="settings-page__intro">
              <p className="eyebrow">STATUS</p>
              <h2 className="section-title">当前状态</h2>
            </div>
          </div>

          <div className="settings-list">
            <div className="settings-row">
              <div className="settings-row__meta">
                <span className="section-subtitle">当前默认模型</span>
                <span>{savedAiSettings?.defaultModel || aiSettingsDraft.defaultModel}</span>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row__meta">
                <span className="section-subtitle">API Key</span>
                <span>{savedAiSettings?.hasApiKey ? savedAiSettings.maskedApiKey : "尚未保存"}</span>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row__meta">
                <span className="section-subtitle">接入范围</span>
                <span>内容系统已接入，后续财务、健康、工具都可以继续共用。</span>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row__meta">
                <span className="section-subtitle">读取状态</span>
                <span>{isLoading ? "正在读取..." : "已就绪"}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
