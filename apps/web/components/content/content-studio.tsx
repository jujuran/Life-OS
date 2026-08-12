"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  contentCoverSops,
  contentHistorySeed,
  contentProjects,
  contentWritingSops,
  defaultContentTaskInput,
  type ContentHistoryItem,
  type ContentOutput,
  type ContentProject,
  type ContentTaskInput,
  type ContentWritingSop
} from "../../lib/content-studio-seed.public";
import { parseContentJsonPayload } from "../../lib/content-output-parser";

type NewProductDraft = {
  name: string;
  summary: string;
  productProfile: string;
  status: string;
};

type WritingSopDraft = {
  name: string;
  version: string;
  description: string;
  sourceName: string;
  markdownContent: string;
};

type PersistedContentStudioState = {
  projects: ContentProject[];
  writingSops: ContentWritingSop[];
  selectedProjectId: string;
  selectedWritingSopId: string;
  selectedCoverSopId: string;
  contentAiApiKeyId?: string;
  contentAiModel?: string;
  taskInput: ContentTaskInput;
  output: ContentOutput;
  history: ContentHistoryItem[];
  activeTitleIndex: number;
  generationCount: number;
};

type PublicAiApiKeyEntry = {
  id: string;
  label: string;
  maskedApiKey: string;
  provider: "deepseek" | "openai" | "openai-compatible";
  baseUrl: string;
  defaultModel: string;
  availableModels: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
};

type AiContentResponse = {
  ok?: boolean;
  output?: ContentOutput;
  message?: string;
  code?: string;
};

type PublicAiSettings = {
  provider: "deepseek" | "openai" | "openai-compatible";
  baseUrl: string;
  defaultModel: string;
  availableModels: string[];
  apiKeys: PublicAiApiKeyEntry[];
  activeApiKeyId: string | null;
  hasApiKey: boolean;
  maskedApiKey: string;
  updatedAt: string | null;
  source: "file" | "env" | "default";
};

type AiSettingsResponse = {
  ok?: boolean;
  settings?: PublicAiSettings;
  message?: string;
  availableModels?: string[];
};

type ContentStudioStoreResponse = {
  ok?: boolean;
  state?: PersistedContentStudioState | null;
  source?: "file" | "empty";
  message?: string;
};

type AiReviewAction = "rewrite_titles" | "make_closer" | "tone_down" | "shorten";

const contentStudioStorageKey = "life-os.content-studio.v1";
const defaultAiModel = "deepseek-v4-pro";

const defaultNewProductDraft: NewProductDraft = {
  name: "",
  summary: "",
  productProfile: "",
  status: "新产品"
};

const defaultWritingSopDraft: WritingSopDraft = {
  name: "",
  version: "V1.0",
  description: "",
  sourceName: "",
  markdownContent: ""
};

function formatStamp(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function getProjectById(projects: ContentProject[], projectId: string) {
  return projects.find((item) => item.id === projectId) ?? projects[0];
}

function getProjectWritingSops(project: ContentProject, writingSops = contentWritingSops) {
  const selectedSops = project.writingSopIds
    .map((id) => writingSops.find((sop) => sop.id === id))
    .filter((sop): sop is ContentWritingSop => Boolean(sop));

  return selectedSops;
}

function getProjectCoverSops(project: ContentProject) {
  const selectedSops = project.coverSopIds
    .map((id) => contentCoverSops.find((sop) => sop.id === id))
    .filter((sop): sop is (typeof contentCoverSops)[number] => Boolean(sop));

  return selectedSops.length ? selectedSops : [contentCoverSops[0]];
}

function getWritingSopById(sops: ContentWritingSop[], sopId: string) {
  return sops.find((item) => item.id === sopId) ?? sops[0];
}

function createProductId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-|-$/g, "");

  return `product-${slug || "untitled"}`;
}

function createSopId(name: string, version: string) {
  const slug = `${name}-${version}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-|-$/g, "");

  return `sop-${slug || "untitled"}`;
}

function createUniqueSopId(baseId: string, sops: ContentWritingSop[]) {
  let nextId = baseId;
  let suffix = 2;

  while (sops.some((sop) => sop.id === nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return nextId;
}

function stripSopFileExtension(name: string) {
  return name.trim().replace(/\.(md|markdown|txt)$/i, "");
}

function getMarkdownTitle(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^#{1,6}\s*/, "")
        .replace(/[*_`>\-[\]]/g, "")
        .trim()
    )
    .find(Boolean);
}

function getWritingSopDisplayName(sop: ContentWritingSop) {
  return stripSopFileExtension(sop.sourceName ?? sop.name);
}

function getDraftWritingSopName(draft: WritingSopDraft) {
  return (
    draft.name.trim() ||
    stripSopFileExtension(draft.sourceName) ||
    getMarkdownTitle(draft.markdownContent) ||
    ""
  );
}

function inferWritingSopMode(text: string): ContentWritingSop["mode"] {
  if (/清单|盘点|列表/.test(text)) {
    return "list";
  }

  if (/对比|体验|测评|比较|取舍/.test(text)) {
    return "comparison";
  }

  return "science";
}

function summarizeMarkdown(markdown: string) {
  const summary = getMarkdownTitle(markdown);
  if (summary) {
    return summary;
  }

  const plainText = markdown
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return plainText.slice(0, 36) || "新导入的写作 SOP";
}

function isContentProjectList(value: unknown): value is ContentProject[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        "id" in item &&
        "name" in item &&
        Array.isArray((item as ContentProject).writingSopIds)
    )
  );
}

function isContentWritingSopList(value: unknown): value is ContentWritingSop[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        "id" in item &&
        "name" in item &&
        typeof (item as ContentWritingSop).markdownContent === "string"
    )
  );
}

function ensureThreeOutputTitles(titles: string[], body: string) {
  const cleanTitles = titles
    .map((title) => title.trim())
    .filter(
      (title) =>
        title.length >= 4 &&
        title.length <= 42 &&
        !/[{}\[\]]/.test(title) &&
        !/^["']?(?:titles|body|tags)["']?\s*:/i.test(title)
    );
  const seed = cleanTitles[0]?.replace(/[，。！？、；：,.!?;:]+$/g, "").trim() ?? "";
  const contextTitle =
    body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean)
      ?.replace(/[。！？].*$/g, "")
      .slice(0, 34)
      .trim() ?? "";
  const candidates = [
    ...cleanTitles,
    contextTitle,
    seed ? `${seed}，背后真正发生了什么` : "",
    seed ? `别只看表面：${seed}` : "",
    "这件事背后，真正需要被看见的是什么"
  ];
  const uniqueTitles: string[] = [];

  for (const title of candidates) {
    if (title && !uniqueTitles.includes(title)) {
      uniqueTitles.push(title);
    }

    if (uniqueTitles.length === 3) {
      break;
    }
  }

  return uniqueTitles;
}

function normalizeComparableTitle(title: string) {
  return title
    .replace(/\s+/g, "")
    .replace(/[，。！？、；：,.!?;:"“”‘’'《》【】（）()]/g, "")
    .toLowerCase();
}

function removeLeadingDuplicateTitle(body: string, title: string) {
  const normalizedTitle = normalizeComparableTitle(title);

  if (!normalizedTitle) {
    return body;
  }

  const lines = body.split(/\r?\n/);
  const firstContentIndex = lines.findIndex((line) => line.trim());

  if (firstContentIndex < 0) {
    return "";
  }

  const normalizedFirstLine = normalizeComparableTitle(
    lines[firstContentIndex]
      .replace(/^(?:标题|题目|小红书标题|正文标题)\s*[:：]\s*/, "")
      .trim()
  );

  if (normalizedFirstLine === normalizedTitle) {
    lines.splice(firstContentIndex, 1);
  }

  return lines.join("\n").trim();
}

function normalizePersistedOutput(output: ContentOutput | undefined) {
  if (!output) {
    return undefined;
  }

  const recovered = parseContentJsonPayload(output.body);
  const recoveredBody = typeof recovered?.body === "string" ? recovered.body.trim() : output.body;
  const recoveredTitles = Array.isArray(recovered?.titles)
    ? recovered.titles.filter((title): title is string => typeof title === "string")
    : output.titles;
  const recoveredTags = Array.isArray(recovered?.tags)
    ? recovered.tags.filter((tag): tag is string => typeof tag === "string")
    : output.tags;

  return {
    ...output,
    titles: ensureThreeOutputTitles(recoveredTitles, recoveredBody),
    body: recoveredBody,
    tags: recoveredTags,
    stamp: output.stamp.replace("鍒氬垰鐢熸垚 路", "刚刚生成 ·")
  };
}

function normalizePersistedContentStudioState(
  value: Partial<PersistedContentStudioState>
): PersistedContentStudioState | undefined {
  if (!isContentProjectList(value.projects) || !isContentWritingSopList(value.writingSops)) {
    return undefined;
  }

  const persistedState = value as PersistedContentStudioState;

  return {
    ...persistedState,
    output: normalizePersistedOutput(persistedState.output) ?? persistedState.output,
    history: (persistedState.history ?? []).map((item) => ({
      ...item,
      status: item.status === "宸查€氳繃" ? "已通过" : item.status,
      output: normalizePersistedOutput(item.output)
    }))
  };
}

function readPersistedContentStudioState(): PersistedContentStudioState | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const raw = window.localStorage.getItem(contentStudioStorageKey);

  if (!raw) {
    return undefined;
  }

  try {
    return normalizePersistedContentStudioState(
      JSON.parse(raw) as Partial<PersistedContentStudioState>
    );
  } catch {
    return undefined;
  }
}

async function readContentStudioFileState() {
  const response = await fetch("/api/content/studio", {
    cache: "no-store"
  });
  const data = (await response.json()) as ContentStudioStoreResponse;

  if (!response.ok || !data.state) {
    return undefined;
  }

  return normalizePersistedContentStudioState(data.state);
}

async function writeContentStudioFileState(state: PersistedContentStudioState) {
  const response = await fetch("/api/content/studio", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      state
    })
  });
  const data = (await response.json()) as ContentStudioStoreResponse;

  if (!response.ok || !data.ok) {
    throw new Error(data.message || "save failed");
  }
}

function getContextLine(taskInput: ContentTaskInput) {
  return taskInput.referenceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

function buildTitleCandidates(
  project: ContentProject,
  sop: ContentWritingSop,
  taskInput: ContentTaskInput,
  revision = 0
) {
  const topic = taskInput.topic.trim() || taskInput.goal.trim() || `${project.name}内容任务`;
  const projectLabel = project.name;

  if (sop.mode === "science") {
    const variants = [
      `${topic}，不是捣乱，是需求没被看见`,
      `${topic}背后，是狗的大脑在找出口`,
      `${projectLabel}这类内容，重点不是玩具，而是需求`
    ];

    return variants.slice(revision % 2, variants.length).concat(variants.slice(0, revision % 2));
  }

  if (sop.mode === "list") {
    const variants = [
      `${topic}，我会先做这 4 件事`,
      `围绕${topic}，这 4 个方法更值得先试`,
      `${projectLabel}相关内容里，最该先讲清的是这几件事`
    ];

    return variants.slice(revision % 2, variants.length).concat(variants.slice(0, revision % 2));
  }

  const variants = [
    `${topic}，到底该怎么选`,
    `围绕${topic}，我最后留下的是这一类`,
    `${projectLabel}这类内容，真正该比的是方向`
  ];

  return variants.slice(revision % 2, variants.length).concat(variants.slice(0, revision % 2));
}

function buildScienceBody(
  project: ContentProject,
  taskInput: ContentTaskInput,
  contextLine?: string
) {
  const topic = taskInput.topic.trim() || "这类行为";
  const context =
    contextLine ?? "很多主人看到拆咬时，第一反应还是先把它归进坏习惯里。";

  return [
    `${topic}这件事，很多主人第一反应还是“它怎么又开始了”。`,
    "",
    "但如果换个角度看，真正值得追问的不是它乖不乖，而是它有没有被放在一个能正确消耗需求的环境里。",
    "",
    `${context}`,
    "",
    "当狗一直用嘴找事做的时候，它很多时候不是在对抗你，而是在给自己找一个能落下去的出口。",
    "",
    "说白了，需求没被看见，行为就会自己冒出来。",
    "",
    `这也是为什么围绕 ${project.name} 这类内容去写的时候，我更想把重点放在“怎么满足它”，而不是“怎么制止它”。`,
    "",
    "最简单的方式，不一定是更刺激，而是更贴近它本来会用的那套天性逻辑。",
    "",
    "真正让它安静下来的，往往不是被管住，而是终于有一件事可以认真做完。"
  ].join("\n");
}

function buildListBody(
  project: ContentProject,
  taskInput: ContentTaskInput,
  contextLine?: string
) {
  const topic = taskInput.topic.trim() || `${project.name}相关内容`;
  const context =
    contextLine ?? "想把一篇清单型内容写得有用，关键不是罗列更多点，而是把真正会发生的画面写出来。";

  return [
    `这次想写 ${topic}，我会先把最值得讲清的几件事排出来。`,
    "",
    `${context}`,
    "",
    "1. 先把问题写具体，而不是写抽象结论。",
    "",
    "比如别说“它精力太旺”，而是写“它总叼着袜子在客厅来回走”。",
    "",
    "2. 再把主人最容易做错的地方提出来。",
    "",
    "很多人不是不想做好，只是太容易先处理表面动作。",
    "",
    `3. 最后再把 ${project.name} 这种真正能承接场景的内容放进去，作为其中一项，而不是整篇唯一的主角。`,
    "",
    "清单真正有价值的地方，不是列得多，而是看完以后知道先从哪一件开始。"
  ].join("\n");
}

function buildComparisonBody(
  project: ContentProject,
  taskInput: ContentTaskInput,
  contextLine?: string
) {
  const topic = taskInput.topic.trim() || `${project.name}对比选题`;
  const context =
    contextLine ?? "体验对比型更像帮用户做决策，不是单纯讲道理，所以结论和取舍都要更明确。";

  return [
    `写 ${topic} 这种选题时，我更在意的不是把两边都说好，而是把真正的区别讲清楚。`,
    "",
    `${context}`,
    "",
    "同样一个场景下，要比的通常不是谁更热闹，而是谁更贴近狗当前真正要消耗的那部分需求。",
    "",
    "相比之下，如果一边只是暂时占住嘴，另一边却能让它持续投入，那差别就已经出来了。",
    "",
    `所以在围绕 ${project.name} 这类内容写体验对比时，我会更愿意把真实使用细节写进去，比如它会不会回头继续找，会不会很快失去兴趣。`,
    "",
    "对比型内容最重要的不是显得客观，而是让读者看完以后知道自己该怎么选。"
  ].join("\n");
}

function buildTags(project: ContentProject, sop: ContentWritingSop) {
  const baseTags = [project.name, "内容创作", "AI写作"];

  if (sop.mode === "science") {
    return baseTags.concat(["知识科普", "养狗认知"]);
  }

  if (sop.mode === "list") {
    return baseTags.concat(["清单盘点", "收藏向"]);
  }

  return baseTags.concat(["体验对比", "决策参考"]);
}

function buildGeneratedOutput(
  project: ContentProject,
  sop: ContentWritingSop,
  taskInput: ContentTaskInput,
  revision = 0
): ContentOutput {
  const contextLine = getContextLine(taskInput);
  const titles = buildTitleCandidates(project, sop, taskInput, revision);

  let body = buildScienceBody(project, taskInput, contextLine);

  if (sop.mode === "list") {
    body = buildListBody(project, taskInput, contextLine);
  }

  if (sop.mode === "comparison") {
    body = buildComparisonBody(project, taskInput, contextLine);
  }

  return {
    titles,
    body,
    tags: buildTags(project, sop),
    stamp: `刚刚生成 · ${formatStamp()}`
  };
}

function buildInitialOutput() {
  const project = contentProjects[0];
  const sop = getProjectWritingSops(project)[0] ?? contentWritingSops[0];

  return buildGeneratedOutput(
    project,
    sop,
    defaultContentTaskInput
  );
}

function buildHistoryItem(
  project: ContentProject,
  sop: ContentWritingSop,
  status: string,
  output?: ContentOutput
): ContentHistoryItem {
  return {
    id: `history-${Date.now()}`,
    label: `${project.name} / ${getWritingSopDisplayName(sop)}`,
    meta: formatStamp(),
    status,
    output
  };
}

async function requestAiContentOutput(
  project: ContentProject,
  sop: ContentWritingSop,
  taskInput: ContentTaskInput,
  options?: {
    mode?: "generate" | "review";
    reviewAction?: AiReviewAction;
    currentOutput?: ContentOutput;
    apiKeyIdOverride?: string;
    modelOverride?: string;
  }
): Promise<{ output?: ContentOutput; message: string }> {
  const response = await fetch("/api/ai/content", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      mode: options?.mode ?? "generate",
      reviewAction: options?.reviewAction,
      project: {
        name: project.name,
        productProfile: project.productProfile ?? project.summary
      },
      writingSop: {
        name: getWritingSopDisplayName(sop),
        version: sop.version,
        markdownContent: sop.markdownContent
      },
      apiKeyIdOverride: options?.apiKeyIdOverride,
      modelOverride: options?.modelOverride,
      taskInput,
      currentOutput: options?.currentOutput
    })
  });
  const data = (await response.json()) as AiContentResponse;

  if (!response.ok || !data.output) {
    return {
      output: undefined,
      message:
        data.code === "AI_NOT_CONFIGURED"
          ? "AI 尚未配置。请先去 AI 模块填写 API Key 和默认模型。"
          : data.message || "AI 暂时不可用，已切回本地草稿模板。"
    };
  }

  return {
    output: {
      ...data.output,
      titles: ensureThreeOutputTitles(data.output.titles, data.output.body)
    },
    message: data.message || "AI 已完成本次内容生成。"
  };
}

export function ContentStudio() {
  const initialProject = contentProjects[0];
  const initialWritingSop = getProjectWritingSops(initialProject)[0] ?? contentWritingSops[0];
  const initialCoverSop = getProjectCoverSops(initialProject)[0];
  const [projects, setProjects] = useState(contentProjects);
  const [writingSops, setWritingSops] = useState(contentWritingSops);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProject.id);
  const [selectedWritingSopId, setSelectedWritingSopId] = useState(initialWritingSop?.id ?? "");
  const [selectedCoverSopId, setSelectedCoverSopId] = useState(initialCoverSop.id);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newProductDraft, setNewProductDraft] = useState<NewProductDraft>(
    defaultNewProductDraft
  );
  const [availableAiKeys, setAvailableAiKeys] = useState<PublicAiApiKeyEntry[]>([]);
  const [contentAiApiKeyId, setContentAiApiKeyId] = useState("");
  const [aiModelOverride, setAiModelOverride] = useState("");
  const [isSopDialogOpen, setIsSopDialogOpen] = useState(false);
  const [editingSopId, setEditingSopId] = useState<string | null>(null);
  const [writingSopDraft, setWritingSopDraft] = useState<WritingSopDraft>(
    defaultWritingSopDraft
  );
  const [taskInput, setTaskInput] = useState(defaultContentTaskInput);
  const [output, setOutput] = useState<ContentOutput>(() => buildInitialOutput());
  const [history, setHistory] = useState<ContentHistoryItem[]>(contentHistorySeed);
  const [activeTitleIndex, setActiveTitleIndex] = useState(0);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ContentHistoryItem | null>(null);
  const [activeHistoryTitleIndex, setActiveHistoryTitleIndex] = useState(0);
  const [currentHistoryPage, setCurrentHistoryPage] = useState(1);
  const [generationCount, setGenerationCount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "当前本地内容系统已加载，先选择产品、SOP，再开始生成。"
  );
  const [hasLoadedSavedState, setHasLoadedSavedState] = useState(false);

  const selectedProject = getProjectById(projects, selectedProjectId);
  const availableWritingSops = getProjectWritingSops(selectedProject, writingSops);
  const selectedWritingSop = getWritingSopById(availableWritingSops, selectedWritingSopId);
  const approvedHistory = history.filter((item) => item.status === "已通过");
  const historyPageSize = 5;
  const historyPageCount = Math.max(1, Math.ceil(approvedHistory.length / historyPageSize));
  const safeHistoryPage = Math.min(currentHistoryPage, historyPageCount);
  const visibleHistory = approvedHistory.slice(
    (safeHistoryPage - 1) * historyPageSize,
    safeHistoryPage * historyPageSize
  );
  const selectedContentAiKey =
    availableAiKeys.find((entry) => entry.id === contentAiApiKeyId) ??
    availableAiKeys.find((entry) => entry.isActive) ??
    availableAiKeys[0];
  const writingAiModelsForSelectedKey = Array.from(
    new Set(
      (
        selectedContentAiKey
          ? [
              ...(selectedContentAiKey.availableModels ?? []),
              selectedContentAiKey.defaultModel
            ]
          : [defaultAiModel]
      ).filter((model): model is string => Boolean(model?.trim()))
    )
  );
  const activeWritingModel =
    aiModelOverride && writingAiModelsForSelectedKey.includes(aiModelOverride)
      ? aiModelOverride
      : selectedContentAiKey?.defaultModel || writingAiModelsForSelectedKey[0] || defaultAiModel;
  const writingAiModels = writingAiModelsForSelectedKey.includes(activeWritingModel)
    ? writingAiModelsForSelectedKey
    : [activeWritingModel, ...writingAiModelsForSelectedKey];
  const activeWritingAiKeyId = selectedContentAiKey?.id ?? contentAiApiKeyId;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let isCancelled = false;

    async function loadSavedContentState() {
      let persistedState: PersistedContentStudioState | undefined;
      let shouldMigrateBrowserCache = false;

      try {
        persistedState = await readContentStudioFileState();
      } catch {
        persistedState = undefined;
      }

      if (!persistedState) {
        persistedState = readPersistedContentStudioState();
        shouldMigrateBrowserCache = Boolean(persistedState);
      }

      if (isCancelled) {
        return;
      }

      if (!persistedState) {
        setHasLoadedSavedState(true);
        return;
      }

      const nextProjects = persistedState.projects.map((project) => ({
        ...project,
        productProfile: project.productProfile ?? project.summary ?? ""
      }));
      const nextWritingSops = persistedState.writingSops;
      const nextSelectedProjectId =
        nextProjects.find((project) => project.id === persistedState.selectedProjectId)?.id ??
        nextProjects[0]?.id ??
        initialProject.id;
      const nextSelectedProject = getProjectById(nextProjects, nextSelectedProjectId);
      const nextAvailableWritingSops = getProjectWritingSops(nextSelectedProject, nextWritingSops);
      const nextSelectedWritingSopId =
        nextAvailableWritingSops.find((sop) => sop.id === persistedState.selectedWritingSopId)
          ?.id ??
        nextAvailableWritingSops[0]?.id ??
        "";

      setProjects(nextProjects);
      setWritingSops(nextWritingSops);
      setSelectedProjectId(nextSelectedProjectId);
      setSelectedWritingSopId(nextSelectedWritingSopId);
      setSelectedCoverSopId(persistedState.selectedCoverSopId ?? initialCoverSop.id);
      setTaskInput(persistedState.taskInput);
      setOutput(persistedState.output);
      setHistory(Array.isArray(persistedState.history) ? persistedState.history : []);
      setActiveTitleIndex(
        typeof persistedState.activeTitleIndex === "number" ? persistedState.activeTitleIndex : 0
      );
      setGenerationCount(
        typeof persistedState.generationCount === "number" ? persistedState.generationCount : 0
      );

      if (typeof persistedState.contentAiApiKeyId === "string") {
        setContentAiApiKeyId(persistedState.contentAiApiKeyId);
      }

      if (typeof persistedState.contentAiModel === "string" && persistedState.contentAiModel) {
        setAiModelOverride(persistedState.contentAiModel);
      }

      if (shouldMigrateBrowserCache) {
        try {
          await writeContentStudioFileState(persistedState);
          window.localStorage.removeItem(contentStudioStorageKey);
          setStatusMessage("已把内容系统数据迁移到本地文件 content-studio.json。");
        } catch {
          setStatusMessage("浏览器旧数据读取成功，但写入本地文件失败。请稍后再试。");
        }
      }

      setHasLoadedSavedState(true);
    }

    void loadSavedContentState();

    return () => {
      isCancelled = true;
    };
  }, [initialCoverSop.id, initialProject.id]);

  useEffect(() => {
    if (!hasLoadedSavedState || typeof window === "undefined") {
      return;
    }

    const timer = window.setTimeout(() => {
      const payload: PersistedContentStudioState = {
        projects,
        writingSops,
        selectedProjectId,
        selectedWritingSopId,
        selectedCoverSopId,
        contentAiApiKeyId: activeWritingAiKeyId,
        contentAiModel: activeWritingModel,
        taskInput,
        output,
        history,
        activeTitleIndex,
        generationCount
      };

      void writeContentStudioFileState(payload).catch(() => {
        setStatusMessage("内容系统本地文件保存失败，请确认系统服务仍在运行。");
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    activeTitleIndex,
    generationCount,
    hasLoadedSavedState,
    history,
    output,
    projects,
    activeWritingAiKeyId,
    activeWritingModel,
    selectedCoverSopId,
    selectedProjectId,
    selectedWritingSopId,
    taskInput,
    writingSops
  ]);

  useEffect(() => {
    let isCancelled = false;

    async function loadAiSettings() {
      try {
        const response = await fetch("/api/ai/settings");
        const data = (await response.json()) as AiSettingsResponse;

        if (!response.ok || !data.settings || isCancelled) {
          throw new Error(data.message || "load failed");
        }

        setAvailableAiKeys(data.settings.apiKeys ?? []);
        setContentAiApiKeyId(
          (current) => current || data.settings?.activeApiKeyId || data.settings?.apiKeys?.[0]?.id || ""
        );
        setAiModelOverride((current) => current || data.settings?.defaultModel || defaultAiModel);
      } catch {
        if (!isCancelled) {
          setAvailableAiKeys([]);
          setAiModelOverride((current) => current || defaultAiModel);
        }
      }
    }

    void loadAiSettings();

    return () => {
      isCancelled = true;
    };
  }, []);

  function handleSelectProject(project: ContentProject) {
    const nextWritingSop = getProjectWritingSops(project, writingSops)[0];
    setSelectedProjectId(project.id);
    setSelectedWritingSopId(nextWritingSop?.id ?? "");
    if (nextWritingSop) {
      setOutput(buildGeneratedOutput(project, nextWritingSop, taskInput, generationCount));
    }
    setActiveTitleIndex(0);
    setStatusMessage(
      nextWritingSop
        ? `已切换到 ${project.name}，SOP 列表会按这个产品过滤。`
        : `已切换到 ${project.name}，这个产品还没有导入写作 SOP。`
    );
  }

  function openProductDialog(project?: ContentProject) {
    if (project) {
      setEditingProductId(project.id);
      setNewProductDraft({
        name: project.name,
        summary: project.summary,
        productProfile: project.productProfile ?? project.summary,
        status: project.status
      });
    } else {
      setEditingProductId(null);
      setNewProductDraft(defaultNewProductDraft);
    }

    setIsProductDialogOpen(true);
  }

  function handleSaveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newProductDraft.name.trim();

    if (!name) {

      return;
    }

    const nextProjectId = editingProductId ?? createProductId(name);
    const existingProject = projects.find((project) => project.id === editingProductId);
    const nextProject: ContentProject = {
      id: nextProjectId,
      name,
      summary:
        newProductDraft.summary.trim() ||
        newProductDraft.productProfile.trim().split(/\r?\n/).find(Boolean) ||
        "新的内容产品，后面可以继续补充产品档案。",
      productProfile: newProductDraft.productProfile.trim(),
      status: newProductDraft.status.trim() || "新产品",
      writingSopIds: existingProject?.writingSopIds ?? [],
      coverSopIds: contentCoverSops.map((sop) => sop.id)
    };

    setProjects((current) =>
      editingProductId
        ? current.map((project) => (project.id === editingProductId ? nextProject : project))
        : current.concat(nextProject)
    );
    setNewProductDraft(defaultNewProductDraft);
    setEditingProductId(null);
    setIsProductDialogOpen(false);
    handleSelectProject(nextProject);
  }

  function openSopDialog(sop?: ContentWritingSop) {
    if (sop) {
      setEditingSopId(sop.id);
      setWritingSopDraft({
        name: sop.name,
        version: sop.version,
        description: sop.description,
        sourceName: sop.sourceName ?? "",
        markdownContent: sop.markdownContent
      });
    } else {
      setEditingSopId(null);
      setWritingSopDraft(defaultWritingSopDraft);
    }

    setIsSopDialogOpen(true);
  }

  function handleContentAiKeyChange(nextKeyId: string) {
    const nextKey = availableAiKeys.find((entry) => entry.id === nextKeyId);

    setContentAiApiKeyId(nextKeyId);
    setAiModelOverride(
      nextKey?.defaultModel || nextKey?.availableModels?.[0] || aiModelOverride || defaultAiModel
    );
  }

  async function handleImportSopFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const markdownContent = await file.text();
    const fileLabel = stripSopFileExtension(file.name);

    setWritingSopDraft((current) => ({
      ...current,
      name: fileLabel,
      description: "",
      sourceName: file.name,
      markdownContent
    }));
    event.target.value = "";

  }

  function handleSaveWritingSop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = getDraftWritingSopName(writingSopDraft);
    const markdownContent = writingSopDraft.markdownContent.trim();

    if (!name) {

      return;
    }

    if (!markdownContent) {

      return;
    }

    const draftSopId = createSopId(name, writingSopDraft.version);
    const nextSopId = editingSopId ?? createUniqueSopId(draftSopId, writingSops);
    const nextSop: ContentWritingSop = {
      id: nextSopId,
      name,
      version: writingSopDraft.version.trim() || "V1.0",
      description:
        writingSopDraft.description.trim() || summarizeMarkdown(markdownContent),
      mode: inferWritingSopMode(`${name}\n${markdownContent}`),
      sourceName: writingSopDraft.sourceName.trim() || undefined,
      markdownContent
    };

    setWritingSops((current) =>
      editingSopId
        ? current.map((sop) => (sop.id === editingSopId ? nextSop : sop))
        : current.concat(nextSop)
    );
    setProjects((current) =>
      current.map((project) =>
        project.id === selectedProject.id
          ? {
              ...project,
              writingSopIds: project.writingSopIds.includes(nextSop.id)
                ? project.writingSopIds
                : project.writingSopIds.concat(nextSop.id)
            }
          : project
      )
    );
    setSelectedWritingSopId(nextSop.id);
    setOutput(buildGeneratedOutput(selectedProject, nextSop, taskInput, generationCount));
    setWritingSopDraft(defaultWritingSopDraft);
    setEditingSopId(null);
    setIsSopDialogOpen(false);

  }

  function handleDeleteWritingSop() {
    if (!editingSopId) {
      return;
    }

    const nextWritingSops = writingSops.filter((sop) => sop.id !== editingSopId);
    const nextProjects = projects.map((project) => ({
      ...project,
      writingSopIds: project.writingSopIds.filter((id) => id !== editingSopId)
    }));
    const nextSelectedProject = getProjectById(nextProjects, selectedProjectId);
    const nextAvailableSops = getProjectWritingSops(nextSelectedProject, nextWritingSops);
    const nextSelectedSop =
      selectedWritingSopId === editingSopId
        ? nextAvailableSops[0]
        : getWritingSopById(nextAvailableSops, selectedWritingSopId);

    setWritingSops(nextWritingSops);
    setProjects(nextProjects);
    setSelectedWritingSopId(nextSelectedSop?.id ?? "");

    if (nextSelectedSop) {
      setOutput(buildGeneratedOutput(nextSelectedProject, nextSelectedSop, taskInput, generationCount));
    }

    setWritingSopDraft(defaultWritingSopDraft);
    setEditingSopId(null);
    setIsSopDialogOpen(false);

  }

  async function handleGenerate(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (isGenerating) {
      return;
    }

    const project = selectedProject;
    const sop = selectedWritingSop;

    if (!sop) {

      setIsSopDialogOpen(true);
      return;
    }

    const nextGenerationCount = generationCount + 1;
    setIsGenerating(true);
    setStatusMessage(
      `正在调用写作 AI（${activeWritingModel}），根据当前产品、SOP 和任务输入生成草稿...`
    );

    try {
      const aiResult = await requestAiContentOutput(project, sop, taskInput, {
        apiKeyIdOverride: activeWritingAiKeyId,
        modelOverride: activeWritingModel
      });
      const nextOutput =
        aiResult.output ?? buildGeneratedOutput(project, sop, taskInput, nextGenerationCount);

      setOutput(nextOutput);
      setGenerationCount(nextGenerationCount);
      setActiveTitleIndex(0);
      setStatusMessage(aiResult.message);
    } catch {
      const nextOutput = buildGeneratedOutput(project, sop, taskInput, nextGenerationCount);

      setOutput(nextOutput);
      setGenerationCount(nextGenerationCount);
      setActiveTitleIndex(0);
      setStatusMessage("AI 暂时不可用，已切回本地草稿模板。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleAiReviewAction(action: AiReviewAction) {
    if (isGenerating) {
      return;
    }

    const project = selectedProject;
    const sop = selectedWritingSop;

    if (!sop) {
      setStatusMessage("先为当前产品导入一个写作 SOP，再继续审稿动作。");
      return;
    }

    const actionLabels: Record<AiReviewAction, string> = {
      rewrite_titles: "重写标题",
      make_closer: "开头更像我",
      tone_down: "收敛语气",
      shorten: "缩短正文"
    };

    setIsGenerating(true);
    setStatusMessage(`正在调用写作 AI（${activeWritingModel}）：${actionLabels[action]}...`);

    try {
      const aiResult = await requestAiContentOutput(project, sop, taskInput, {
        mode: "review",
        reviewAction: action,
        currentOutput: output,
        apiKeyIdOverride: activeWritingAiKeyId,
        modelOverride: activeWritingModel
      });

      if (!aiResult.output) {
        throw new Error(aiResult.message);
      }

      if (action === "rewrite_titles") {
        setOutput((current) => ({
          ...current,
          titles: aiResult.output?.titles.length ? aiResult.output.titles : current.titles,
          stamp: aiResult.output?.stamp ?? current.stamp
        }));
        setActiveTitleIndex(0);
      } else {
        setOutput(aiResult.output);
        setActiveTitleIndex(0);
      }
      setStatusMessage(`AI 已完成：${actionLabels[action]}。`);
    } catch {
      setStatusMessage(`AI 审稿暂时不可用，${actionLabels[action]}没有更新。`);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleApprove() {
    const project = selectedProject;
    const sop = selectedWritingSop;

    if (!sop) {
      setStatusMessage("当前没有可归档的写作 SOP，先导入一个再通过。");
      return;
    }

    setHistory((current) => [
      buildHistoryItem(project, sop, "已通过", output),
      ...current
    ]);
    setCurrentHistoryPage(1);
    setStatusMessage(`已通过并归档：${project.name} / ${getWritingSopDisplayName(sop)}`);
  }

  function handleOpenHistoryItem(item: ContentHistoryItem) {
    if (!item.output) {
      setStatusMessage("这条历史记录没有保存正文内容。");
      return;
    }

    setSelectedHistoryItem(item);
    setActiveHistoryTitleIndex(0);
    setStatusMessage(`正在查看历史记录：${item.label} · ${item.meta}`);
  }

  function handleLoadHistoryToOutput() {
    if (!selectedHistoryItem?.output) {
      return;
    }

    setOutput(selectedHistoryItem.output);
    setActiveTitleIndex(0);
    setSelectedHistoryItem(null);
    setStatusMessage(`已载入历史记录：${selectedHistoryItem.label} · ${selectedHistoryItem.meta}`);
  }

  async function handleCopyHistoryOutput() {
    const historyOutput = selectedHistoryItem?.output;

    if (!historyOutput) {
      return;
    }

    const title = historyOutput.titles[activeHistoryTitleIndex] ?? historyOutput.titles[0] ?? "";
    const tags = historyOutput.tags.map((tag) => `#${tag}`).join(" ");
    const text = [title, "", historyOutput.body, "", tags].filter(Boolean).join("\n");

    try {
      await navigator.clipboard.writeText(text);

    } catch {

    }
  }

  function handleRewriteTitles() {
    void handleAiReviewAction("rewrite_titles");
  }

  function handleMakeCloser() {
    void handleAiReviewAction("make_closer");
  }

  function handleToneDown() {
    void handleAiReviewAction("tone_down");
  }

  function handleShorten() {
    void handleAiReviewAction("shorten");
  }

  function handleRerun() {
    void handleGenerate();
  }

  async function handleCopyOutput() {
    const title = output.titles[activeTitleIndex] ?? "";
    const body = removeLeadingDuplicateTitle(output.body, title);
    const tags = output.tags.map((tag) => `#${tag}`).join(" ");
    const text = [title, "", body, "", tags].filter(Boolean).join("\n");

    try {
      await navigator.clipboard.writeText(text);

    } catch {

    }
  }

  const activeOutputTitle = output.titles[activeTitleIndex] ?? "";
  const visibleOutputBody = removeLeadingDuplicateTitle(output.body, activeOutputTitle);

  return (
    <div className="content-shell">
      <div className="content-layout">
        <aside className="content-rail">
          <section className="content-panel content-panel--compact">
            <div className="content-panel__header content-panel__header--spread">
              <div>
                <p className="eyebrow">PROJECTS</p>
                <h2 className="section-title">产品 / 项目</h2>
              </div>
              <button
                className="content-icon-button"
                type="button"
                aria-label="新增产品"
                onClick={() => openProductDialog()}
              >
                +
              </button>
            </div>
            <div className="content-option-list content-option-list--three content-option-list--products">
              {projects.map((project) => (
                <button
                  key={project.id}
                  className={`content-option ${
                    project.id === selectedProjectId ? "content-option--active" : ""
                  }`}
                  type="button"
                  onClick={() => handleSelectProject(project)}
                >
                  <span className="content-option__title-row">
                    <span>{project.name}</span>
                    <span className="tag">{project.status}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="content-panel content-panel--compact">
            <div className="content-panel__header content-panel__header--spread">
              <div>
                <p className="eyebrow">WRITING SOP</p>
                <h2 className="section-title">写作 SOP</h2>
                <p className="section-subtitle">当前：{selectedProject.name}</p>
              </div>
              <button
                className="content-icon-button"
                type="button"
                aria-label="管理写作 SOP"
                onClick={() => openSopDialog()}
              >
                +
              </button>
            </div>
            <div className="content-option-list content-option-list--three content-option-list--sops">
              {availableWritingSops.length ? (
                availableWritingSops.map((sop) => (
                  <button
                    key={sop.id}
                    className={`content-option ${
                      sop.id === selectedWritingSopId ? "content-option--active" : ""
                    }`}
                    type="button"
                    onClick={() => setSelectedWritingSopId(sop.id)}
                  >
                    <span className="content-option__title-row">
                      <span>{getWritingSopDisplayName(sop)}</span>
                      <span className="mono-text mono-text--subtle">{sop.version}</span>
                    </span>
                  </button>
                ))
              ) : (
                <div className="content-empty-note">还没有写作 SOP，先导入一个 Markdown 文件。</div>
              )}
            </div>
          </section>

          <section className="content-panel content-panel--compact">
            <div className="content-panel__header">
              <div>
                <p className="eyebrow">COVER SOP</p>
                <h2 className="section-title">生图 SOP</h2>
              </div>
            </div>
            <div className="pill-row">
              {contentCoverSops.map((sop) => (
                <button
                  key={sop.id}
                  className={`pill ${
                    sop.id === selectedCoverSopId ? "pill--active" : ""
                  }`}
                  type="button"
                  onClick={() => setSelectedCoverSopId(sop.id)}
                >
                  {sop.name}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="content-main">
          <form className="content-panel" id="task" onSubmit={handleGenerate}>
            <div className="content-panel__header content-panel__header--spread">
              <div>
                <p className="eyebrow">TASK</p>
                <h1 className="section-title">任务输入</h1>
              </div>
              <span className="mono-text mono-text--subtle">
                {selectedWritingSop
                  ? `${selectedProject.name} / ${getWritingSopDisplayName(selectedWritingSop)} ${selectedWritingSop.version}`
                  : `${selectedProject.name} / 未导入 SOP`}
              </span>
            </div>

            <div className="content-task-grid">
              <label className="field">
                <span className="field__label">任务目标</span>
                <input
                  className="field__input"
                  value={taskInput.goal}
                  placeholder="例如：写一篇适合目标渠道发布的内容初稿"
                  onChange={(event) =>
                    setTaskInput((current) => ({
                      ...current,
                      goal: event.target.value
                    }))
                  }
                />
              </label>

              <label className="field">
                <span className="field__label">本次选题</span>
                <input
                  className="field__input"
                  value={taskInput.topic}
                  placeholder="例如：狗拆东西，不是捣乱"
                  onChange={(event) =>
                    setTaskInput((current) => ({
                      ...current,
                      topic: event.target.value
                    }))
                  }
                />
              </label>

              <label className="field content-task-grid__wide">
                <span className="field__label">参考文字</span>
                <textarea
                  className="field__input content-textarea"
                  rows={1}
                  value={taskInput.referenceText}
                  placeholder="粘贴参考文字、聊天记录，或你想强调的观点..."
                  onChange={(event) =>
                    setTaskInput((current) => ({
                      ...current,
                      referenceText: event.target.value
                    }))
                  }
                />
              </label>
            </div>

            <div className="content-panel__footer">
              <span className="section-subtitle">{statusMessage}</span>
              <button className="primary-button" type="submit" disabled={isGenerating}>
                {isGenerating ? "生成中..." : "开始生成"}
              </button>
            </div>
          </form>

          <section className="content-panel content-panel--result">
            <div className="content-panel__header content-panel__header--spread">
              <div>
                <p className="eyebrow">OUTPUT</p>
                <h2 className="section-title">生成结果</h2>
              </div>
              <span className="mono-text mono-text--subtle">{output.stamp}</span>
            </div>

            <div className="content-title-list" role="tablist" aria-label="title candidates">
              {output.titles.map((title, index) => (
                <button
                  key={`${title}-${index}`}
                  className={`content-title-chip ${
                    index === activeTitleIndex ? "content-title-chip--active" : ""
                  }`}
                  type="button"
                  onClick={() => setActiveTitleIndex(index)}
                >
                  {title}
                </button>
              ))}
            </div>

            <article className="content-output-card">
              <button
                className="content-copy-button"
                type="button"
                onClick={handleCopyOutput}
                aria-label="复制生成结果"
              >
                复制
              </button>
              <h3 className="content-output-card__title">{activeOutputTitle}</h3>
              <div className="content-output-card__body">
                {visibleOutputBody.split("\n").map((line, index) =>
                  line ? (
                    <p key={`${line}-${index}`}>{line}</p>
                  ) : (
                    <div key={`spacer-${index}`} className="content-output-card__spacer" />
                  )
                )}
              </div>
              <div className="content-tag-row">
                {output.tags.map((tag) => (
                  <span key={tag} className="content-hash-tag">
                    #{tag}
                  </span>
                ))}
              </div>
            </article>
          </section>
        </section>

        <aside className="content-review">
          <section className="content-panel content-panel--compact">
            <div className="content-panel__header">
              <div>
                <p className="eyebrow">REVIEW</p>
                <h2 className="section-title">审稿动作</h2>
              </div>
            </div>
            <div className="content-review-actions">
              <button
                className="ghost-button ghost-button--small"
                type="button"
                onClick={handleApprove}
                disabled={isGenerating}
              >
                通过
              </button>
              <button
                className="ghost-button ghost-button--small"
                type="button"
                onClick={handleRewriteTitles}
                disabled={isGenerating}
              >
                重写标题
              </button>
              <button
                className="ghost-button ghost-button--small"
                type="button"
                onClick={handleMakeCloser}
                disabled={isGenerating}
              >
                开头更像我
              </button>
              <button
                className="ghost-button ghost-button--small"
                type="button"
                onClick={handleToneDown}
                disabled={isGenerating}
              >
                收敛一点
              </button>
              <button
                className="ghost-button ghost-button--small"
                type="button"
                onClick={handleShorten}
                disabled={isGenerating}
              >
                缩短一点
              </button>
              <button
                className="ghost-button ghost-button--small"
                type="button"
                onClick={handleRerun}
                disabled={isGenerating}
              >
                重跑
              </button>
            </div>
          </section>

          <section className="content-panel content-panel--compact">
            <div className="content-panel__header">
              <div>
                <p className="eyebrow">HISTORY</p>
                <h2 className="section-title">历史</h2>
                <p className="section-subtitle">只显示已通过 · 共 {approvedHistory.length} 条</p>
              </div>
            </div>
            <div className="content-history-list">
              {visibleHistory.length ? (
                visibleHistory.map((item) => (
                  <button
                    key={item.id}
                    className={`content-history-item ${
                      item.output ? "content-history-item--clickable" : ""
                    }`}
                    type="button"
                    onClick={() => handleOpenHistoryItem(item)}
                  >
                    <div className="content-history-item__row">
                      <span>{item.label}</span>
                      <span className="tag">{item.status}</span>
                    </div>
                    <span className="section-subtitle">{item.meta}</span>
                  </button>
                ))
              ) : (
                <div className="content-empty-note">还没有已通过的历史内容。</div>
              )}
            </div>
            <div className="content-history-pagination">
              <button
                className="ghost-button ghost-button--small"
                type="button"
                disabled={safeHistoryPage <= 1}
                onClick={() => setCurrentHistoryPage((page) => Math.max(1, page - 1))}
              >
                上一页
              </button>
              <span className="mono-text mono-text--subtle">
                {safeHistoryPage} / {historyPageCount}
              </span>
              <button
                className="ghost-button ghost-button--small"
                type="button"
                disabled={safeHistoryPage >= historyPageCount}
                onClick={() =>
                  setCurrentHistoryPage((page) => Math.min(historyPageCount, page + 1))
                }
              >
                下一页
              </button>
            </div>
          </section>
        </aside>
      </div>

      {selectedHistoryItem?.output ? (
        <div className="content-modal" role="dialog" aria-modal="true" aria-label="历史内容详情">
          <button
            className="content-modal__backdrop"
            type="button"
            aria-label="关闭历史内容详情"
            onClick={() => setSelectedHistoryItem(null)}
          />
          <section className="content-modal__panel content-modal__panel--history">
            <div className="content-modal__header">
              <div>
                <p className="eyebrow">HISTORY DETAIL</p>
                <h2 className="section-title">历史内容</h2>
                <p className="section-subtitle">
                  {selectedHistoryItem.label} · {selectedHistoryItem.meta} · {selectedHistoryItem.status}
                </p>
              </div>
              <button
                className="content-icon-button"
                type="button"
                aria-label="关闭历史内容详情"
                onClick={() => setSelectedHistoryItem(null)}
              >
                ×
              </button>
            </div>

            <div className="content-title-list" role="tablist" aria-label="history title candidates">
              {selectedHistoryItem.output.titles.map((title, index) => (
                <button
                  key={`${selectedHistoryItem.id}-${title}-${index}`}
                  className={`content-title-chip ${
                    index === activeHistoryTitleIndex ? "content-title-chip--active" : ""
                  }`}
                  type="button"
                  onClick={() => setActiveHistoryTitleIndex(index)}
                >
                  {title}
                </button>
              ))}
            </div>

            <article className="content-output-card content-output-card--history">
              <h3 className="content-output-card__title">
                {selectedHistoryItem.output.titles[activeHistoryTitleIndex] ??
                  selectedHistoryItem.output.titles[0]}
              </h3>
              <div className="content-output-card__body">
                {selectedHistoryItem.output.body.split("\n").map((line, index) =>
                  line ? (
                    <p key={`${selectedHistoryItem.id}-${line}-${index}`}>{line}</p>
                  ) : (
                    <div
                      key={`${selectedHistoryItem.id}-spacer-${index}`}
                      className="content-output-card__spacer"
                    />
                  )
                )}
              </div>
              <div className="content-tag-row">
                {selectedHistoryItem.output.tags.map((tag) => (
                  <span key={`${selectedHistoryItem.id}-${tag}`} className="content-hash-tag">
                    #{tag}
                  </span>
                ))}
              </div>
            </article>

            <div className="content-modal__actions">
              <button className="ghost-button" type="button" onClick={() => setSelectedHistoryItem(null)}>
                关闭
              </button>
              <div className="content-modal__action-group">
                <button className="ghost-button" type="button" onClick={handleCopyHistoryOutput}>
                  复制内容
                </button>
                <button className="primary-button" type="button" onClick={handleLoadHistoryToOutput}>
                  载入到输出区
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isProductDialogOpen ? (
        <div className="content-modal" role="dialog" aria-modal="true" aria-label="产品管理">
          <button
            className="content-modal__backdrop"
            type="button"
            aria-label="关闭产品管理"
            onClick={() => setIsProductDialogOpen(false)}
          />
          <section className="content-modal__panel">
            <div className="content-modal__header">
              <div>
                <p className="eyebrow">PRODUCTS</p>
                <h2 className="section-title">产品 / 项目管理</h2>
              </div>
              <button
                className="content-icon-button"
                type="button"
                aria-label="关闭产品管理"
                onClick={() => setIsProductDialogOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="content-modal__body">
              <aside className="content-modal__list">
                <div className="content-modal__list-head">
                  <span className="field__label">已有产品</span>
                  <button
                    className="ghost-button ghost-button--small"
                    type="button"
                    onClick={() => openProductDialog()}
                  >
                    新建
                  </button>
                </div>
                {projects.map((project) => (
                  <button
                    key={project.id}
                    className={`content-modal-list-item ${
                      editingProductId === project.id ? "content-modal-list-item--active" : ""
                    }`}
                    type="button"
                    onClick={() => openProductDialog(project)}
                  >
                    <span className="content-option__title-row">
                      <span>{project.name}</span>
                      <span className="tag">{project.status}</span>
                    </span>
                  </button>
                ))}
              </aside>

              <form className="content-modal__form" onSubmit={handleSaveProduct}>
                <label className="field">
                  <span className="field__label">产品名称</span>
                  <input
                    className="field__input"
                    value={newProductDraft.name}
                    placeholder="例如：示例项目 A"
                    onChange={(event) =>
                      setNewProductDraft((current) => ({
                        ...current,
                        name: event.target.value
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span className="field__label">状态</span>
                  <input
                    className="field__input"
                    value={newProductDraft.status}
                    onChange={(event) =>
                      setNewProductDraft((current) => ({
                        ...current,
                        status: event.target.value
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span className="field__label">产品信息 / Markdown 档案</span>
                  <textarea
                    className="field__input content-markdown-textarea content-product-profile-textarea"
                    value={newProductDraft.productProfile}
                    placeholder={[
                      "# 产品名称",
                      "",
                      "## 一句话定位",
                      "",
                      "## 适用对象",
                      "",
                      "## 核心卖点",
                      "",
                      "## 使用场景",
                      "",
                      "## 不能乱说 / 禁区"
                    ].join("\n")}
                    onChange={(event) =>
                      setNewProductDraft((current) => ({
                        ...current,
                        productProfile: event.target.value
                      }))
                    }
                  />
                </label>
                <p className="content-form-note">
                  AI 写作会同时读取这里的产品信息、当前写作 SOP 和本次任务输入。
                </p>
                <div className="content-modal__actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setIsProductDialogOpen(false)}
                  >
                    取消
                  </button>
                  <button className="primary-button" type="submit">
                    {editingProductId ? "保存产品" : "添加产品"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      ) : null}

      {isSopDialogOpen ? (
        <div className="content-modal" role="dialog" aria-modal="true" aria-label="写作 SOP 管理">
          <button
            className="content-modal__backdrop"
            type="button"
            aria-label="关闭写作 SOP 管理"
            onClick={() => setIsSopDialogOpen(false)}
          />
          <section className="content-modal__panel">
            <div className="content-modal__header">
              <div>
                <p className="eyebrow">WRITING SOP</p>
                <h2 className="section-title">写作 SOP 管理</h2>
                <p className="section-subtitle">当前产品：{selectedProject.name}</p>
              </div>
              <button
                className="content-icon-button"
                type="button"
                aria-label="关闭写作 SOP 管理"
                onClick={() => setIsSopDialogOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="content-modal__body">
              <aside className="content-modal__list">
                <div className="content-modal__list-head">
                  <span className="field__label">当前产品 SOP</span>
                  <button
                    className="ghost-button ghost-button--small"
                    type="button"
                    onClick={() => openSopDialog()}
                  >
                    新建
                  </button>
                </div>
                {availableWritingSops.length ? (
                  availableWritingSops.map((sop) => (
                    <button
                      key={sop.id}
                      className={`content-modal-list-item ${
                        editingSopId === sop.id ? "content-modal-list-item--active" : ""
                      }`}
                      type="button"
                      onClick={() => openSopDialog(sop)}
                    >
                      <span className="content-option__title-row">
                        <span>{getWritingSopDisplayName(sop)}</span>
                        <span className="mono-text mono-text--subtle">{sop.version}</span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="content-empty-note">
                    当前产品还没有写作 SOP。点“新建”导入一个 Markdown。
                  </div>
                )}

                <div className="content-writing-ai-card">
                  <div className="content-writing-ai-card__header">
                    <div>
                      <p className="eyebrow">WRITING AI</p>
                      <h3 className="section-title">写作模型</h3>
                    </div>
                    <span className="tag">仅内容</span>
                  </div>
                  <label className="field">
                    <span className="field__label">API Key</span>
                    <select
                      className="field__input"
                      value={activeWritingAiKeyId}
                      disabled={!availableAiKeys.length}
                      onChange={(event) => handleContentAiKeyChange(event.target.value)}
                    >
                      {availableAiKeys.length ? (
                        availableAiKeys.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.label} · {entry.defaultModel}
                          </option>
                        ))
                      ) : (
                        <option value="">先在 AI 模块配置 API Key</option>
                      )}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field__label">模型</span>
                    <select
                      className="field__input"
                      value={activeWritingModel}
                      onChange={(event) => setAiModelOverride(event.target.value)}
                    >
                      {writingAiModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="content-form-note">
                    这里仅控制内容系统写作；AI 模块对话可以继续使用自己的当前模型。
                  </p>
                </div>
              </aside>

              <form className="content-modal__form" onSubmit={handleSaveWritingSop}>
                <label className="field">
                  <span className="field__label">SOP 名称</span>
                  <input
                    className="field__input"
                    value={writingSopDraft.name}
                    placeholder="例如：示例项目-知识科普型 V1.0"
                    onChange={(event) =>
                      setWritingSopDraft((current) => ({
                        ...current,
                        name: event.target.value
                      }))
                    }
                  />
                </label>
                <div className="content-modal__form-grid">
                  <label className="field">
                    <span className="field__label">版本 / 标记</span>
                    <input
                      className="field__input"
                      value={writingSopDraft.version}
                      onChange={(event) =>
                        setWritingSopDraft((current) => ({
                          ...current,
                          version: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">来源文件</span>
                    <input
                      className="field__input"
                      value={writingSopDraft.sourceName}
                      placeholder="导入文件后自动填入，也可以手动填写"
                      onChange={(event) =>
                        setWritingSopDraft((current) => ({
                          ...current,
                          sourceName: event.target.value
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="content-sop-import">
                  <label className="content-file-drop">
                    <input
                      className="content-file-input"
                      type="file"
                      accept=".md,.markdown,.txt,text/markdown,text/plain"
                      onChange={handleImportSopFile}
                    />
                    <span>导入 Markdown 文件</span>
                    <span>支持 .md / .markdown / .txt。也可以不上载，直接在下方粘贴 SOP 内容。</span>
                  </label>
                </div>
                <label className="field">
                  <span className="field__label">Markdown SOP 内容</span>
                  <textarea
                    className="field__input content-markdown-textarea"
                    value={writingSopDraft.markdownContent}

                    onChange={(event) =>
                      setWritingSopDraft((current) => ({
                        ...current,
                        name: current.name || getMarkdownTitle(event.target.value) || "",
                        markdownContent: event.target.value
                      }))
                    }
                  />
                </label>
                <div className="content-modal__actions content-modal__actions--split">
                  {editingSopId ? (
                    <button
                      className="ghost-button ghost-button--danger"
                      type="button"
                      onClick={handleDeleteWritingSop}
                    >
                      删除 SOP
                    </button>
                  ) : (
                    <span />
                  )}
                  <div className="content-modal__action-group">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setIsSopDialogOpen(false)}
                    >
                      取消
                    </button>
                    <button className="primary-button" type="submit">
                      {editingSopId ? "保存并绑定" : "导入并绑定"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
