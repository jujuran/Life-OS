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
  createdAt: string;
};

type AiConversationStatus = "active" | "archived";

type AiConversation = {
  id: string;
  title: string;
  status: AiConversationStatus;
  messages: AiChatMessage[];
  model: string | null;
  createdAt: string;
  updatedAt: string;
};

type AiConversationStore = {
  conversations: AiConversation[];
  activeConversationId: string | null;
  updatedAt: string | null;
};

type AiConversationsResponse = {
  ok?: boolean;
  store?: AiConversationStore;
  message?: string;
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
  }
];

const starterPrompts = [
  "今天我应该优先处理什么？",
  "帮我整理一个内容选题",
  "把我现在的想法拆成行动步骤"
];

function getNow() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createWelcomeMessage(): AiChatMessage {
  return {
    id: createId("assistant"),
    role: "assistant",
    content:
      "我是 Life OS 的 AI 工作台。现在先从通用对话开始，后续可以逐步接入内容、财务、健康和工具上下文。",
    createdAt: getNow()
  };
}

function createConversation(title = "新对话"): AiConversation {
  const now = getNow();

  return {
    id: createId("conv"),
    title,
    status: "active",
    messages: [createWelcomeMessage()],
    model: null,
    createdAt: now,
    updatedAt: now
  };
}

function createDefaultConversationStore(): AiConversationStore {
  const conversation = createConversation("Life OS 总助手");

  return {
    conversations: [conversation],
    activeConversationId: conversation.id,
    updatedAt: null
  };
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
  return aiPresets.find((preset) => preset.id === presetId);
}

function getEffectiveModels(key: AiKeyDraft) {
  const savedModels = modelTextToList(key.availableModelsText, key.defaultModel);

  if (savedModels.length) {
    return savedModels;
  }

  return getServicePreset(key.presetId)?.models ?? [];
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

function applyPresetToDraft(current: AiSettingsDraft, keyId: string | undefined, presetId: string) {
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

function createTitleFromPrompt(prompt: string) {
  const normalized = prompt.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "新对话";
  }

  return normalized.length > 24 ? `${normalized.slice(0, 24)}...` : normalized;
}

type AiAgentWorkspaceProps = {
  initialEditKeyId?: string | null;
  initialNewKey?: boolean;
  initialOpenSettings?: boolean;
  initialPresetId?: string | null;
  initialSettings?: PublicAiSettings | null;
};

export function AiAgentWorkspace({
  initialEditKeyId = null,
  initialNewKey = false,
  initialOpenSettings = false,
  initialPresetId = null,
  initialSettings = null
}: AiAgentWorkspaceProps) {
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
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [conversationStore, setConversationStore] = useState<AiConversationStore>(() =>
    createDefaultConversationStore()
  );
  const [conversationQuery, setConversationQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [input, setInput] = useState("");
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const activeKey = draft.apiKeys.find((key) => key.id === draft.activeApiKeyId) ?? draft.apiKeys[0];
  const activeModels = activeKey ? getEffectiveModels(activeKey) : [];
  const activeDefaultModel = activeKey ? getEffectiveDefaultModel(activeKey) : "";
  const modelLabel = savedSettings?.defaultModel ?? activeDefaultModel ?? "未配置模型";
  const configSource = savedSettings ? formatConfigSource(savedSettings.source) : "读取中";
  const activeConversation =
    conversationStore.conversations.find(
      (conversation) => conversation.id === conversationStore.activeConversationId
    ) ??
    conversationStore.conversations[0] ??
    null;
  const visibleConversations = useMemo(() => {
    const query = conversationQuery.trim().toLowerCase();

    return conversationStore.conversations
      .filter((conversation) => (showArchived ? conversation.status === "archived" : conversation.status === "active"))
      .filter((conversation) => {
        if (!query) {
          return true;
        }

        return (
          conversation.title.toLowerCase().includes(query) ||
          conversation.messages.some((message) => message.content.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [conversationQuery, conversationStore.conversations, showArchived]);
  const archivedCount = conversationStore.conversations.filter(
    (conversation) => conversation.status === "archived"
  ).length;

  useEffect(() => {
    setIsSettingsOpen(initialOpenSettings);
  }, [initialOpenSettings]);

  useEffect(() => {
    const messageList = messagesRef.current;

    if (!messageList) {
      return;
    }

    messageList.scrollTop = messageList.scrollHeight;
  }, [activeConversation?.id, activeConversation?.messages.length, isSending]);

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
    let isCancelled = false;

    async function loadConversations() {
      setIsLoadingConversations(true);

      try {
        const response = await fetch("/api/ai/conversations");
        const data = (await response.json()) as AiConversationsResponse;

        if (!response.ok || !data.store || isCancelled) {
          throw new Error(data.message || "load conversations failed");
        }

        setConversationStore(data.store);
      } catch {
        if (!isCancelled) {
          setChatStatus("暂时没有读取到本地会话，已使用临时会话。");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingConversations(false);
        }
      }
    }

    void loadConversations();

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

  async function persistConversationStore(nextStore: AiConversationStore) {
    try {
      const response = await fetch("/api/ai/conversations", {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(nextStore)
      });
      const data = (await response.json()) as AiConversationsResponse;

      if (response.ok && data.store) {
        setConversationStore(data.store);
      }
    } catch {
      setChatStatus("会话暂时没有保存成功，请稍后再试。");
    }
  }

  function replaceConversationStore(nextStore: AiConversationStore, shouldPersist = true) {
    setConversationStore(nextStore);

    if (shouldPersist) {
      void persistConversationStore(nextStore);
    }
  }

  function updateConversation(conversationId: string, patch: Partial<AiConversation>) {
    const nextStore = {
      ...conversationStore,
      conversations: conversationStore.conversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              ...patch,
              updatedAt: getNow()
            }
          : conversation
      )
    };

    replaceConversationStore(nextStore);
  }

  function createNewConversation() {
    const conversation = createConversation();
    const nextStore = {
      conversations: [conversation, ...conversationStore.conversations],
      activeConversationId: conversation.id,
      updatedAt: getNow()
    };

    setShowArchived(false);
    replaceConversationStore(nextStore);
  }

  function renameConversation(conversation: AiConversation) {
    const nextTitle = window.prompt("给这个会话换个标题", conversation.title)?.trim();

    if (!nextTitle) {
      return;
    }

    updateConversation(conversation.id, {
      title: nextTitle.slice(0, 80)
    });
  }

  function archiveConversation(conversation: AiConversation) {
    const nextStatus: AiConversationStatus = conversation.status === "archived" ? "active" : "archived";
    const nextConversations = conversationStore.conversations.map((item) =>
      item.id === conversation.id
        ? {
            ...item,
            status: nextStatus,
            updatedAt: getNow()
          }
        : item
    );
    const nextActive =
      nextStatus === "archived" && conversationStore.activeConversationId === conversation.id
        ? nextConversations.find((item) => item.status === "active")?.id ?? nextConversations[0]?.id ?? null
        : conversationStore.activeConversationId;

    replaceConversationStore({
      conversations: nextConversations,
      activeConversationId: nextActive,
      updatedAt: getNow()
    });
  }

  function deleteConversation(conversation: AiConversation) {
    const shouldDelete = window.confirm(`确定删除「${conversation.title}」吗？删除后本地记录也会移除。`);

    if (!shouldDelete) {
      return;
    }

    const remaining = conversationStore.conversations.filter((item) => item.id !== conversation.id);
    const nextConversations = remaining.length ? remaining : [createConversation("Life OS 总助手")];
    const nextActive =
      conversationStore.activeConversationId === conversation.id
        ? nextConversations.find((item) => item.status === "active")?.id ?? nextConversations[0]?.id ?? null
        : conversationStore.activeConversationId;

    replaceConversationStore({
      conversations: nextConversations,
      activeConversationId: nextActive,
      updatedAt: getNow()
    });
  }

  function selectConversation(conversationId: string) {
    replaceConversationStore({
      ...conversationStore,
      activeConversationId: conversationId,
      updatedAt: getNow()
    });
  }

  function updateKey(id: string, patch: Partial<AiKeyDraft>) {
    setDraft((current) => ({
      ...current,
      apiKeys: current.apiKeys.map((key) => (key.id === id ? { ...key, ...patch } : key))
    }));
  }

  function applyPreset(keyId: string | undefined, presetId: string) {
    setDraft((current) => applyPresetToDraft(current, keyId, presetId));
  }

  function addKey(presetId = "deepseek") {
    setDraft((current) => {
      const id = createKeyId(current.apiKeys);
      const preset = getServicePreset(presetId) ?? aiPresets[0];

      return {
        apiKeys: current.apiKeys.concat({
          id,
          label: `Key ${current.apiKeys.length + 1}`,
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
    });
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

    const baseConversation = activeConversation ?? createConversation("Life OS 总助手");
    const userMessage: AiChatMessage = {
      id: createId("user"),
      role: "user",
      content: prompt,
      createdAt: getNow()
    };
    const shouldAutoTitle = baseConversation.title === "新对话" || baseConversation.title === "Life OS 总助手";
    const conversationWithUser: AiConversation = {
      ...baseConversation,
      title: shouldAutoTitle ? createTitleFromPrompt(prompt) : baseConversation.title,
      messages: baseConversation.messages.concat(userMessage),
      model: modelLabel,
      updatedAt: getNow()
    };
    const storeWithUser: AiConversationStore = {
      conversations: conversationStore.conversations.some((item) => item.id === conversationWithUser.id)
        ? conversationStore.conversations.map((item) =>
            item.id === conversationWithUser.id ? conversationWithUser : item
          )
        : [conversationWithUser, ...conversationStore.conversations],
      activeConversationId: conversationWithUser.id,
      updatedAt: getNow()
    };

    setInput("");
    setIsSending(true);
    setChatStatus(`正在调用 ${modelLabel}...`);
    replaceConversationStore(storeWithUser);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          messages: conversationWithUser.messages.map((message) => ({
            role: message.role,
            content: message.content
          }))
        })
      });
      const data = (await response.json()) as AiChatResponse;

      if (!response.ok || !data.message) {
        throw new Error(data.message || "AI 请求失败。");
      }

      const assistantMessage: AiChatMessage = {
        id: createId("assistant"),
        role: "assistant",
        content: data.message,
        createdAt: getNow()
      };
      const finalConversation: AiConversation = {
        ...conversationWithUser,
        messages: conversationWithUser.messages.concat(assistantMessage),
        model: data.model || modelLabel,
        updatedAt: getNow()
      };
      const finalStore = {
        conversations: storeWithUser.conversations.map((item) =>
          item.id === finalConversation.id ? finalConversation : item
        ),
        activeConversationId: finalConversation.id,
        updatedAt: getNow()
      };

      replaceConversationStore(finalStore);
      setChatStatus(`已由 ${data.model || modelLabel} 回复。`);
    } catch (error) {
      const assistantMessage: AiChatMessage = {
        id: createId("assistant"),
        role: "assistant",
        content: `这次没有成功调用模型：${
          error instanceof Error ? error.message : "未知错误"
        }`,
        createdAt: getNow()
      };
      const failedConversation: AiConversation = {
        ...conversationWithUser,
        messages: conversationWithUser.messages.concat(assistantMessage),
        updatedAt: getNow()
      };
      const failedStore = {
        conversations: storeWithUser.conversations.map((item) =>
          item.id === failedConversation.id ? failedConversation : item
        ),
        activeConversationId: failedConversation.id,
        updatedAt: getNow()
      };

      replaceConversationStore(failedStore);
      setChatStatus("对话请求失败。");
    } finally {
      setIsSending(false);
    }
  }

  function insertComposerToken(token: string) {
    setInput((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${token} `);
    setIsAttachMenuOpen(false);
  }

  return (
    <section className="ai-workspace ai-workspace--agent">
      <header className="ai-workspace__header ai-workspace__header--compact">
        <div>
          <p className="eyebrow">AI MODULE</p>
          <h1 className="ai-workspace__title">AI 工作台</h1>
          <p className="section-subtitle section-subtitle--body">
            通用对话入口。会话会保存在本地，后续再逐步接入各系统上下文。
          </p>
        </div>
        <div className="ai-workspace__header-actions">
          <span className="mono-text mono-text--subtle">
            {configSource} / {modelLabel}
          </span>
          <button className="primary-button" type="button" onClick={() => setIsSettingsOpen(true)}>
            AI 配置
          </button>
        </div>
      </header>

      <div className="ai-workspace__grid ai-workspace__grid--agent">
        <aside className="ai-panel ai-panel--rail ai-panel--threads">
          <div className="ai-panel__header ai-panel__header--spread">
            <div>
              <p className="eyebrow">THREADS</p>
              <h2 className="section-title">会话</h2>
            </div>
            <button className="content-icon-button" type="button" onClick={createNewConversation}>
              +
            </button>
          </div>

          <input
            className="field__input ai-thread-search"
            value={conversationQuery}
            placeholder="搜索会话..."
            onChange={(event) => setConversationQuery(event.target.value)}
          />

          <div className="ai-thread-toolbar">
            <button
              className={`ghost-button ghost-button--small ${!showArchived ? "ghost-button--active" : ""}`}
              type="button"
              onClick={() => setShowArchived(false)}
            >
              当前
            </button>
            <button
              className={`ghost-button ghost-button--small ${showArchived ? "ghost-button--active" : ""}`}
              type="button"
              onClick={() => setShowArchived(true)}
            >
              归档 {archivedCount}
            </button>
          </div>

          <div className="ai-thread-list">
            {isLoadingConversations ? (
              <p className="section-subtitle">正在读取本地会话...</p>
            ) : null}
            {visibleConversations.map((conversation) => (
              <article
                key={conversation.id}
                className={`ai-thread-card ${
                  conversation.id === activeConversation?.id ? "ai-thread-card--active" : ""
                }`}
              >
                <button
                  className="ai-thread-card__main"
                  type="button"
                  onClick={() => selectConversation(conversation.id)}
                >
                  <span className="ai-thread-card__title">{conversation.title}</span>
                </button>
                <div className="ai-thread-card__actions">
                  <button type="button" onClick={() => renameConversation(conversation)}>
                    命名
                  </button>
                  <button type="button" onClick={() => archiveConversation(conversation)}>
                    {conversation.status === "archived" ? "恢复" : "归档"}
                  </button>
                  <button type="button" onClick={() => deleteConversation(conversation)}>
                    删除
                  </button>
                </div>
              </article>
            ))}
            {!visibleConversations.length ? (
              <div className="content-empty-note">这里还没有对应会话。</div>
            ) : null}
          </div>
        </aside>

        <section className="ai-panel ai-chat ai-chat--agent">
          <div className="ai-panel__header ai-panel__header--spread">
            <div>
              <p className="eyebrow">CHAT</p>
              <h2 className="section-title">{activeConversation?.title ?? "对话工作台"}</h2>
            </div>
            <span className={`tag ${savedSettings?.hasApiKey ? "" : "tag--muted"}`}>
              {savedSettings?.hasApiKey ? "已接入模型" : "待配置 API Key"}
            </span>
          </div>

          <div ref={messagesRef} className="ai-chat__messages ai-chat__messages--agent" aria-live="polite">
            {(activeConversation?.messages ?? []).map((message) => (
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

          <form className="ai-composer ai-composer--agent" onSubmit={sendMessage}>
            <div className="ai-composer__plus-wrap">
              <button
                className="ghost-button ai-composer__plus"
                type="button"
                aria-label="添加上下文"
                onClick={() => setIsAttachMenuOpen((current) => !current)}
              >
                +
              </button>
              {isAttachMenuOpen ? (
                <div className="ai-attach-menu">
                  <button type="button" onClick={() => insertComposerToken("@内容")}>
                    @内容系统
                  </button>
                  <button type="button" onClick={() => insertComposerToken("@财务")}>
                    @财务系统
                  </button>
                  <button type="button" onClick={() => insertComposerToken("@健康")}>
                    @健康系统
                  </button>
                  <button type="button" disabled>
                    添加本地文件
                  </button>
                  <button type="button" disabled>
                    添加图片
                  </button>
                  <p>第一版先作为入口预留，后续再接真实文件和模块上下文。</p>
                </div>
              ) : null}
            </div>
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
                <span className="section-subtitle">本地会话</span>
                <span>{conversationStore.conversations.length} 个</span>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row__meta">
                <span className="section-subtitle">读取状态</span>
                <span>{isLoadingSettings || isLoadingConversations ? "正在读取..." : "已就绪"}</span>
              </div>
            </div>
          </div>
          <button className="ghost-button" type="button" onClick={() => setIsSettingsOpen(true)}>
            打开配置
          </button>
          <div className="ai-capability-list">
            <p className="eyebrow">NEXT</p>
            <span>@内容：产品、SOP、历史笔记</span>
            <span>@财务：摘要、账户、流水</span>
            <span>@健康：日级健康数据</span>
            <span>本地文件与图片附件</span>
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
                  每个 API Key 绑定自己的服务商、Base URL 和模型。当前 Key 会作为 AI 工作台默认模型。
                </p>
              </div>
              <button className="content-icon-button" type="button" aria-label="关闭 AI 配置" onClick={closeSettings}>
                ×
              </button>
            </div>

            <form className="content-modal__form" onSubmit={saveSettings}>
              <section className="ai-key-manager">
                <div className="ai-key-manager__header">
                  <div>
                    <p className="eyebrow">API KEYS</p>
                    <h3 className="section-title">已保存密钥</h3>
                  </div>
                  <button className="ghost-button ghost-button--small" type="button" onClick={() => addKey()}>
                    + 新增
                  </button>
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
                        value={activeKey.label}
                        onChange={(event) => updateKey(activeKey.id, { label: event.target.value })}
                      />
                    </label>
                    <div className="field">
                      <span className="field__label">服务商预设</span>
                      <div className="ai-preset-grid" role="group" aria-label="服务商预设">
                        {aiPresets.map((preset) => (
                          <button
                            key={preset.id}
                            className={`ai-preset-chip ${
                              activeKey.presetId === preset.id ? "ai-preset-chip--active" : ""
                            }`}
                            type="button"
                            onClick={() => applyPreset(activeKey.id, preset.id)}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="content-modal__form-grid">
                    <label className="field">
                      <span className="field__label">API Key</span>
                      <input
                        className="field__input"
                        type="password"
                        value={activeKey.apiKey}
                        placeholder={activeKey.maskedApiKey ? `已保存：${activeKey.maskedApiKey}，留空保持不变` : "粘贴 API Key"}
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
                        } else {
                          updateKey(activeKey.id, { presetId: "custom" });
                        }
                      }}
                    >
                      {aiPresets.map((preset) => (
                        <option key={preset.id} value={preset.baseUrl}>
                          {preset.label} · {preset.baseUrl}
                        </option>
                      ))}
                      <option value="custom">自定义 URL</option>
                    </select>
                    <input
                      className="field__input"
                      value={activeKey.baseUrl}
                      placeholder="https://api.example.com/v1"
                      onChange={(event) =>
                        updateKey(activeKey.id, {
                          baseUrl: event.target.value,
                          presetId: "custom"
                        })
                      }
                    />
                  </label>

                  <div className="content-modal__form-grid">
                    <label className="field">
                      <span className="field__label">默认模型</span>
                      <select
                        className="field__input"
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
