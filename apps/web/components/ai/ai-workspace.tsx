"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type AiProvider = "deepseek" | "openai" | "openai-compatible";

type PublicAiSettings = {
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

type PublicAiApiKeyEntry = {
  id: string;
  label: string;
  maskedApiKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
};

type AiApiKeyDraft = {
  id: string;
  label: string;
  maskedApiKey: string;
  apiKey: string;
};

type AiSettingsDraft = {
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  apiKeys: AiApiKeyDraft[];
  activeApiKeyId: string | null;
  defaultModel: string;
  availableModelsText: string;
};

type AiSettingsResponse = {
  ok?: boolean;
  settings?: PublicAiSettings;
  message?: string;
  availableModels?: string[];
};

type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type AiChatResponse = {
  ok?: boolean;
  message?: string;
  model?: string;
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
  apiKeys: [],
  activeApiKeyId: null,
  defaultModel: "deepseek-v4-pro",
  availableModelsText: ["deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"].join("\n")
};

const starterPrompts = [
  "今天我应该优先处理什么？",
  "帮我整理一个内容选题",
  "把我现在的想法拆成行动步骤"
];

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDefaultBaseUrlByProvider(provider: AiProvider) {
  return provider === "deepseek" ? "https://api.deepseek.com/v1" : "https://api.openai.com/v1";
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

  const apiKeys =
    settings.apiKeys?.map((entry) => ({
      id: entry.id,
      label: entry.label,
      maskedApiKey: entry.maskedApiKey,
      apiKey: ""
    })) ?? [];

  return {
    provider: settings.provider,
    baseUrl: settings.baseUrl,
    apiKey: "",
    apiKeys,
    activeApiKeyId: settings.activeApiKeyId ?? apiKeys[0]?.id ?? null,
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
    return "系统配置";
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

function createNextApiKeyId(keys: AiApiKeyDraft[]) {
  let index = keys.length + 1;
  let id = `key-${index}`;

  while (keys.some((key) => key.id === id)) {
    index += 1;
    id = `key-${index}`;
  }

  return id;
}

export function AiWorkspace() {
  const [savedAiSettings, setSavedAiSettings] = useState<PublicAiSettings | null>(null);
  const [aiSettingsDraft, setAiSettingsDraft] = useState<AiSettingsDraft>(defaultAiSettingsDraft);
  const [settingsMessage, setSettingsMessage] = useState("正在读取 AI 配置...");
  const [chatStatus, setChatStatus] = useState("准备就绪。你可以把它当作 Life OS 的总入口来对话。");
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        "我是 Life OS 的 AI 工作台。现在先从通用对话开始，后面可以逐步接入财务、内容、健康和工具上下文。"
    }
  ]);

  const isConfigured = Boolean(savedAiSettings?.hasApiKey && savedAiSettings.defaultModel);
  const modelLabel = savedAiSettings?.defaultModel || aiSettingsDraft.defaultModel;
  const configSource = savedAiSettings ? formatAiConfigSource(savedAiSettings.source) : "读取中";
  const visibleMessages = useMemo(() => messages.slice(-24), [messages]);

  useEffect(() => {
    let isCancelled = false;

    async function loadAiSettings() {
      setIsLoadingSettings(true);

      try {
        const response = await fetch("/api/ai/settings");
        const data = (await response.json()) as AiSettingsResponse;

        if (!response.ok || !data.settings || isCancelled) {
          throw new Error(data.message || "load failed");
        }

        setSavedAiSettings(data.settings);
        setAiSettingsDraft(createAiSettingsDraft(data.settings));
        setSettingsMessage(
          data.settings.hasApiKey
            ? `已连接 ${formatAiConfigSource(data.settings.source)}，默认模型 ${data.settings.defaultModel}。`
            : "还没有保存 API Key。保存后，对话页会切换到真实模型。"
        );
      } catch {
        if (!isCancelled) {
          setSettingsMessage("暂时没有读取到 AI 配置，可以打开右上角配置补齐。");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSettings(false);
        }
      }
    }

    void loadAiSettings();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    function openSettingsFromHash() {
      if (window.location.hash === "#ai-config") {
        setIsSettingsOpen(true);
      }
    }

    openSettingsFromHash();
    window.addEventListener("hashchange", openSettingsFromHash);

    return () => {
      window.removeEventListener("hashchange", openSettingsFromHash);
    };
  }, []);

  function closeSettings() {
    setIsSettingsOpen(false);

    if (window.location.hash === "#ai-config") {
      history.replaceState(null, "", window.location.pathname);
    }
  }

  function handleAiProviderChange(provider: AiProvider) {
    setAiSettingsDraft((current) => {
      const nextDefaultModels = getDefaultModelsByProvider(provider);
      const shouldReplaceBaseUrl =
        !current.baseUrl.trim() || current.baseUrl === getDefaultBaseUrlByProvider(current.provider);
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

  function handleAddApiKey() {
    setAiSettingsDraft((current) => {
      const id = createNextApiKeyId(current.apiKeys);
      const nextApiKeys = current.apiKeys.concat({
        id,
        label: `Key ${current.apiKeys.length + 1}`,
        maskedApiKey: "",
        apiKey: ""
      });

      return {
        ...current,
        apiKeys: nextApiKeys,
        activeApiKeyId: current.activeApiKeyId ?? id
      };
    });
  }

  function handleUpdateApiKey(id: string, patch: Partial<AiApiKeyDraft>) {
    setAiSettingsDraft((current) => ({
      ...current,
      apiKeys: current.apiKeys.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              ...patch
            }
          : entry
      )
    }));
  }

  function handleDeleteApiKey(id: string) {
    setAiSettingsDraft((current) => {
      const nextApiKeys = current.apiKeys.filter((entry) => entry.id !== id);
      const nextActiveId =
        current.activeApiKeyId === id ? nextApiKeys[0]?.id ?? null : current.activeApiKeyId;

      return {
        ...current,
        apiKeys: nextApiKeys,
        activeApiKeyId: nextActiveId
      };
    });
  }

  async function handleTestAiSettings() {
    setIsTesting(true);
    setSettingsMessage("正在测试连接，并尝试读取模型列表...");

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

      setSettingsMessage(data.message || "连接成功。");
    } catch (error) {
      setSettingsMessage(
        error instanceof Error ? error.message : "测试连接失败，可以稍后再试。"
      );
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSaveAiSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setSettingsMessage("正在保存 AI 配置...");

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
          apiKeys: aiSettingsDraft.apiKeys.map((entry) => ({
            id: entry.id,
            label: entry.label,
            apiKey: entry.apiKey
          })),
          activeApiKeyId: aiSettingsDraft.activeApiKeyId,
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

      setSavedAiSettings(data.settings);
      setAiSettingsDraft(createAiSettingsDraft(data.settings));
      setSettingsMessage(data.message || `已保存，当前默认模型 ${data.settings.defaultModel}。`);
      setChatStatus(`AI 配置已更新：${data.settings.defaultModel}`);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "保存失败，可以稍后再试。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendMessage(event?: FormEvent<HTMLFormElement>, promptOverride?: string) {
    event?.preventDefault();

    const prompt = (promptOverride ?? input).trim();

    if (!prompt || isSending) {
      return;
    }

    const userMessage: AiChatMessage = {
      id: createMessageId("user"),
      role: "user",
      content: prompt
    };
    const nextMessages = messages.concat(userMessage);

    setMessages(nextMessages);
    setInput("");
    setIsSending(true);
    setChatStatus(`正在调用 ${modelLabel}...`);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content
          }))
        })
      });
      const data = (await response.json()) as AiChatResponse;

      if (!response.ok || !data.message) {
        throw new Error(data.message || "AI request failed");
      }

      setMessages((current) =>
        current.concat({
          id: createMessageId("assistant"),
          role: "assistant",
          content: data.message ?? ""
        })
      );
      setChatStatus(`已由 ${data.model || modelLabel} 回复。`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "AI 暂时不可用。你可以先检查右上角 AI 配置。";

      setMessages((current) =>
        current.concat({
          id: createMessageId("assistant"),
          role: "assistant",
          content: `这次没有成功调用模型：${message}`
        })
      );
      setChatStatus("对话请求失败。");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="ai-workspace">
      <header className="ai-workspace__header">
        <div>
          <p className="eyebrow">AI MODULE</p>
          <h1 className="ai-workspace__title">人生助手</h1>
          <p className="section-subtitle section-subtitle--body">
            这里会逐渐成为 Life OS 的对话入口。先能稳定聊天，再逐步接入内容、财务、健康和工具。
          </p>
        </div>
        <div className="ai-workspace__header-actions">
          <span className="mono-text mono-text--subtle">{configSource} / {modelLabel}</span>
          <button className="primary-button" type="button" onClick={() => setIsSettingsOpen(true)}>
            AI 配置
          </button>
        </div>
      </header>

      <div className="ai-workspace__grid">
        <aside className="ai-panel ai-panel--rail">
          <div className="ai-panel__header">
            <p className="eyebrow">THREADS</p>
            <h2 className="section-title">对话</h2>
          </div>
          <button className="ai-thread ai-thread--active" type="button">
            <span>Life OS 总助手</span>
            <span className="section-subtitle">当前会话</span>
          </button>
          <button className="ai-thread" type="button" disabled>
            <span>内容复盘</span>
            <span className="section-subtitle">稍后接入</span>
          </button>
          <button className="ai-thread" type="button" disabled>
            <span>财务问答</span>
            <span className="section-subtitle">稍后接入</span>
          </button>
        </aside>

        <section className="ai-panel ai-chat">
          <div className="ai-panel__header ai-panel__header--spread">
            <div>
              <p className="eyebrow">CHAT</p>
              <h2 className="section-title">对话工作台</h2>
            </div>
            <span className={`tag ${isConfigured ? "" : "tag--muted"}`}>
              {isConfigured ? "已接入模型" : "待配置 API Key"}
            </span>
          </div>

          <div className="ai-chat__messages" aria-live="polite">
            {visibleMessages.map((message) => (
              <article
                key={message.id}
                className={`ai-message ai-message--${message.role}`}
              >
                <p className="eyebrow">{message.role === "user" ? "YOU" : "LIFE OS"}</p>
                <div className="ai-message__body">
                  {message.content.split("\n").map((line, index) => (
                    <p key={`${message.id}-${index}`}>{line || "\u00a0"}</p>
                  ))}
                </div>
              </article>
            ))}
            {isSending ? (
              <article className="ai-message ai-message--assistant ai-message--loading">
                <p className="eyebrow">LIFE OS</p>
                <div className="ai-message__body">
                  <p>正在思考...</p>
                </div>
              </article>
            ) : null}
          </div>

          <div className="ai-starter-row">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                className="ghost-button ghost-button--small"
                type="button"
                onClick={() => void handleSendMessage(undefined, prompt)}
                disabled={isSending}
              >
                {prompt}
              </button>
            ))}
          </div>

          <form className="ai-composer" onSubmit={handleSendMessage}>
            <textarea
              className="field__input ai-composer__input"
              value={input}
              rows={2}
              placeholder="把你的想法、问题或任务交给 Life OS..."
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSendMessage();
                }
              }}
            />
            <button className="primary-button" type="submit" disabled={isSending || !input.trim()}>
              {isSending ? "发送中" : "发送"}
            </button>
          </form>
          <p className="section-subtitle">{chatStatus}</p>
        </section>

        <aside className="ai-panel ai-panel--status">
          <div className="ai-panel__header">
            <p className="eyebrow">STATUS</p>
            <h2 className="section-title">系统状态</h2>
          </div>
          <div className="settings-list">
            <div className="settings-row">
              <div className="settings-row__meta">
                <span className="section-subtitle">默认模型</span>
                <span>{modelLabel}</span>
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
                <span className="section-subtitle">配置来源</span>
                <span>{configSource}</span>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row__meta">
                <span className="section-subtitle">读取状态</span>
                <span>{isLoadingSettings ? "正在读取..." : "已就绪"}</span>
              </div>
            </div>
          </div>
          <button className="ghost-button" type="button" onClick={() => setIsSettingsOpen(true)}>
            打开配置
          </button>
          <div className="ai-capability-list">
            <p className="eyebrow">NEXT</p>
            <span>内容系统上下文</span>
            <span>财务数据问答</span>
            <span>健康数据复盘</span>
          </div>
        </aside>
      </div>

      {isSettingsOpen ? (
        <div className="content-modal" role="dialog" aria-modal="true" aria-label="AI 配置">
          <button
            className="content-modal__backdrop"
            type="button"
            aria-label="关闭 AI 配置"
            onClick={closeSettings}
          />
          <section className="content-modal__panel content-modal__panel--ai">
            <div className="content-modal__header">
              <div>
                <p className="eyebrow">AI CORE</p>
                <h2 className="section-title">AI 配置</h2>
                <p className="section-subtitle">
                  保存的是整个人生系统共用的模型入口，内容系统和未来模块都会读取这里。
                </p>
              </div>
              <button
                className="content-icon-button"
                type="button"
                aria-label="关闭 AI 配置"
                onClick={closeSettings}
              >
                ×
              </button>
            </div>

            <form className="content-modal__form" onSubmit={handleSaveAiSettings}>
              <section className="ai-key-manager">
                <div className="ai-key-manager__header">
                  <div>
                    <p className="eyebrow">API KEYS</p>
                    <h3 className="section-title">已保存密钥</h3>
                  </div>
                  <button className="ghost-button ghost-button--small" type="button" onClick={handleAddApiKey}>
                    + 新增
                  </button>
                </div>

                {aiSettingsDraft.apiKeys.length ? (
                  <div className="ai-key-list">
                    {aiSettingsDraft.apiKeys.map((entry, index) => (
                      <div
                        key={entry.id}
                        className={`ai-key-row ${
                          entry.id === aiSettingsDraft.activeApiKeyId ? "ai-key-row--active" : ""
                        }`}
                      >
                        <button
                          className="ghost-button ghost-button--small"
                          type="button"
                          onClick={() =>
                            setAiSettingsDraft((current) => ({
                              ...current,
                              activeApiKeyId: entry.id
                            }))
                          }
                        >
                          {entry.id === aiSettingsDraft.activeApiKeyId ? "当前" : "启用"}
                        </button>
                        <label className="field ai-key-row__label">
                          <span className="field__label">#{index + 1} 名称</span>
                          <input
                            className="field__input"
                            value={entry.label}
                            placeholder={`Key ${index + 1}`}
                            onChange={(event) =>
                              handleUpdateApiKey(entry.id, { label: event.target.value })
                            }
                          />
                        </label>
                        <label className="field ai-key-row__secret">
                          <span className="field__label">
                            {entry.maskedApiKey ? `已保存 ${entry.maskedApiKey}` : "新密钥"}
                          </span>
                          <input
                            className="field__input"
                            type="password"
                            value={entry.apiKey}
                            placeholder={entry.maskedApiKey ? "留空保持不变" : "粘贴 API Key"}
                            onChange={(event) =>
                              handleUpdateApiKey(entry.id, { apiKey: event.target.value })
                            }
                          />
                        </label>
                        <button
                          className="ghost-button ghost-button--small ghost-button--danger"
                          type="button"
                          onClick={() => handleDeleteApiKey(entry.id)}
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="content-empty-note">
                    还没有保存的 API Key。点“新增”添加一个，保存后只会显示脱敏值。
                  </div>
                )}
              </section>

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

              <div className="content-modal__actions content-modal__actions--split">
                <span className="section-subtitle">{settingsMessage}</span>
                <div className="content-modal__action-group">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={handleTestAiSettings}
                    disabled={isTesting || isSaving}
                  >
                    {isTesting ? "测试中..." : "测试连接"}
                  </button>
                  <button className="primary-button" type="submit" disabled={isSaving || isTesting}>
                    {isSaving ? "保存中..." : "保存设置"}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
