export type ContentProject = {
  id: string;
  name: string;
  summary: string;
  productProfile?: string;
  status: string;
  writingSopIds: string[];
  coverSopIds: string[];
};

export type ContentWritingSop = {
  id: string;
  name: string;
  version: string;
  description: string;
  mode: "science" | "list" | "comparison";
  sourceName?: string;
  markdownContent: string;
};

export type ContentCoverSop = {
  id: string;
  name: string;
};

export type ContentTaskInput = {
  goal: string;
  topic: string;
  referenceText: string;
};

export type ContentOutput = {
  titles: string[];
  body: string;
  tags: string[];
  stamp: string;
};

export type ContentHistoryItem = {
  id: string;
  label: string;
  meta: string;
  status: string;
  output?: ContentOutput;
};

export const contentProjects: ContentProject[] = [
  {
    id: "demo-product-a",
    name: "示例项目 A",
    summary: "用于演示内容系统结构的占位项目。",
    productProfile:
      "# 示例项目 A\n\n这里可以填写产品定位、内容边界、适合表达的场景和需要避免的承诺。",
    status: "已启用",
    writingSopIds: ["science-v10", "list-v10", "comparison-v10"],
    coverSopIds: ["a3-pocket", "b2-observer"]
  },
  {
    id: "demo-product-b",
    name: "示例项目 B",
    summary: "用于演示多项目切换和 SOP 过滤。",
    productProfile:
      "# 示例项目 B\n\n这里可以沉淀另一个项目的产品信息、素材边界和表达策略。",
    status: "资料齐备",
    writingSopIds: ["science-v10", "list-v10"],
    coverSopIds: ["b2-observer", "b3-breeder"]
  },
  {
    id: "demo-product-c",
    name: "示例项目 C",
    summary: "后续可接入新的写作 SOP。",
    productProfile: "# 示例项目 C\n\n后续可补充公开示例信息，并绑定演示 SOP。",
    status: "待补充",
    writingSopIds: ["comparison-v10"],
    coverSopIds: ["a3-pocket", "b3-breeder"]
  }
];

export const contentWritingSops: ContentWritingSop[] = [
  {
    id: "science-v10",
    name: "知识科普型",
    version: "V1.0",
    description: "用于演示结构化科普笔记的占位 SOP。",
    mode: "science",
    sourceName: "demo-science-sop.md",
    markdownContent:
      "# 知识科普型 SOP\n\n用于演示写作流程。正式 SOP 请在本地内容系统里导入，不建议提交到代码仓库。"
  },
  {
    id: "list-v10",
    name: "清单盘点型",
    version: "V1.0",
    description: "用于演示清单型内容的占位 SOP。",
    mode: "list",
    sourceName: "demo-list-sop.md",
    markdownContent:
      "# 清单盘点型 SOP\n\n用于演示写作流程。正式 SOP 请在本地内容系统里导入，不建议提交到代码仓库。"
  },
  {
    id: "comparison-v10",
    name: "体验对比型",
    version: "V1.0",
    description: "用于演示对比型内容的占位 SOP。",
    mode: "comparison",
    sourceName: "demo-comparison-sop.md",
    markdownContent:
      "# 体验对比型 SOP\n\n用于演示写作流程。正式 SOP 请在本地内容系统里导入，不建议提交到代码仓库。"
  }
];

export const contentCoverSops: ContentCoverSop[] = [
  { id: "a3-pocket", name: "A3" },
  { id: "b2-observer", name: "B2" },
  { id: "b3-breeder", name: "B3" }
];

export const defaultContentTaskInput: ContentTaskInput = {
  goal: "",
  topic: "",
  referenceText: ""
};

export const contentHistorySeed: ContentHistoryItem[] = [];
