import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  contentProjects,
  contentWritingSops,
  defaultContentTaskInput,
  type ContentHistoryItem,
  type ContentOutput,
  type ContentProject,
  type ContentTaskInput,
  type ContentWritingSop
} from "./content-studio-seed.public";
import { getLifeOsDataPath } from "./life-os-data-paths";

export type ContentStudioStore = {
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
  updatedAt: string;
};

const CONTENT_STUDIO_FILE_NAME = "content-studio.json";

export function getContentStudioStorePath() {
  return getLifeOsDataPath(CONTENT_STUDIO_FILE_NAME);
}

async function ensureContentStudioDirectory() {
  await mkdir(dirname(getContentStudioStorePath()), { recursive: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isContentProjectList(value: unknown): value is ContentProject[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.summary === "string" &&
        typeof item.status === "string" &&
        isStringList(item.writingSopIds) &&
        isStringList(item.coverSopIds)
    )
  );
}

function isContentWritingSopList(value: unknown): value is ContentWritingSop[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.version === "string" &&
        typeof item.description === "string" &&
        typeof item.markdownContent === "string"
    )
  );
}

function normalizeTaskInput(value: unknown): ContentTaskInput {
  if (!isRecord(value)) {
    return defaultContentTaskInput;
  }

  return {
    goal:
      typeof value.goal === "string" ? value.goal : defaultContentTaskInput.goal,
    topic:
      typeof value.topic === "string" ? value.topic : defaultContentTaskInput.topic,
    referenceText:
      typeof value.referenceText === "string"
        ? value.referenceText
        : defaultContentTaskInput.referenceText
  };
}

function normalizeOutput(value: unknown): ContentOutput {
  if (!isRecord(value)) {
    return {
      titles: [],
      body: "",
      tags: [],
      stamp: ""
    };
  }

  return {
    titles: isStringList(value.titles) ? value.titles : [],
    body: typeof value.body === "string" ? value.body : "",
    tags: isStringList(value.tags) ? value.tags : [],
    stamp: typeof value.stamp === "string" ? value.stamp : ""
  };
}

function normalizeHistory(value: unknown): ContentHistoryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : `history-${Date.now()}`,
      label: typeof item.label === "string" ? item.label : "内容记录",
      meta: typeof item.meta === "string" ? item.meta : "",
      status: typeof item.status === "string" ? item.status : "待复看",
      output: item.output ? normalizeOutput(item.output) : undefined
    }));
}

function normalizeIndex(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeGenerationCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function normalizeContentStudioStore(value: unknown): ContentStudioStore | null {
  if (!isRecord(value)) {
    return null;
  }

  const projects = isContentProjectList(value.projects)
    ? value.projects
    : contentProjects;
  const writingSops = isContentWritingSopList(value.writingSops)
    ? value.writingSops
    : contentWritingSops;
  const selectedProjectId =
    typeof value.selectedProjectId === "string" &&
    projects.some((project) => project.id === value.selectedProjectId)
      ? value.selectedProjectId
      : projects[0]?.id ?? "";
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const availableSopIds = new Set(selectedProject?.writingSopIds ?? []);
  const selectedWritingSopId =
    typeof value.selectedWritingSopId === "string" &&
    writingSops.some((sop) => sop.id === value.selectedWritingSopId && availableSopIds.has(sop.id))
      ? value.selectedWritingSopId
      : writingSops.find((sop) => availableSopIds.has(sop.id))?.id ?? "";

  return {
    projects,
    writingSops,
    selectedProjectId,
    selectedWritingSopId,
    selectedCoverSopId:
      typeof value.selectedCoverSopId === "string" ? value.selectedCoverSopId : "",
    contentAiApiKeyId:
      typeof value.contentAiApiKeyId === "string" ? value.contentAiApiKeyId : undefined,
    contentAiModel:
      typeof value.contentAiModel === "string" ? value.contentAiModel : undefined,
    taskInput: normalizeTaskInput(value.taskInput),
    output: normalizeOutput(value.output),
    history: normalizeHistory(value.history),
    activeTitleIndex: normalizeIndex(value.activeTitleIndex),
    generationCount: normalizeGenerationCount(value.generationCount),
    updatedAt:
      typeof value.updatedAt === "string" && value.updatedAt.trim()
        ? value.updatedAt
        : new Date().toISOString()
  };
}

export async function readContentStudioStore(): Promise<{
  store: ContentStudioStore | null;
  source: "file" | "empty";
}> {
  try {
    const raw = await readFile(getContentStudioStorePath(), "utf8");
    const parsed = JSON.parse(raw);
    const store = normalizeContentStudioStore(parsed);

    return {
      store,
      source: store ? "file" : "empty"
    };
  } catch {
    return {
      store: null,
      source: "empty"
    };
  }
}

export async function writeContentStudioStore(store: ContentStudioStore) {
  await ensureContentStudioDirectory();
  await writeFile(
    getContentStudioStorePath(),
    `${JSON.stringify(
      {
        ...store,
        updatedAt: new Date().toISOString()
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}
