"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

type AiProvider = "deepseek" | "openai" | "openai-compatible";

type PublicAiApiKeyEntry = {
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

type AiKeyDraft = {
  id: string;
  label: string;
  maskedApiKey: string;
  apiKey: string;
  presetId: string;
  provider: AiProvider;
  baseUrl: string;
  defaultModel: string;
  availableModelsText: string;
};

type AiSettingsDraft = {
  apiKeys: AiKeyDraft[];
  activeApiKeyId: string | null;
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

type AiPreset = {
  id: string;
  label: string;
  provider: AiProvider;
  baseUrl: string;
  models: string[];
};

const aiPresets: AiPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-v4-pro", "deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner"]
  },
  {
    id: "openai",
    label: "OpenAI",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini"]
  },
  {
    id: "xai",
    label: "xAI / Grok",
    provider: "openai-compatible",
    baseUrl: "https://api.x.ai/v1",
    models: ["grok-4", "grok-3", "grok-3-mini"]
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    provider: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    models: ["openai/gpt-4.1", "anthropic/claude-3.5-sonnet", "google/gemini-2.5-pro"]
  },
  {
    id: "moonshot",
    label: "Moonshot / Kimi",
    provider: "openai-compatible",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"]
  },
  {
    id: "qwen",
    label: "阿里 Qwen",
    provider: "openai-compatible",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-plus", "qwen-max", "qwen-turbo"]
  },
  {
    id: "siliconflow",
    label: "SiliconFlow",
    provider: "openai-compatible",
    baseUrl: "https://api.siliconflow.cn/v1",
    models: ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct"]
  },
  {
    id: "custom",
    label: "自定义",
    provider: "openai-compatible",
    baseUrl: "",
    models: []
  }
];

const starterPrompts = [
  "今天我应该优先处理什么？",
  "帮我整理一个内容选题",
  "把我现在的想法拆成行动步骤"
];

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createKeyId(keys: AiKeyDraft[]) {
  let index = keys.length + 1;
  let id = `key-${index}`;

  while (keys.some((key) => key.id === id)) {
    index += 1;
    id = `key-${index}`;
  }

  return id;
}

function modelTextToList(text: string, defaultModel: string) {
  const models = new Set<string>();

  for (const item of text.split(/\r?\n|,/)) {
    const trimmed = item.trim();

    if (trimmed) {
      models.add(trimmed);
    }
  }

  if (defaultModel.trim()) {
    models.add(defaultModel.trim());
  }

  return Array.from(models);
}

function getServicePreset(presetId: string) {
  return aiPresets.find((preset) => preset.id === presetId && preset.id !== "custom");
}

function getEffectiveModels(key: AiKeyDraft) {
  const savedModels = modelTextToList(key.availableModelsText, key.defaultModel);

  if (savedModels.length) {
    return savedModels;
  }

  const preset = getServicePreset(key.presetId);

  if (preset?.models.length) {
    return preset.models;
  }

  return [];
}

function getEffectiveDefaultModel(key: AiKeyDraft) {
  const models = getEffectiveModels(key);

  if (models.includes(key.defaultModel)) {
    return key.defaultModel;
  }

  return models[0] ?? key.defaultModel;
}

function getEffectiveProvider(key: AiKeyDraft) {
  return getServicePreset(key.presetId)?.provider ?? key.provider;
}

function normalizeKeyForRequest(key: AiKeyDraft) {
  const availableModels = getEffectiveModels(key);
  const defaultModel = getEffectiveDefaultModel(key);

  return {
    provider: getEffectiveProvider(key),
    baseUrl: key.baseUrl,
    defaultModel,
    availableModels
  };
}

function createPresetPatch(preset: AiPreset): Partial<AiKeyDraft> {
  return {
    presetId: preset.id,
    provider: preset.provider,
    baseUrl: preset.baseUrl,
    defaultModel: preset.models[0] ?? "",
    availableModelsText: preset.models.join("\n")
  };
}

function applyPresetToDraft(
  current: AiSettingsDraft,
  keyId: string | undefined,
  presetId: string
): AiSettingsDraft {
  const preset = aiPresets.find((item) => item.id === presetId);

  if (!preset) {
    return current;
  }

  const targetId =
    keyId && current.apiKeys.some((key) => key.id === keyId)
      ? keyId
      : current.activeApiKeyId ?? current.apiKeys[0]?.id ?? null;

  if (!targetId) {
    return current;
  }

  return {
    ...current,
    activeApiKeyId: targetId,
    apiKeys: current.apiKeys.map((key) =>
      key.id === targetId ? { ...key, ...createPresetPatch(preset) } : key
    )
  };
}

function detectPresetId(key: {
  provider: AiProvider;
  baseUrl: string;
  defaultModel: string;
  availableModelsText: string;
}) {
  const exactPreset = aiPresets.find(
    (preset) => preset.baseUrl === key.baseUrl && preset.provider === key.provider
  );

  if (exactPreset) {
    return exactPreset.id;
  }

  const modelText = `${key.defaultModel}\n${key.availableModelsText}`.toLowerCase();

  if (modelText.includes("grok")) {
    return "xai";
  }

  if (modelText.includes("moonshot")) {
    return "moonshot";
  }

  if (modelText.includes("qwen")) {
    return "qwen";
  }

  if (modelText.includes("siliconflow")) {
    return "siliconflow";
  }

  if (modelText.includes("openai/") || modelText.includes("anthropic/") || modelText.includes("google/")) {
    return "openrouter";
  }

  if (modelText.includes("gpt-")) {
    return "openai";
  }

  if (modelText.includes("deepseek")) {
    return "deepseek";
  }

  return "custom";
}

type InitialDraftOptions = {
  editKeyId?: string | null;
  newKey?: boolean;
  presetId?: string | null;
};

function createDraftFromSettings(
  settings?: PublicAiSettings | null,
  options: InitialDraftOptions = {}
): AiSettingsDraft {
  function finalizeDraft(draft: AiSettingsDraft) {
    const targetKeyId =
      options.editKeyId && draft.apiKeys.some((key) => key.id === options.editKeyId)
        ? options.editKeyId
        : draft.activeApiKeyId ?? draft.apiKeys[0]?.id ?? null;
    const withTarget = {
      ...draft,
      activeApiKeyId: targetKeyId
    };

    return options.presetId
      ? applyPresetToDraft(withTarget, targetKeyId ?? undefined, options.presetId)
      : withTarget;
  }

  if (!settings) {
    const preset = aiPresets[0];

    return finalizeDraft({
      activeApiKeyId: null,
      apiKeys: [
        {
          id: "key-1",
          label: "Key 1",
          maskedApiKey: "",
          apiKey: "",
          presetId: preset.id,
          provider: preset.provider,
          baseUrl: preset.baseUrl,
          defaultModel: preset.models[0] ?? "",
          availableModelsText: preset.models.join("\n")
        }
      ]
    });
  }

  const apiKeys = settings.apiKeys.length
    ? settings.apiKeys.map((entry) => {
        const availableModelsText = entry.availableModels.join("\n");

        return {
          id: entry.id,
          label: entry.label,
          maskedApiKey: entry.maskedApiKey,
          apiKey: "",
          presetId: detectPresetId({
            provider: entry.provider,
            baseUrl: entry.baseUrl,
            defaultModel: entry.defaultModel,
            availableModelsText
          }),
          provider: entry.provider,
          baseUrl: entry.baseUrl,
          defaultModel: entry.defaultModel,
          availableModelsText
        };
      })
    : [
        {
          id: "key-1",
          label: "Key 1",
          maskedApiKey: settings.maskedApiKey,
          apiKey: "",
          presetId: detectPresetId({
            provider: settings.provider,
            baseUrl: settings.baseUrl,
            defaultModel: settings.defaultModel,
            availableModelsText: settings.availableModels.join("\n")
          }),
          provider: settings.provider,
          baseUrl: settings.baseUrl,
          defaultModel: settings.defaultModel,
          availableModelsText: settings.availableModels.join("\n")
        }
      ];

  let draft: AiSettingsDraft = {
    apiKeys,
    activeApiKeyId: settings.activeApiKeyId ?? apiKeys[0]?.id ?? null
  };

  if (options.newKey) {
    const id = createKeyId(draft.apiKeys);
    const preset = options.presetId ? getServicePreset(options.presetId) ?? aiPresets[0] : aiPresets[0];

    draft = {
      apiKeys: draft.apiKeys.concat({
        id,
        label: `Key ${draft.apiKeys.length + 1}`,
        maskedApiKey: "",
        apiKey: "",
        presetId: preset.id,
        provider: preset.provider,
        baseUrl: preset.baseUrl,
        defaultModel: preset.models[0] ?? "",
        availableModelsText: preset.models.join("\n")
      }),
      activeApiKeyId: id
    };
  }

  return finalizeDraft(draft);
}

function formatConfigSource(source: PublicAiSettings["source"]) {
  if (source === "file") {
    return "系统配置";
  }

  if (source === "env") {
    return "环境变量";
  }

  return "默认占位";
}

function createSettingsMessage(settings: PublicAiSettings | null) {
  if (!settings) {
    return "正在读取 AI 配置...";
  }

  if (!settings.hasApiKey) {
    return "还没有保存 API Key。";
  }

  return `已读取 ${formatConfigSource(settings.source)}，当前模型 ${settings.defaultModel}。`;
}

function formatProviderType(provider: AiProvider) {
  if (provider === "openai-compatible") {
    return "OpenAI Compatible";
  }

  if (provider === "openai") {
    return "OpenAI";
  }

  return "DeepSeek";
}

type AiWorkspaceV2Props = {
  initialEditKeyId?: string | null;
  initialNewKey?: boolean;
  initialOpenSettings?: boolean;
  initialPresetId?: string | null;
  initialSettings?: PublicAiSettings | null;
};

export function AiWorkspaceV2({
  initialEditKeyId = null,
  initialNewKey = false,
  initialOpenSettings = false,
  initialPresetId = null,
  initialSettings = null
}: AiWorkspaceV2Props) {
  const [savedSettings, setSavedSettings] = useState<PublicAiSettings | null>(initialSettings);
  const [draft, setDraft] = useState<AiSettingsDraft>(() =>
    createDraftFromSettings(initialSettings, {
      editKeyId: initialEditKeyId,
      newKey: initialNewKey,
      presetId: initialPresetId
    })
  );
  const [settingsMessage, setSettingsMessage] = useState(() => createSettingsMessage(initialSettings));
  const [chatStatus, setChatStatus] = useState("准备就绪。");
  const [isSettingsOpen, setIsSettingsOpen] = useState(initialOpenSettings);
  const [isLoadingSettings, setIsLoadingSettings] = useState(!initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      content: "我是 Life OS 的 AI 工作台。现在先从通用对话开始，后续再逐步接入内容、财务、健康和工具上下文。"
    }
  ]);

  const activeKey = draft.apiKeys.find((key) => key.id === draft.activeApiKeyId) ?? draft.apiKeys[0];
  const activeModels = activeKey ? getEffectiveModels(activeKey) : [];
  const activeDefaultModel = activeKey ? getEffectiveDefaultModel(activeKey) : "";
  const modelLabel = savedSettings?.defaultModel ?? activeDefaultModel ?? "未配置模型";
  const configSource = savedSettings ? formatConfigSource(savedSettings.source) : "读取中";
  const visibleMessages = useMemo(() => messages.slice(-24), [messages]);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsSettingsOpen(initialOpenSettings);
  }, [initialOpenSettings]);

  useEffect(() => {
    const messageList = messagesRef.current;

    if (!messageList) {
      return;
    }

    messageList.scrollTop = messageList.scrollHeight;
  }, [visibleMessages.length, isSending]);

  useEffect(() => {
    let isCancelled = false;

    async function loadSettings() {
      setIsLoadingSettings(true);

      try {
        const response = await fetch("/api/ai/settings");
        const data = (await response.json()) as AiSettingsResponse;

        if (!response.ok || !data.settings || isCancelled) {
          throw new Error(data.message || "load failed");
        }

        setSavedSettings(data.settings);
        setDraft(createDraftFromSettings(data.settings));
        setSettingsMessage(createSettingsMessage(data.settings));
      } catch {
        if (!isCancelled) {
          setSettingsMessage("暂时没有读取到 AI 配置。");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSettings(false);
        }
      }
    }

    void loadSettings();

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

  useEffect(() => {
    function handleNativePresetClick(event: MouseEvent) {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("[data-preset-id]")
        : null;
      const presetId = target?.dataset.presetId;

      if (!presetId) {
        return;
      }

      setDraft((current) => applyPresetToDraft(current, undefined, presetId));
    }

    document.addEventListener("click", handleNativePresetClick);

    return () => {
      document.removeEventListener("click", handleNativePresetClick);
    };
  }, []);

  function updateKey(id: string, patch: Partial<AiKeyDraft>) {
    setDraft((current) => ({
      ...current,
      apiKeys: current.apiKeys.map((key) => (key.id === id ? { ...key, ...patch } : key))
    }));
  }

  function applyPreset(keyId: string | undefined, presetId: string) {
    setDraft((current) => applyPresetToDraft(current, keyId, presetId));
  }

  function deleteKey(id: string) {
    setDraft((current) => {
      const nextKeys = current.apiKeys.filter((key) => key.id !== id);

      return {
        apiKeys: nextKeys,
        activeApiKeyId:
          current.activeApiKeyId === id ? nextKeys[0]?.id ?? null : current.activeApiKeyId
      };
    });
  }

  function moveKey(id: string, direction: -1 | 1) {
    setDraft((current) => {
      const index = current.apiKeys.findIndex((key) => key.id === id);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.apiKeys.length) {
        return current;
      }

      const nextKeys = current.apiKeys.slice();
      const [item] = nextKeys.splice(index, 1);
      nextKeys.splice(nextIndex, 0, item);

      return {
        ...current,
        apiKeys: nextKeys
      };
    });
  }

  async function testActiveKey() {
    if (!activeKey) {
      setSettingsMessage("请先新增一个 API Key。");
      return;
    }

    setIsTesting(true);
    setSettingsMessage(`正在测试 ${activeKey.label}...`);

    try {
      const activePayload = normalizeKeyForRequest(activeKey);
      const response = await fetch("/api/ai/settings/test", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          apiKeyId: activeKey.id,
          provider: activePayload.provider,
          baseUrl: activePayload.baseUrl,
          apiKey: activeKey.apiKey,
          defaultModel: activePayload.defaultModel,
          availableModels: activePayload.availableModels
        })
      });
      const data = (await response.json()) as AiSettingsResponse;

      if (!response.ok) {
        throw new Error(data.message || "连接失败。");
      }

      if (data.availableModels?.length) {
        const nextDefaultModel = data.availableModels.includes(activeKey.defaultModel)
          ? activeKey.defaultModel
          : data.availableModels[0] ?? activeKey.defaultModel;

        updateKey(activeKey.id, {
          defaultModel: nextDefaultModel,
          availableModelsText: data.availableModels.join("\n")
        });
      }

      setSettingsMessage(data.message || `${activeKey.label} 连接成功。`);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : `${activeKey.label} 连接失败。`);
    } finally {
      setIsTesting(false);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setSettingsMessage("正在保存 AI 配置...");

    try {
      const active = activeKey ?? draft.apiKeys[0];
      const activePayload = active ? normalizeKeyForRequest(active) : null;
      const response = await fetch("/api/ai/settings", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          provider: activePayload?.provider,
          baseUrl: activePayload?.baseUrl,
          defaultModel: activePayload?.defaultModel,
          availableModels: activePayload?.availableModels ?? [],
          activeApiKeyId: draft.activeApiKeyId,
          apiKeys: draft.apiKeys.map((key) => {
            const payload = normalizeKeyForRequest(key);

            return {
              id: key.id,
              label: key.label,
              apiKey: key.apiKey,
              provider: payload.provider,
              baseUrl: payload.baseUrl,
              defaultModel: payload.defaultModel,
              availableModels: payload.availableModels
            };
          })
        })
      });
      const data = (await response.json()) as AiSettingsResponse;

      if (!response.ok || !data.settings) {
        throw new Error(data.message || "保存失败。");
      }

      setSavedSettings(data.settings);
      setDraft(createDraftFromSettings(data.settings));
      setSettingsMessage(data.message || "AI 配置已保存。");
      setChatStatus(`当前模型：${data.settings.defaultModel}`);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setIsSaving(false);
    }
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>, promptOverride?: string) {
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
        throw new Error(data.message || "AI 请求失败。");
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
      setMessages((current) =>
        current.concat({
          id: createMessageId("assistant"),
          role: "assistant",
          content: `这次没有成功调用模型：${
            error instanceof Error ? error.message : "未知错误"
          }`
        })
      );
      setChatStatus("对话请求失败。");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="ai-workspace">
      <header className="ai-workspace__header ai-workspace__header--compact">
        <div>
          <p className="eyebrow">AI MODULE</p>
          <h1 className="ai-workspace__title">AI 工作台</h1>
          <p className="section-subtitle section-subtitle--body">
            通用对话入口。当前先读取全局启用的 API 配置，后续再逐步接入各系统上下文。
          </p>
        </div>
        <div className="ai-workspace__header-actions">
          <span className="mono-text mono-text--subtle">
            {configSource} / {modelLabel}
          </span>
          <a className="primary-button" href="/ai?config=1">
            AI 配置
          </a>
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
            <span className={`tag ${savedSettings?.hasApiKey ? "" : "tag--muted"}`}>
              {savedSettings?.hasApiKey ? "已接入模型" : "待配置 API Key"}
            </span>
          </div>

          <div ref={messagesRef} className="ai-chat__messages" aria-live="polite">
            {visibleMessages.map((message) => (
              <article key={message.id} className={`ai-message ai-message--${message.role}`}>
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
                onClick={() => void sendMessage(undefined, prompt)}
                disabled={isSending}
              >
                {prompt}
              </button>
            ))}
          </div>

          <form className="ai-composer" onSubmit={sendMessage}>
            <textarea
              className="field__input ai-composer__input"
              value={input}
              rows={2}
              placeholder="把你的想法、问题或任务交给 Life OS..."
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
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
                <span className="section-subtitle">当前 Key</span>
                <span>{activeKey?.label ?? "尚未配置"}</span>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row__meta">
                <span className="section-subtitle">默认模型</span>
                <span>{modelLabel}</span>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row__meta">
                <span className="section-subtitle">读取状态</span>
                <span>{isLoadingSettings ? "正在读取..." : "已就绪"}</span>
              </div>
            </div>
          </div>
          <a className="ghost-button" href="/ai?config=1">
            打开配置
          </a>
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
          <a
            className="content-modal__backdrop"
            href="/ai"
            target="_self"
            aria-label="关闭 AI 配置"
          />
          <section className="content-modal__panel content-modal__panel--ai">
            <div className="content-modal__header">
              <div>
                <p className="eyebrow">AI CORE</p>
                <h2 className="section-title">AI 配置</h2>
                <p className="section-subtitle">
                  每个 API Key 绑定自己的服务商、Base URL 和模型。内容系统会读取“当前”这一个 Key。
                </p>
              </div>
              <a className="content-icon-button" href="/ai" target="_self" aria-label="关闭 AI 配置">
                ×
              </a>
            </div>

            <form
              className="content-modal__form"
              action="/api/ai/settings/form"
              method="post"
              onSubmit={saveSettings}
            >
              {activeKey ? (
                <>
                  <input type="hidden" name="apiKeyId" value={activeKey.id} />
                  <input type="hidden" name="provider" value={getEffectiveProvider(activeKey)} />
                </>
              ) : null}
              <section className="ai-key-manager">
                <div className="ai-key-manager__header">
                  <div>
                    <p className="eyebrow">API KEYS</p>
                    <h3 className="section-title">已保存密钥</h3>
                  </div>
                  <a className="ghost-button ghost-button--small" href="/ai?config=1&newKey=1">
                    + 新增
                  </a>
                </div>

                <div className="ai-key-list ai-key-list--selectable">
                  {draft.apiKeys.map((key, index) => (
                    <button
                      key={key.id}
                      type="button"
                      className={`ai-key-select ${
                        key.id === draft.activeApiKeyId ? "ai-key-select--active" : ""
                      }`}
                      onClick={() => setDraft((current) => ({ ...current, activeApiKeyId: key.id }))}
                    >
                      <span className="ai-key-select__index">#{index + 1}</span>
                      <span className="ai-key-select__main">
                        <strong>{key.label || `Key ${index + 1}`}</strong>
                        <small>
                          {key.maskedApiKey || "新密钥"} · {getEffectiveDefaultModel(key) || "未选模型"}
                        </small>
                      </span>
                      <span className="tag">{key.id === draft.activeApiKeyId ? "当前" : "可选"}</span>
                    </button>
                  ))}
                </div>
              </section>

              {activeKey ? (
                <section className="ai-key-editor">
                  <div className="content-modal__form-grid">
                    <label className="field">
                      <span className="field__label">名称</span>
                      <input
                        className="field__input"
                        name="label"
                        value={activeKey.label}
                        onChange={(event) => updateKey(activeKey.id, { label: event.target.value })}
                      />
                    </label>
                    <div className="field">
                      <span className="field__label">服务商预设</span>
                      <div className="ai-preset-grid" role="group" aria-label="服务商预设">
                        {aiPresets
                          .filter((preset) => preset.id !== "custom")
                          .map((preset) => (
                            <a
                              key={preset.id}
                              className={`ai-preset-chip ${
                                activeKey.presetId === preset.id ? "ai-preset-chip--active" : ""
                              }`}
                              data-preset-id={preset.id}
                              href={`/ai?config=1${
                                initialNewKey ? "&newKey=1" : `&key=${encodeURIComponent(activeKey.id)}`
                              }&preset=${encodeURIComponent(preset.id)}`}
                              onClick={(event) => {
                                event.preventDefault();
                                applyPreset(activeKey.id, preset.id);
                              }}
                            >
                              {preset.label}
                            </a>
                          ))}
                      </div>
                    </div>
                  </div>

                  <div className="content-modal__form-grid">
                    <label className="field">
                      <span className="field__label">API Key</span>
                      <input
                        className="field__input"
                        name="apiKey"
                        type="password"
                        value={activeKey.apiKey}
                        placeholder={activeKey.maskedApiKey ? `已保存 ${activeKey.maskedApiKey}，留空不变` : "粘贴 API Key"}
                        onChange={(event) => updateKey(activeKey.id, { apiKey: event.target.value })}
                      />
                    </label>
                    <div className="field">
                      <span className="field__label">接口类型</span>
                      <div className="field__input field__input--readonly">
                        {formatProviderType(getEffectiveProvider(activeKey))}
                      </div>
                    </div>
                  </div>

                  <label className="field">
                    <span className="field__label">Base URL</span>
                    <select
                      className="field__input"
                      value={
                        aiPresets.some((preset) => preset.baseUrl === activeKey.baseUrl)
                          ? activeKey.baseUrl
                          : "custom"
                      }
                      onChange={(event) => {
                        const preset = aiPresets.find((item) => item.baseUrl === event.target.value);
                        if (preset) {
                          applyPreset(activeKey.id, preset.id);
                        }
                      }}
                    >
                      {aiPresets
                        .filter((preset) => preset.id !== "custom")
                        .map((preset) => (
                          <option key={preset.id} value={preset.baseUrl}>
                            {preset.label} · {preset.baseUrl}
                          </option>
                        ))}
                      <option value="custom">自定义 URL</option>
                    </select>
                    <input
                      className="field__input"
                      name="baseUrl"
                      value={activeKey.baseUrl}
                      placeholder="https://api.example.com/v1"
                      onChange={(event) => updateKey(activeKey.id, { baseUrl: event.target.value })}
                    />
                  </label>

                  <div className="content-modal__form-grid">
                    <label className="field">
                      <span className="field__label">默认模型</span>
                      <select
                        className="field__input"
                        name="defaultModel"
                        value={activeModels.includes(activeDefaultModel) ? activeDefaultModel : ""}
                        onChange={(event) => updateKey(activeKey.id, { defaultModel: event.target.value })}
                      >
                        {activeModels.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span className="field__label">模型列表顺序</span>
                      <textarea
                        className="field__input system-settings__models ai-model-list-textarea"
                        name="availableModelsText"
                        value={activeModels.join("\n")}
                        placeholder="一行一个模型，顺序会保留"
                        onChange={(event) =>
                          updateKey(activeKey.id, {
                            presetId: "custom",
                            availableModelsText: event.target.value
                          })
                        }
                      />
                    </label>
                  </div>

                  <div className="ai-key-editor__actions">
                    <div className="pill-row">
                      <button className="ghost-button ghost-button--small" type="button" onClick={() => moveKey(activeKey.id, -1)}>
                        上移
                      </button>
                      <button className="ghost-button ghost-button--small" type="button" onClick={() => moveKey(activeKey.id, 1)}>
                        下移
                      </button>
                    </div>
                    <button
                      className="ghost-button ghost-button--small ghost-button--danger"
                      type="button"
                      onClick={() => deleteKey(activeKey.id)}
                    >
                      删除这个 Key
                    </button>
                  </div>
                </section>
              ) : (
                <div className="content-empty-note">还没有 API Key。先点击“新增”。</div>
              )}

              <div className="content-modal__actions content-modal__actions--split">
                <span className="section-subtitle">{settingsMessage}</span>
                <div className="content-modal__action-group">
                  <button className="ghost-button" type="button" onClick={testActiveKey} disabled={isTesting || isSaving}>
                    {isTesting ? "测试中..." : "测试当前 Key"}
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
