import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getLifeOsDataPath } from "./life-os-data-paths";

export type AiConversationRole = "user" | "assistant";

export type AiConversationMessage = {
  id: string;
  role: AiConversationRole;
  content: string;
  createdAt: string;
};

export type AiConversationStatus = "active" | "archived";

export type AiConversation = {
  id: string;
  title: string;
  status: AiConversationStatus;
  messages: AiConversationMessage[];
  model: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiConversationStore = {
  conversations: AiConversation[];
  activeConversationId: string | null;
  updatedAt: string | null;
};

const AI_CONVERSATIONS_FILE_NAME = "ai-conversations.json";

function getNow() {
  return new Date().toISOString();
}

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createConversationId() {
  return `conv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getAiConversationsPath() {
  return getLifeOsDataPath(AI_CONVERSATIONS_FILE_NAME);
}

async function ensureAiConversationDirectory() {
  await mkdir(dirname(getAiConversationsPath()), { recursive: true });
}

export function createWelcomeMessage(): AiConversationMessage {
  return {
    id: createMessageId("assistant"),
    role: "assistant",
    content:
      "我是 Life OS 的 AI 工作台。现在先从通用对话开始，后续可以逐步接入内容、财务、健康和工具上下文。",
    createdAt: getNow()
  };
}

export function createDefaultConversation(): AiConversation {
  const now = getNow();

  return {
    id: createConversationId(),
    title: "Life OS 总助手",
    status: "active",
    messages: [createWelcomeMessage()],
    model: null,
    createdAt: now,
    updatedAt: now
  };
}

export function createDefaultAiConversationStore(): AiConversationStore {
  const conversation = createDefaultConversation();

  return {
    conversations: [conversation],
    activeConversationId: conversation.id,
    updatedAt: null
  };
}

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeConversationId(value: unknown, fallback: string) {
  return normalizeString(value, fallback).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 96) || fallback;
}

function normalizeMessage(value: unknown, fallbackIndex: number): AiConversationMessage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<AiConversationMessage>;
  const role = record.role === "user" || record.role === "assistant" ? record.role : null;
  const content = normalizeString(record.content);

  if (!role || !content) {
    return null;
  }

  return {
    id: normalizeConversationId(record.id, `message-${fallbackIndex + 1}`),
    role,
    content: content.slice(0, 20000),
    createdAt: normalizeString(record.createdAt, getNow())
  };
}

function normalizeConversation(value: unknown, fallbackIndex: number): AiConversation | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<AiConversation>;
  const id = normalizeConversationId(record.id, `conversation-${fallbackIndex + 1}`);
  const messages = Array.isArray(record.messages)
    ? record.messages
        .map((message, index) => normalizeMessage(message, index))
        .filter((message): message is AiConversationMessage => Boolean(message))
    : [];
  const now = getNow();

  return {
    id,
    title: normalizeString(record.title, "新对话").slice(0, 80),
    status: record.status === "archived" ? "archived" : "active",
    messages: messages.length ? messages : [createWelcomeMessage()],
    model: typeof record.model === "string" && record.model.trim() ? record.model.trim() : null,
    createdAt: normalizeString(record.createdAt, now),
    updatedAt: normalizeString(record.updatedAt, now)
  };
}

export function normalizeAiConversationStore(value: unknown): AiConversationStore {
  if (!value || typeof value !== "object") {
    return createDefaultAiConversationStore();
  }

  const record = value as Partial<AiConversationStore>;
  const conversations = Array.isArray(record.conversations)
    ? record.conversations
        .map((conversation, index) => normalizeConversation(conversation, index))
        .filter((conversation): conversation is AiConversation => Boolean(conversation))
    : [];

  if (!conversations.length) {
    return createDefaultAiConversationStore();
  }

  const requestedActiveId = normalizeString(record.activeConversationId ?? "");
  const activeConversationId =
    conversations.find((conversation) => conversation.id === requestedActiveId)?.id ??
    conversations.find((conversation) => conversation.status === "active")?.id ??
    conversations[0]?.id ??
    null;

  return {
    conversations,
    activeConversationId,
    updatedAt: typeof record.updatedAt === "string" && record.updatedAt.trim() ? record.updatedAt : null
  };
}

export async function readAiConversationStore() {
  try {
    const raw = await readFile(getAiConversationsPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    return normalizeAiConversationStore(parsed);
  } catch {
    return createDefaultAiConversationStore();
  }
}

export async function writeAiConversationStore(store: AiConversationStore) {
  const normalized = normalizeAiConversationStore({
    ...store,
    updatedAt: getNow()
  });

  await ensureAiConversationDirectory();
  await writeFile(getAiConversationsPath(), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

  return normalized;
}
