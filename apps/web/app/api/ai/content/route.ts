import { NextResponse } from "next/server";
import type {
  ContentOutput,
  ContentTaskInput
} from "../../../../lib/content-studio-seed.public";
import { readAiSettingsStore } from "../../../../lib/ai-settings-store";
import {
  looksLikeContentJson,
  parseContentJsonPayload
} from "../../../../lib/content-output-parser";

export const runtime = "nodejs";

type AiContentRequest = {
  mode?: "generate" | "review";
  reviewAction?: "rewrite_titles" | "make_closer" | "tone_down" | "shorten";
  apiKeyIdOverride?: string;
  modelOverride?: string;
  project?: {
    name?: string;
    productProfile?: string;
  };
  writingSop?: {
    name?: string;
    version?: string;
    markdownContent?: string;
  };
  taskInput?: ContentTaskInput;
  currentOutput?: ContentOutput;
};

type NormalizedContentPayload = {
  mode: "generate" | "review";
  reviewAction: "rewrite_titles" | "make_closer" | "tone_down" | "shorten";
  project: {
    name: string;
    productProfile: string;
  };
  writingSop: {
    name: string;
    version: string;
    markdownContent: string;
  };
  taskInput: ContentTaskInput;
  currentOutput: ContentOutput;
};

type ChatCompletionMessage = {
  role: "system" | "user";
  content: string;
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

function formatStamp(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}\n...[已截断]`;
}

function getFirstParagraphs(text: string, count: number) {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, count)
    .join("\n\n");
}

function pickLinesByKeywords(text: string, keywords: string[], maxLength: number) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const matched = lines.filter((line) => keywords.some((keyword) => line.includes(keyword)));

  return truncateText((matched.length ? matched : lines.slice(0, 12)).join("\n"), maxLength);
}

function getProductGuardrails(productProfile: string) {
  return pickLinesByKeywords(
    productProfile,
    ["不能", "不要", "禁区", "边界", "风险", "不承诺", "避免", "禁忌"],
    700
  );
}

function getSopReviewRules(sopMarkdown: string) {
  return pickLinesByKeywords(
    sopMarkdown,
    ["标题", "开头", "语气", "口吻", "禁忌", "不要", "避免", "节奏", "收敛", "缩短"],
    900
  );
}


function normalizeTitles(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((title): title is string => typeof title === "string")
        .map((title) => title.trim())
        .filter(
          (title) =>
            title.length >= 4 &&
            title.length <= 42 &&
            !/[{}\[\]]/.test(title) &&
            !/^["']?(?:titles|body|tags)["']?\s*:/i.test(title)
        )
    : [];
}

function tryParseContentJson(rawText: string): Partial<ContentOutput> | null {
  return parseContentJsonPayload(rawText) as Partial<ContentOutput> | null;
}

function cleanPlainTextOutput(rawText: string) {
  return rawText
    .replace(/^```(?:json|markdown|md)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function plainTextTitleCandidates(rawText: string) {
  return rawText
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^[-*#\d.、\s]+/, "")
        .trim()
    )
    .filter(
      (line) =>
        line.length >= 4 &&
        line.length <= 42 &&
        !/[{}\[\]]/.test(line) &&
        !/^["']?(?:titles|body|tags)["']?\s*:/i.test(line)
    )
    .slice(0, 3);
}

function cleanLooseTitle(title: string) {
  return title
    .replace(/^[-*#\d.、\s]+/, "")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .replace(/^["“”'‘’《》【】\s]+|["“”'‘’《》【】\s]+$/g, "")
    .replace(/[。！？.!?]+$/g, "")
    .trim();
}

function isLooseSectionHeading(line: string, labels: string[]) {
  const normalized = line
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .replace(/[:：]\s*$/, "")
    .trim()
    .toLowerCase();

  return labels.some((label) => normalized === label.toLowerCase());
}

function parseInlineTags(line: string) {
  return line
    .replace(/^\*\*?\s*(?:标签|tags?|hashtags?)\s*\**\s*[:：]?/i, "")
    .split(/[\s,，、]+/)
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseLooseOutput(rawText: string): Pick<ContentOutput, "titles" | "body" | "tags"> | null {
  const lines = cleanPlainTextOutput(rawText).split(/\r?\n/);
  const bodyLines: string[] = [];
  const titleLines: string[] = [];
  let tags: string[] = [];
  let section: "body" | "titles" | "tags" = "body";
  let sawStructuredSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (/^[-*_]{3,}$/.test(line)) {
      sawStructuredSection = true;
      continue;
    }

    if (isLooseSectionHeading(line, ["备选标题", "标题候选", "候选标题"])) {
      section = "titles";
      sawStructuredSection = true;
      continue;
    }

    if (/^(?:\*\*)?\s*(?:标签|tags?|hashtags?)\s*(?:\*\*)?\s*[:：]?/i.test(line)) {
      section = "tags";
      sawStructuredSection = true;
      tags = parseInlineTags(line);
      continue;
    }

    if (section === "titles") {
      const title = cleanLooseTitle(line);

      if (title) {
        titleLines.push(title);
      }
      continue;
    }

    if (section === "tags") {
      tags = tags.length ? tags : parseInlineTags(line);
      continue;
    }

    bodyLines.push(rawLine);
  }

  if (!sawStructuredSection) {
    return null;
  }

  const body = bodyLines.join("\n").trim();

  if (!body) {
    return null;
  }

  return {
    titles: titleLines.filter((title) => title.length >= 4 && title.length <= 42).slice(0, 3),
    body,
    tags
  };
}

function normalizeComparableTitle(title: string) {
  return title
    .replace(/\s+/g, "")
    .replace(/[，。！？、；：,.!?;:"“”‘’'《》【】（）()]/g, "")
    .toLowerCase();
}

function removeLeadingDuplicateTitle(body: string, titles: string[]) {
  const comparableTitles = new Set(
    titles.map((title) => normalizeComparableTitle(title)).filter(Boolean)
  );

  if (!comparableTitles.size) {
    return body.trim();
  }

  const lines = body.split(/\r?\n/);
  const firstContentIndex = lines.findIndex((line) => line.trim());

  if (firstContentIndex < 0) {
    return "";
  }

  const firstLineTitle = cleanLooseTitle(
    lines[firstContentIndex]
      .replace(/^(?:标题|题目|小红书标题|正文标题)\s*[:：]\s*/, "")
      .trim()
  );
  const normalizedFirstLine = normalizeComparableTitle(firstLineTitle);

  if (comparableTitles.has(normalizedFirstLine)) {
    lines.splice(firstContentIndex, 1);
  }

  return lines.join("\n").trim();
}

function removeRepeatedTitles(titles: string[], existingTitles: string[]) {
  const existing = new Set(existingTitles.map(normalizeComparableTitle).filter(Boolean));
  const seen = new Set<string>();
  const freshTitles: string[] = [];

  for (const title of titles) {
    const normalized = normalizeComparableTitle(title);

    if (!normalized || existing.has(normalized) || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    freshTitles.push(title);
  }

  return freshTitles;
}

function ensureThreeTitles(titles: string[], contextText: string, fallbacks: string[] = []) {
  const seed = titles[0]?.replace(/[，。！？、；：,.!?;:]+$/g, "").trim() ?? "";
  const contextTitle =
    contextText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean)
      ?.replace(/[。！？].*$/g, "")
      .slice(0, 34)
      .trim() ?? "";
  const candidates = [
    ...titles,
    ...fallbacks,
    contextTitle,
    seed ? `${seed}，背后真正发生了什么` : "",
    seed ? `别只看表面：${seed}` : "",
    "这件事背后，真正需要被看见的是什么"
  ];
  const uniqueTitles: string[] = [];

  for (const title of candidates) {
    const normalized = title.trim();

    if (normalized && !uniqueTitles.includes(normalized)) {
      uniqueTitles.push(normalized);
    }

    if (uniqueTitles.length === 3) {
      break;
    }
  }

  return uniqueTitles;
}

function normalizePlainTextOutput(rawText: string): ContentOutput {
  if (looksLikeContentJson(rawText)) {
    throw new Error("模型返回的结构化内容不完整，请重试本次生成。");
  }
  const looseOutput = parseLooseOutput(rawText);
  const rawBody = looseOutput?.body ?? cleanPlainTextOutput(rawText);

  if (!rawBody) {
    throw new Error("AI response is empty.");
  }

  const titles = ensureThreeTitles(
    looseOutput?.titles.length ? looseOutput.titles : plainTextTitleCandidates(rawBody),
    rawBody
  );
  const body = removeLeadingDuplicateTitle(rawBody, titles);

  return {
    titles,
    body,
    tags: looseOutput?.tags ?? [],
    stamp: `AI 生成 · ${formatStamp()}`
  };
}

function normalizeOutput(rawText: string): ContentOutput {
  const parsed = tryParseContentJson(rawText);

  if (!parsed) {
    return normalizePlainTextOutput(rawText);
  }

  const body = getString(parsed.body);
  const looseOutput = parseLooseOutput(body);
  const rawCleanedBody = looseOutput?.body ?? body;
  const parsedTitles = normalizeTitles(parsed.titles);
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 8)
    : looseOutput?.tags ?? [];
  const titles = ensureThreeTitles(
    parsedTitles.length ? parsedTitles : looseOutput?.titles ?? [],
    rawCleanedBody
  );
  const cleanedBody = removeLeadingDuplicateTitle(rawCleanedBody, titles);

  if (titles.length !== 3 || !cleanedBody) {
    return normalizePlainTextOutput(rawText);
  }

  return {
    titles,
    body: cleanedBody,
    tags,
    stamp: `AI 生成 · ${formatStamp()}`
  };
}

function normalizeTitleRewrite(rawText: string, currentOutput?: ContentOutput): ContentOutput {
  const parsed = tryParseContentJson(rawText);
  const currentTitles = currentOutput?.titles ?? [];
  const proposedTitles = removeRepeatedTitles(
    parsed ? normalizeTitles(parsed.titles) : plainTextTitleCandidates(rawText),
    currentTitles
  );
  const titles = ensureThreeTitles(
    proposedTitles,
    currentOutput?.body ?? rawText
  );

  if (titles.length !== 3) {
    throw new Error("AI response is missing titles.");
  }

  return {
    titles,
    body: currentOutput?.body ?? "",
    tags: currentOutput?.tags ?? [],
    stamp: `AI 改标题 · ${formatStamp()}`
  };
}

function getReviewInstruction(
  reviewAction: NormalizedContentPayload["reviewAction"]
) {
  if (reviewAction === "rewrite_titles") {
    return [
      "你是标题专项编辑，只重写标题候选，绝对不要改写正文和标签。",
      "请给出 3 个互相明显不同的新标题，且不要复用当前标题，也不要只替换几个词。",
      "标题 1：具体场景型。抓住正文里最可视化的动作、物品或生活场景，让人一眼知道发生了什么。",
      "标题 2：情绪共鸣型。抓住读者真实感受，但不要鸡汤化、哲理化、总结腔。",
      "标题 3：反差钩子型。用轻微反差、误解或转折切入，但不要标题党，不要夸张恐吓。",
      "每个标题建议 10-24 个中文字符，必须像目标发布渠道里的真实用户会写的标题。",
      "禁止使用空泛表达：这件事背后、真正需要被看见、别只看表面、你以为、其实、狠狠、爆款、必看。"
    ].join("\n");
  }

  if (reviewAction === "make_closer") {
    return "只改正文开头和必要衔接，让它更像真实经验分享，更贴近日常表达。标题和标签可以小幅调整。";
  }

  if (reviewAction === "tone_down") {
    return "整体收敛语气，减少营销感、夸张感和说教感，保持内容可信。标题、正文、标签都可以相应微调。";
  }

  return "压缩正文长度，保留核心观点和产品事实，让它更接近可直接发布的短内容。标题和标签可保留或小幅优化。";
}

function buildMessages(payload: NormalizedContentPayload): ChatCompletionMessage[] {
  const mode = payload.mode;
  const reviewAction = payload.reviewAction;
  const projectName = payload.project.name;
  const productProfile = payload.project.productProfile;
  const sopName = payload.writingSop.name;
  const sopVersion = payload.writingSop.version;
  const sopMarkdown = payload.writingSop.markdownContent;
  const taskGoal = getString(payload.taskInput.goal);
  const taskTopic = getString(payload.taskInput.topic);
  const referenceText = getString(payload.taskInput.referenceText);
  const currentTitle = getString(payload.currentOutput.titles?.[0]);
  const currentTitles = Array.isArray(payload.currentOutput.titles)
    ? payload.currentOutput.titles.join(" / ")
    : "";
  const currentBody = getString(payload.currentOutput.body);
  const currentTags = Array.isArray(payload.currentOutput.tags)
    ? payload.currentOutput.tags.join(" / ")
    : "";
  const scopedProductProfile =
    mode === "generate"
      ? productProfile
      : reviewAction === "rewrite_titles"
      ? truncateText(productProfile, 800)
      : getProductGuardrails(productProfile);
  const scopedSopMarkdown =
    mode === "generate"
      ? sopMarkdown
      : reviewAction === "rewrite_titles"
      ? pickLinesByKeywords(sopMarkdown, ["标题", "选题", "钩子", "开头", "痛点", "冲突", "不要", "禁忌"], 1200)
      : getSopReviewRules(sopMarkdown);
  const scopedCurrentBody =
    mode !== "review"
      ? ""
      : reviewAction === "make_closer"
      ? truncateText(getFirstParagraphs(currentBody, 3) || currentBody, 1000)
      : reviewAction === "rewrite_titles"
      ? truncateText(currentBody, 2600)
      : reviewAction === "shorten"
      ? truncateText(currentBody, 3500)
      : truncateText(currentBody, 3000);
  const reviewInstruction = getReviewInstruction(reviewAction);

  return [
    {
      role: "system",
      content:
        "你是 Life OS 内容系统里的渠道写作 Agent。你必须严格遵守用户导入的 Markdown SOP，并以产品资料和任务要求确定发布渠道，输出可直接进入审稿区的中文内容。不要解释过程，不要输出 Markdown 代码块。"
    },
    {
      role: "user",
      content: [
        mode === "review"
          ? "请基于以下信息执行一次审稿改写。"
          : "请基于以下信息生成可供目标渠道发布的内容草稿。",
        "",
        `产品 / 项目：${projectName}`,
        "",
        "产品信息 / 产品档案：",
        scopedProductProfile ||
          "无。请不要自行脑补产品事实，只能基于产品名、SOP 和用户参考文字保守生成。",
        "",
        `写作 SOP：${sopName} ${sopVersion}`,
        "",
        "任务目标：",
        taskGoal || "写一篇适合目标渠道发布的内容初稿。",
        "",
        "本次选题：",
        taskTopic || "围绕当前产品生成一个可发布选题。",
        "",
        "参考文字：",
        referenceText || "无。",
        "",
        "Markdown SOP：",
        scopedSopMarkdown,
        "",
        mode === "review" ? "审稿动作：" : "",
        mode === "review" ? reviewInstruction : "",
        mode === "review" ? "" : "",
        mode === "review" ? "当前标题候选：" : "",
        mode === "review" ? currentTitles || currentTitle || "无。" : "",
        mode === "review" ? "" : "",
        mode === "review" ? "当前正文：" : "",
        mode === "review" ? scopedCurrentBody || "无。" : "",
        mode === "review" ? "" : "",
        mode === "review" ? "当前标签：" : "",
        mode === "review" ? currentTags || "无。" : "",
        mode === "review" ? "" : "",
        "只返回 JSON，标题必须固定返回 3 个，结构必须是：",
        mode === "review" && reviewAction === "rewrite_titles"
          ? '{"titles":["标题1","标题2","标题3"]}'
          : '{"titles":["标题1","标题2","标题3"],"body":"正文，保留自然段换行","tags":["标签1","标签2"]}',
        mode === "review"
          ? ""
          : "body 字段只能放可直接复制发布的正文，不要在正文开头重复 titles 里的任何标题，也不要追加备选标题、候选标题、标签、--- 分隔线或任何解释。tags 必须只放在 tags 数组里。"
      ]
        .filter((line) => line !== "")
        .join("\n")
    }
  ];
}

function parseAiResponse(rawText: string): ChatCompletionResponse {
  try {
    return JSON.parse(rawText) as ChatCompletionResponse;
  } catch {
    const chunks = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.replace(/^data:\s*/, "").trim())
      .filter((line) => line && line !== "[DONE]");
    let streamedContent = "";
    let streamedError = "";

    for (const chunk of chunks) {
      try {
        const parsed = JSON.parse(chunk) as {
          error?: { message?: string };
          choices?: Array<{
            delta?: { content?: string };
            message?: { content?: string };
          }>;
        };

        if (parsed.error?.message) {
          streamedError = parsed.error.message;
        }

        streamedContent +=
          parsed.choices?.map((choice) => choice.delta?.content ?? choice.message?.content ?? "").join("") ?? "";
      } catch {
        // Ignore malformed stream keep-alive chunks.
      }
    }

    if (streamedContent) {
      return {
        choices: [
          {
            message: {
              content: streamedContent
            }
          }
        ]
      };
    }

    if (streamedError) {
      return {
        error: {
          message: streamedError
        }
      };
    }

    return {
      error: {
        message: rawText || "AI response is not valid JSON."
      }
    };
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as AiContentRequest;
  const { settings } = await readAiSettingsStore();
  const requestedKeyId = getString(body.apiKeyIdOverride);
  const selectedApiKey = requestedKeyId
    ? settings.apiKeys.find((entry) => entry.id === requestedKeyId)
    : undefined;

  if (requestedKeyId && !selectedApiKey) {
    return NextResponse.json(
      {
        code: "AI_KEY_NOT_FOUND",
        message: "内容系统选择的 API Key 已不存在，请重新选择写作模型。"
      },
      { status: 400 }
    );
  }

  const apiKey = selectedApiKey?.apiKey || settings.apiKey;
  const model = getString(body.modelOverride) || selectedApiKey?.defaultModel || settings.defaultModel;
  const baseUrl = (selectedApiKey?.baseUrl || settings.baseUrl).replace(/\/$/, "");

  if (!apiKey || !model || !baseUrl) {
    return NextResponse.json(
      {
        code: "AI_NOT_CONFIGURED",
        message: "AI 尚未配置。请先在 AI 模块中填写 API Key、Base URL 和默认模型。"
      },
      { status: 501 }
    );
  }

  const projectName = getString(body.project?.name);
  const productProfile = getString(body.project?.productProfile);
  const sopName = getString(body.writingSop?.name);
  const sopMarkdown = getString(body.writingSop?.markdownContent);
  const mode = body.mode === "review" ? "review" : "generate";
  const reviewAction = body.reviewAction ?? "rewrite_titles";

  if (!projectName || !sopName || !sopMarkdown || !body.taskInput) {
    return NextResponse.json(
      { message: "缺少产品、写作 SOP 或任务输入。" },
      { status: 400 }
    );
  }

  const payload: NormalizedContentPayload = {
    mode,
    reviewAction,
    project: {
      name: projectName,
      productProfile
    },
    writingSop: {
      name: sopName,
      version: getString(body.writingSop?.version),
      markdownContent: sopMarkdown
    },
    taskInput: body.taskInput,
    currentOutput:
      body.currentOutput ?? {
        titles: [],
        body: "",
        tags: [],
        stamp: ""
      }
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: buildMessages(payload),
        temperature: mode === "review" && reviewAction === "rewrite_titles" ? 0.65 : 0.7,
        stream: false
      }),
      signal: controller.signal
    });
    const rawText = await aiResponse.text();
    const data = parseAiResponse(rawText);

    if (!aiResponse.ok) {
      return NextResponse.json(
        {
          message: data.error?.message ?? "AI request failed."
        },
        { status: aiResponse.status }
      );
    }

    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ message: "AI 返回了空内容。" }, { status: 502 });
    }

    return NextResponse.json<{ ok: true; output: ContentOutput }>({
      ok: true,
      output:
        mode === "review" && reviewAction === "rewrite_titles"
          ? normalizeTitleRewrite(content, body.currentOutput)
          : normalizeOutput(content)
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "模型响应超过 120 秒，已自动中止。可以重试，或换一个更快的模型。"
        : error instanceof Error
        ? error.message
        : "Unknown AI error.";

    return NextResponse.json({ message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
