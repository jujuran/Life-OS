import { NextResponse } from "next/server";
import { readAiSettingsStore } from "../../../../lib/ai-settings-store";

type AiChatMessage = {
  role?: "user" | "assistant" | "system";
  content?: string;
};

type AiChatRequest = {
  messages?: AiChatMessage[];
  modelOverride?: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

function normalizeMessages(messages: unknown) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => {
      if (!message || typeof message !== "object") {
        return null;
      }

      const role = (message as AiChatMessage).role;
      const content =
        typeof (message as AiChatMessage).content === "string"
          ? (message as AiChatMessage).content?.trim()
          : "";

      if (!content || (role !== "user" && role !== "assistant" && role !== "system")) {
        return null;
      }

      return {
        role,
        content: content.slice(0, 8000)
      };
    })
    .filter((message): message is { role: "user" | "assistant" | "system"; content: string } =>
      Boolean(message)
    )
    .slice(-16);
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const body = (await request.json()) as AiChatRequest;
  const { settings } = await readAiSettingsStore();
  const apiKey = settings.apiKey;
  const model = getString(body.modelOverride) || settings.defaultModel;
  const baseUrl = settings.baseUrl.replace(/\/$/, "");
  const messages = normalizeMessages(body.messages);

  if (!apiKey || !model) {
    return NextResponse.json(
      {
        code: "AI_NOT_CONFIGURED",
        message: "AI 尚未配置。请先打开 AI 配置，填写 API Key 和默认模型。"
      },
      { status: 501 }
    );
  }

  if (!messages.length) {
    return NextResponse.json({ message: "请输入一条消息。" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "你是 Life OS 的人生系统助手。回答要清晰、克制、可执行。你现在只能读取当前对话内容，不能假装已经读取财务、健康或内容系统的真实数据。遇到需要系统数据的问题，要说明需要后续接入上下文。"
          },
          ...messages
        ],
        temperature: 0.5
      }),
      signal: controller.signal
    });
    const data = (await aiResponse.json()) as ChatCompletionResponse;

    if (!aiResponse.ok) {
      return NextResponse.json(
        {
          message: data.error?.message ?? "AI request failed."
        },
        { status: aiResponse.status }
      );
    }

    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json({ message: "AI 返回为空。" }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      message: content,
      model
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI error.";

    return NextResponse.json({ message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
