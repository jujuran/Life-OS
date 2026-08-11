"use client";

/* eslint-disable @next/next/no-img-element */

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";

type ToolCategory = "全部" | "常用" | "本地" | "站内" | "图片" | "文字" | "时间" | "计算" | "文件" | "生活";

type ToolStatus = "本地" | "站内" | "计划中";

type ToolDefinition = {
  id: string;
  name: string;
  subtitle: string;
  category: Exclude<ToolCategory, "全部" | "本地" | "站内">;
  status: ToolStatus;
  url?: string;
  isCustom?: boolean;
};

const categories: ToolCategory[] = ["全部", "常用", "本地", "站内", "图片", "文字", "时间", "计算", "文件", "生活"];

const pinnedToolIds = ["pomodoro", "crop-image", "word-counter", "qr-code"];

const toolManageCategories: ToolDefinition["category"][] = ["图片", "文字", "时间", "计算", "文件", "生活"];

type ToolSettings = {
  customTools: ToolDefinition[];
  hiddenToolIds: string[];
  toolOrder: string[];
};

const defaultToolSettings: ToolSettings = {
  customTools: [],
  hiddenToolIds: [],
  toolOrder: []
};

const toolSettingsStorageKey = "life-os.tools.settings.v1";

const tools: ToolDefinition[] = [
  {
    id: "pomodoro",
    name: "番茄钟",
    subtitle: "专注计时与当前任务",
    category: "时间",
    status: "本地"
  },
  {
    id: "crop-image",
    name: "切图工具",
    subtitle: "九宫格、四宫格与六宫格切图",
    category: "图片",
    status: "本地"
  },
  {
    id: "word-counter",
    name: "字数统计",
    subtitle: "字数、段落、标题长度",
    category: "文字",
    status: "本地"
  },
  {
    id: "qr-code",
    name: "二维码",
    subtitle: "文本与链接二维码",
    category: "生活",
    status: "本地"
  },
  {
    id: "image-compress",
    name: "图片压缩",
    subtitle: "外部工具站内打开",
    category: "图片",
    status: "站内",
    url: "https://squoosh.app/"
  },
  {
    id: "image-format",
    name: "图片转格式",
    subtitle: "JPG / PNG / WebP",
    category: "图片",
    status: "本地"
  },
  {
    id: "cover-check",
    name: "小红书封面检查",
    subtitle: "比例、尺寸、标题安全区",
    category: "图片",
    status: "本地"
  },
  {
    id: "image-border",
    name: "图片加白边",
    subtitle: "给图片留出呼吸边距",
    category: "图片",
    status: "本地"
  },
  {
    id: "image-watermark",
    name: "图片加水印",
    subtitle: "文字水印与平铺水印",
    category: "图片",
    status: "本地"
  },
  {
    id: "text-dedupe",
    name: "文本去重",
    subtitle: "重复行清理与排序",
    category: "文字",
    status: "本地"
  },
  {
    id: "markdown-cleaner",
    name: "Markdown 清理",
    subtitle: "清空行、修段落、去噪音",
    category: "文字",
    status: "本地"
  },
  {
    id: "json-format",
    name: "JSON 格式化",
    subtitle: "格式化与基础校验",
    category: "文件",
    status: "本地"
  },
  {
    id: "csv-table",
    name: "CSV 转表格",
    subtitle: "转 Markdown 表格",
    category: "文件",
    status: "本地"
  },
  {
    id: "date-diff",
    name: "日期间隔",
    subtitle: "两个日期相差几天",
    category: "时间",
    status: "本地"
  },
  {
    id: "countdown",
    name: "倒计时",
    subtitle: "重要节点提醒",
    category: "时间",
    status: "本地"
  },
  {
    id: "world-time",
    name: "世界时间",
    subtitle: "常用城市当前时区",
    category: "时间",
    status: "本地"
  },
  {
    id: "percentage",
    name: "百分比计算",
    subtitle: "增长率、折扣、占比",
    category: "计算",
    status: "本地"
  },
  {
    id: "compound-interest",
    name: "复利计算",
    subtitle: "长期收益粗算",
    category: "计算",
    status: "本地"
  },
  {
    id: "random-picker",
    name: "随机选择器",
    subtitle: "按总数快速抽取序号",
    category: "生活",
    status: "本地"
  },
  {
    id: "scratch-note",
    name: "临时便签",
    subtitle: "随手写，不进长期系统",
    category: "生活",
    status: "本地"
  },
  {
    id: "checklist",
    name: "清单生成器",
    subtitle: "旅行、采购、准备事项",
    category: "生活",
    status: "本地"
  },
  {
    id: "filename-cleaner",
    name: "文件名整理",
    subtitle: "批量命名规则预处理",
    category: "文件",
    status: "本地"
  },
  {
    id: "color-tool",
    name: "颜色工具",
    subtitle: "取色与色值转换",
    category: "图片",
    status: "站内",
    url: "https://www.w3schools.com/colors/colors_picker.asp"
  },
  {
    id: "pdf-tool",
    name: "PDF 工具",
    subtitle: "合并、压缩、转换入口",
    category: "文件",
    status: "站内",
    url: "https://www.ilovepdf.com/"
  }
];

type TimerPhase = "focus" | "break";

type TimerPreset = {
  label: string;
  focusSeconds: number;
  breakSeconds: number;
};

type SplitModeId = "grid-3x3" | "grid-2x2" | "grid-3x2" | "grid-2x3" | "custom";

type ImageSplitMode = {
  id: SplitModeId;
  label: string;
  columns: number;
  rows: number;
  note: string;
};

type ImageSplitPiece = {
  id: string;
  label: string;
  url: string;
  width: number;
  height: number;
};

type ImageOutputFormat = "image/png" | "image/jpeg" | "image/webp";

type ImageDimensions = {
  width: number;
  height: number;
};

type WatermarkPosition = "bottom-right" | "bottom-left" | "top-right" | "center" | "tile";

type WorldClockCity = {
  name: string;
  region: string;
  timeZone: string;
};

type QrVersionSpec = {
  version: number;
  size: number;
  dataCodewords: number;
  eccCodewords: number;
};

type QrMatrix = boolean[][];

const timerPresets: TimerPreset[] = [
  { label: "25/5", focusSeconds: 25 * 60, breakSeconds: 5 * 60 },
  { label: "50/10", focusSeconds: 50 * 60, breakSeconds: 10 * 60 },
  { label: "自定义", focusSeconds: 15 * 60, breakSeconds: 5 * 60 }
];

const imageSplitModes: ImageSplitMode[] = [
  { id: "grid-3x3", label: "9 宫格", columns: 3, rows: 3, note: "适合朋友圈、小红书连续图" },
  { id: "grid-2x2", label: "4 宫格", columns: 2, rows: 2, note: "适合方图拆分" },
  { id: "grid-3x2", label: "6 宫格 横版", columns: 3, rows: 2, note: "三列两行" },
  { id: "grid-2x3", label: "6 宫格 竖版", columns: 2, rows: 3, note: "两列三行" },
  { id: "custom", label: "自定义", columns: 3, rows: 3, note: "自定义列数和行数" }
];

const imageOutputFormats: Array<{ label: string; value: ImageOutputFormat; extension: string }> = [
  { label: "PNG", value: "image/png", extension: "png" },
  { label: "JPG", value: "image/jpeg", extension: "jpg" },
  { label: "WebP", value: "image/webp", extension: "webp" }
];

const watermarkPositions: Array<{ label: string; value: WatermarkPosition }> = [
  { label: "右下", value: "bottom-right" },
  { label: "左下", value: "bottom-left" },
  { label: "右上", value: "top-right" },
  { label: "居中", value: "center" },
  { label: "平铺", value: "tile" }
];

const worldClockCities: WorldClockCity[] = [
  { name: "北京", region: "中国", timeZone: "Asia/Shanghai" },
  { name: "东京", region: "日本", timeZone: "Asia/Tokyo" },
  { name: "新加坡", region: "新加坡", timeZone: "Asia/Singapore" },
  { name: "悉尼", region: "澳大利亚", timeZone: "Australia/Sydney" },
  { name: "迪拜", region: "阿联酋", timeZone: "Asia/Dubai" },
  { name: "伦敦", region: "英国", timeZone: "Europe/London" },
  { name: "巴黎", region: "法国", timeZone: "Europe/Paris" },
  { name: "纽约", region: "美国东部", timeZone: "America/New_York" },
  { name: "洛杉矶", region: "美国西部", timeZone: "America/Los_Angeles" },
  { name: "温哥华", region: "加拿大", timeZone: "America/Vancouver" }
];

const qrVersionSpecs: QrVersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 19, eccCodewords: 7 },
  { version: 2, size: 25, dataCodewords: 34, eccCodewords: 10 },
  { version: 3, size: 29, dataCodewords: 55, eccCodewords: 15 },
  { version: 4, size: 33, dataCodewords: 80, eccCodewords: 20 },
  { version: 5, size: 37, dataCodewords: 108, eccCodewords: 26 }
];

function readToolSettings(): ToolSettings {
  if (typeof window === "undefined") {
    return defaultToolSettings;
  }

  try {
    const rawSettings = window.localStorage.getItem(toolSettingsStorageKey);

    if (!rawSettings) {
      return defaultToolSettings;
    }

    const parsed = JSON.parse(rawSettings) as Partial<ToolSettings>;

    return {
      customTools: Array.isArray(parsed.customTools)
        ? parsed.customTools.filter((tool): tool is ToolDefinition => {
            return Boolean(tool?.id && tool.name && tool.url);
          })
        : [],
      hiddenToolIds: Array.isArray(parsed.hiddenToolIds) ? parsed.hiddenToolIds.filter(Boolean) : [],
      toolOrder: Array.isArray(parsed.toolOrder) ? parsed.toolOrder.filter(Boolean) : []
    };
  } catch {
    return defaultToolSettings;
  }
}

function writeToolSettings(settings: ToolSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(toolSettingsStorageKey, JSON.stringify(settings));
}

function getToolById(toolId: string, availableTools: ToolDefinition[]) {
  return availableTools.find((tool) => tool.id === toolId) ?? availableTools[0] ?? tools[0];
}

function orderTools(availableTools: ToolDefinition[], toolOrder: string[]) {
  const orderedIds = [
    ...toolOrder.filter((toolId) => availableTools.some((tool) => tool.id === toolId)),
    ...availableTools.map((tool) => tool.id).filter((toolId) => !toolOrder.includes(toolId))
  ];

  return orderedIds
    .map((toolId) => availableTools.find((tool) => tool.id === toolId))
    .filter((tool): tool is ToolDefinition => Boolean(tool));
}

function normalizeUrl(url: string) {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return "";
  }

  return /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
}

function getImageFormatExtension(format: ImageOutputFormat) {
  return imageOutputFormats.find((item) => item.value === format)?.extension ?? "png";
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");

  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }

    cell += char;
  }

  cells.push(cell.trim());
  return cells;
}

function csvToMarkdownTable(csv: string) {
  const rows = csv
    .trim()
    .split(/\r?\n/)
    .map(splitCsvLine)
    .filter((row) => row.some(Boolean));

  if (!rows.length) {
    return "";
  }

  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => {
    return Array.from({ length: columnCount }, (_, index) => row[index] ?? "");
  });
  const [header, ...body] = normalizedRows;
  const escapeCell = (cell: string) => cell.replace(/\|/g, "\\|");

  return [
    `| ${header.map(escapeCell).join(" | ")} |`,
    `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.map(escapeCell).join(" | ")} |`)
  ].join("\n");
}

function cleanFileName(name: string) {
  const trimmed = name.trim();
  const extensionMatch = trimmed.match(/(\.[A-Za-z0-9]{1,8})$/);
  const extension = extensionMatch?.[1] ?? "";
  const baseName = (extension ? trimmed.slice(0, -extension.length) : trimmed)
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${baseName || "untitled"}${extension.toLowerCase()}`;
}

function makeChecklist(topic: string) {
  const title = topic.trim() || "待办事项";
  const baseItems = [
    "确认目标和完成标准",
    "列出需要准备的材料",
    "检查时间、地点或截止日期",
    "提前处理可能卡住的步骤",
    "完成后复盘并归档"
  ];

  return [`# ${title}清单`, "", ...baseItems.map((item) => `- [ ] ${item}`)].join("\n");
}

function formatCountdownDuration(targetDate: string, now: number) {
  if (!targetDate) {
    return { label: "未设置", detail: "选择一个目标时间。" };
  }

  const target = new Date(targetDate).getTime();
  const diff = target - now;
  const absDiff = Math.abs(diff);
  const days = Math.floor(absDiff / 86400000);
  const hours = Math.floor((absDiff % 86400000) / 3600000);
  const minutes = Math.floor((absDiff % 3600000) / 60000);
  const seconds = Math.floor((absDiff % 60000) / 1000);
  const label = `${days} 天 ${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  return {
    label,
    detail: diff >= 0 ? "距离目标时间还有" : "目标时间已经过去"
  };
}

function getTimeZoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(partMap.year),
    month: Number(partMap.month),
    day: Number(partMap.day),
    hour: Number(partMap.hour),
    minute: Number(partMap.minute),
    second: Number(partMap.second)
  };
}

function formatDateTimeInputValue(date: Date, timeZone: string) {
  const parts = getTimeZoneParts(date, timeZone);

  return `${parts.year.toString().padStart(4, "0")}-${parts.month
    .toString()
    .padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}T${parts.hour
    .toString()
    .padStart(2, "0")}:${parts.minute.toString().padStart(2, "0")}`;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getTimeZoneParts(date, timeZone);
  const utcLikeTime = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

  return utcLikeTime - date.getTime();
}

function zonedInputToDate(input: string, timeZone: string) {
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

  if (!match) {
    return new Date();
  }

  const [, year, month, day, hour, minute] = match;
  const utcGuess = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0);
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const firstInstant = utcGuess - firstOffset;
  const finalOffset = getTimeZoneOffsetMs(new Date(firstInstant), timeZone);

  return new Date(utcGuess - finalOffset);
}

function formatWorldClock(date: Date, timeZone: string) {
  const time = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23"
  }).format(date);
  const dateLabel = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).format(date);

  return { time, dateLabel };
}

function getWorldDayDeltaLabel(date: Date, sourceTimeZone: string, targetTimeZone: string) {
  const source = getTimeZoneParts(date, sourceTimeZone);
  const target = getTimeZoneParts(date, targetTimeZone);
  const sourceDay = Date.UTC(source.year, source.month - 1, source.day);
  const targetDay = Date.UTC(target.year, target.month - 1, target.day);
  const delta = Math.round((targetDay - sourceDay) / 86400000);

  if (delta > 0) return `+${delta} 天`;
  if (delta < 0) return `${delta} 天`;
  return "同日";
}

function getCoverAdvice(dimensions: ImageDimensions | null) {
  if (!dimensions) {
    return {
      ratio: "-",
      advice: "上传图片后会检查比例和尺寸。",
      status: "等待"
    };
  }

  const ratio = dimensions.width / dimensions.height;
  const ratioText = `${dimensions.width} × ${dimensions.height} / ${ratio.toFixed(3)}`;
  const targets = [
    { label: "3:4 竖版封面", ratio: 3 / 4 },
    { label: "4:5 竖版内容图", ratio: 4 / 5 },
    { label: "1:1 方图", ratio: 1 }
  ];
  const closest = targets.reduce((best, item) => {
    return Math.abs(item.ratio - ratio) < Math.abs(best.ratio - ratio) ? item : best;
  }, targets[0]);
  const isClose = Math.abs(closest.ratio - ratio) < 0.025;
  const isLargeEnough = dimensions.width >= 1080 || dimensions.height >= 1080;

  return {
    ratio: ratioText,
    advice: `${isClose ? "比例接近" : "比例不太接近"} ${closest.label}；${
      isLargeEnough ? "尺寸够用" : "建议长边至少 1080px"
    }。`,
    status: isClose && isLargeEnough ? "适合" : "需调整"
  };
}

function gfMultiply(left: number, right: number) {
  let product = 0;
  let a = left;
  let b = right;

  while (b > 0) {
    if ((b & 1) !== 0) {
      product ^= a;
    }

    a <<= 1;

    if ((a & 0x100) !== 0) {
      a ^= 0x11d;
    }

    b >>= 1;
  }

  return product;
}

function gfPow(power: number) {
  let value = 1;

  for (let index = 0; index < power; index += 1) {
    value = gfMultiply(value, 2);
  }

  return value;
}

function makeRsGenerator(degree: number) {
  let result = [1];

  for (let degreeIndex = 0; degreeIndex < degree; degreeIndex += 1) {
    const next = new Array(result.length + 1).fill(0);

    result.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= gfMultiply(coefficient, gfPow(degreeIndex));
    });
    result = next;
  }

  return result.slice(1);
}

function makeRsRemainder(data: number[], degree: number) {
  const generator = makeRsGenerator(degree);
  const result = new Array(degree).fill(0);

  data.forEach((byte) => {
    const factor = byte ^ result.shift();
    result.push(0);
    generator.forEach((coefficient, index) => {
      result[index] ^= gfMultiply(coefficient, factor);
    });
  });

  return result;
}

function appendBits(bits: number[], value: number, length: number) {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >>> index) & 1);
  }
}

function getFormatBits(mask: number) {
  const errorCorrectionLevel = 1; // L
  const data = (errorCorrectionLevel << 3) | mask;
  let remainder = data << 10;

  for (let index = 14; index >= 10; index -= 1) {
    if (((remainder >>> index) & 1) !== 0) {
      remainder ^= 0x537 << (index - 10);
    }
  }

  return ((data << 10) | remainder) ^ 0x5412;
}

function generateQrMatrix(text: string) {
  const bytes = Array.from(new TextEncoder().encode(text));
  const spec = qrVersionSpecs.find((item) => bytes.length + 2 <= item.dataCodewords);

  if (!spec) {
    throw new Error("内容太长，当前二维码工具建议控制在 100 个字符以内。");
  }

  const qrSpec = spec;
  const dataBits: number[] = [];

  appendBits(dataBits, 0b0100, 4);
  appendBits(dataBits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(dataBits, byte, 8));
  appendBits(dataBits, 0, Math.min(4, qrSpec.dataCodewords * 8 - dataBits.length));

  while (dataBits.length % 8 !== 0) {
    dataBits.push(0);
  }

  const dataCodewords: number[] = [];

  for (let index = 0; index < dataBits.length; index += 8) {
    dataCodewords.push(Number.parseInt(dataBits.slice(index, index + 8).join(""), 2));
  }

  for (let padIndex = 0; dataCodewords.length < qrSpec.dataCodewords; padIndex += 1) {
    dataCodewords.push(padIndex % 2 === 0 ? 0xec : 0x11);
  }

  const allCodewords = [...dataCodewords, ...makeRsRemainder(dataCodewords, qrSpec.eccCodewords)];
  const bits = allCodewords.flatMap((byte) => {
    return Array.from({ length: 8 }, (_, index) => (byte >>> (7 - index)) & 1);
  });
  const matrix: Array<Array<boolean | null>> = Array.from({ length: qrSpec.size }, () =>
    Array.from({ length: qrSpec.size }, () => null)
  );
  const reserved: boolean[][] = Array.from({ length: qrSpec.size }, () =>
    Array.from({ length: qrSpec.size }, () => false)
  );

  function setModule(x: number, y: number, value: boolean, reserve = true) {
    if (x < 0 || y < 0 || x >= qrSpec.size || y >= qrSpec.size) {
      return;
    }

    matrix[y][x] = value;
    reserved[y][x] = reserve;
  }

  function drawFinder(left: number, top: number) {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        const xx = left + x;
        const yy = top + y;
        const isFinder =
          x >= 0 &&
          x <= 6 &&
          y >= 0 &&
          y <= 6 &&
          (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));

        setModule(xx, yy, isFinder);
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(qrSpec.size - 7, 0);
  drawFinder(0, qrSpec.size - 7);

  for (let index = 8; index < qrSpec.size - 8; index += 1) {
    setModule(index, 6, index % 2 === 0);
    setModule(6, index, index % 2 === 0);
  }

  if (qrSpec.version > 1) {
    const center = qrSpec.size - 7;

    for (let y = -2; y <= 2; y += 1) {
      for (let x = -2; x <= 2; x += 1) {
        const ring = Math.max(Math.abs(x), Math.abs(y));
        setModule(center + x, center + y, ring === 2 || ring === 0);
      }
    }
  }

  for (let index = 0; index <= 8; index += 1) {
    setModule(8, index, false);
    setModule(index, 8, false);
  }

  for (let index = 0; index < 8; index += 1) {
    setModule(qrSpec.size - 1 - index, 8, false);
    setModule(8, qrSpec.size - 1 - index, false);
  }

  setModule(8, qrSpec.size - 8, true);

  let bitIndex = 0;
  let upward = true;

  for (let right = qrSpec.size - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right -= 1;
    }

    for (let vertical = 0; vertical < qrSpec.size; vertical += 1) {
      const y = upward ? qrSpec.size - 1 - vertical : vertical;

      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;

        if (reserved[y][x]) {
          continue;
        }

        const bit = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
        const masked = bit !== ((x + y) % 2 === 0);

        matrix[y][x] = masked;
        bitIndex += 1;
      }
    }

    upward = !upward;
  }

  const formatBits = getFormatBits(0);
  const getBit = (index: number) => ((formatBits >>> index) & 1) !== 0;

  for (let index = 0; index <= 5; index += 1) setModule(8, index, getBit(index));
  setModule(8, 7, getBit(6));
  setModule(8, 8, getBit(7));
  setModule(7, 8, getBit(8));
  for (let index = 9; index < 15; index += 1) setModule(14 - index, 8, getBit(index));
  for (let index = 0; index < 8; index += 1) setModule(qrSpec.size - 1 - index, 8, getBit(index));
  for (let index = 8; index < 15; index += 1) setModule(8, qrSpec.size - 15 + index, getBit(index));
  setModule(8, qrSpec.size - 8, true);

  return matrix.map((row) => row.map(Boolean));
}

function qrMatrixToSvg(matrix: QrMatrix) {
  const quietZone = 4;
  const size = matrix.length + quietZone * 2;
  const rects = matrix
    .flatMap((row, y) => {
      return row
        .map((isDark, x) => {
          return isDark ? `<rect x="${x + quietZone}" y="${y + quietZone}" width="1" height="1"/>` : "";
        })
        .filter(Boolean);
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#111">${rects}</g></svg>`;
}

function getImageSplitMode(modeId: SplitModeId) {
  return imageSplitModes.find((mode) => mode.id === modeId) ?? imageSplitModes[0];
}

function clampSplitDimension(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(12, Math.max(1, Math.round(value)));
}

function getEffectiveImageSplitMode(modeId: SplitModeId, columns: number, rows: number) {
  const mode = getImageSplitMode(modeId);

  if (mode.id !== "custom") {
    return mode;
  }

  const safeColumns = clampSplitDimension(columns);
  const safeRows = clampSplitDimension(rows);

  return {
    ...mode,
    label: `${safeColumns} × ${safeRows}`,
    columns: safeColumns,
    rows: safeRows,
    note: `自定义切成 ${safeColumns * safeRows} 张`
  };
}

function getFileBaseName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .trim() || "split-image";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("图片读取失败。"));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败。"));
    image.src = dataUrl;
  });
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");

  return `${minutes}:${remainingSeconds}`;
}

function formatTimerMinutes(seconds: number) {
  return `${Math.round(seconds / 60)} 分钟`;
}

function TimerFace({ seconds }: { seconds: number }) {
  const [minutes, remainingSeconds] = formatTimer(seconds).split(":");

  return (
    <div className="tool-pomodoro__clock" aria-label={formatTimer(seconds)}>
      <span className="tool-pomodoro__unit" aria-hidden="true">
        {minutes.split("").map((digit, index) => (
          <span key={`minute-${index}`} className="tool-pomodoro__digit">
            {digit}
          </span>
        ))}
      </span>
      <span className="tool-pomodoro__colon" aria-hidden="true">
        :
      </span>
      <span className="tool-pomodoro__unit" aria-hidden="true">
        {remainingSeconds.split("").map((digit, index) => (
          <span key={`second-${index}`} className="tool-pomodoro__digit">
            {digit}
          </span>
        ))}
      </span>
    </div>
  );
}

function getSegmentStroke(secondsLeft: number, totalSeconds: number) {
  const segmentCount = 5;
  const segmentDuration = totalSeconds / segmentCount;
  const elapsedSeconds = Math.max(0, totalSeconds - secondsLeft);
  const activeSegment = Math.min(segmentCount - 1, Math.floor(elapsedSeconds / segmentDuration));
  const currentSegmentElapsed = elapsedSeconds - activeSegment * segmentDuration;
  const activeProgress = Math.min(1, Math.max(0, currentSegmentElapsed / segmentDuration));

  return {
    activeSegment,
    activeProgress
  };
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
}

function describeArc(centerX: number, centerY: number, radius: number, progress: number) {
  const safeProgress = Math.min(0.9999, Math.max(0, progress));
  const start = polarToCartesian(centerX, centerY, radius, -90);
  const end = polarToCartesian(centerX, centerY, radius, -90 + safeProgress * 360);
  const largeArcFlag = safeProgress > 0.5 ? 1 : 0;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function countText(text: string) {
  const trimmed = text.trim();
  const cjkCount = (trimmed.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const wordCount = (trimmed.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)?/g) ?? []).length;
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter(Boolean).length : 0;
  const lines = trimmed ? trimmed.split(/\r?\n/).filter(Boolean).length : 0;

  return {
    words: cjkCount + wordCount,
    characters: trimmed.replace(/\s/g, "").length,
    paragraphs,
    lines
  };
}

function cleanMarkdown(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function dedupeLines(text: string) {
  const seen = new Set<string>();

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || seen.has(line)) {
        return false;
      }

      seen.add(line);
      return true;
    })
    .join("\n");
}

function getDateDiff(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return null;
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diff = end.getTime() - start.getTime();

  if (Number.isNaN(diff)) {
    return null;
  }

  return Math.round(diff / 86400000);
}

type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

function playTimerDoneSound() {
  const AudioContextConstructor =
    window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;

  if (!AudioContextConstructor) {
    return;
  }

  const audioContext = new AudioContextConstructor();
  const tones = [880, 660, 880];

  const play = () => {
    tones.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const startTime = audioContext.currentTime + index * 0.2;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startTime);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.5, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.2);
    });

    window.setTimeout(() => void audioContext.close(), 1100);
  };

  if (audioContext.state === "suspended") {
    void audioContext.resume().then(play).catch(() => void audioContext.close());
    return;
  }

  play();
}

function requestTimerNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

function showTimerNotification(task: string, phase: TimerPhase) {
  if (!("Notification" in window)) {
    return;
  }

  const title = phase === "focus" ? "专注结束，休息一下" : "休息结束，可以回来了";
  const body =
    phase === "focus"
      ? task.trim()
        ? `这轮专注已完成：${task.trim()}`
        : "这轮专注已经完成。"
      : "休息钟表已经结束，可以开始下一轮专注。";

  if (Notification.permission === "granted") {
    new Notification(title, { body });
    return;
  }

  if (Notification.permission === "default") {
    void Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification(title, { body });
      }
    });
  }
}

export function ToolDesk() {
  const [activeToolId, setActiveToolId] = useState("pomodoro");
  const [activeCategory, setActiveCategory] = useState<ToolCategory>("全部");
  const [search, setSearch] = useState("");
  const [toolSettings, setToolSettings] = useState<ToolSettings>(defaultToolSettings);
  const [hasLoadedToolSettings, setHasLoadedToolSettings] = useState(false);
  const [isToolManagerOpen, setIsToolManagerOpen] = useState(false);
  const [toolDraftName, setToolDraftName] = useState("");
  const [toolDraftUrl, setToolDraftUrl] = useState("");
  const [toolDraftSubtitle, setToolDraftSubtitle] = useState("");
  const [toolDraftCategory, setToolDraftCategory] = useState<ToolDefinition["category"]>("生活");
  const [toolManageMessage, setToolManageMessage] = useState("拖拽右侧工具卡片可以调整顺序。");
  const [draggedToolId, setDraggedToolId] = useState<string | null>(null);
  const [splitImageDataUrl, setSplitImageDataUrl] = useState("");
  const [splitImageName, setSplitImageName] = useState("");
  const [splitModeId, setSplitModeId] = useState<SplitModeId>("grid-3x3");
  const [customSplitColumns, setCustomSplitColumns] = useState(3);
  const [customSplitRows, setCustomSplitRows] = useState(3);
  const [splitPieces, setSplitPieces] = useState<ImageSplitPiece[]>([]);
  const [splitMessage, setSplitMessage] = useState("上传一张图片，选择切割方式。所有处理只在本地浏览器完成。");
  const [qrText, setQrText] = useState("https://");
  const [formatImageDataUrl, setFormatImageDataUrl] = useState("");
  const [formatImageName, setFormatImageName] = useState("");
  const [imageOutputFormat, setImageOutputFormat] = useState<ImageOutputFormat>("image/png");
  const [imageQuality, setImageQuality] = useState(0.92);
  const [convertedImageUrl, setConvertedImageUrl] = useState("");
  const [convertedImageMessage, setConvertedImageMessage] = useState("上传图片后选择目标格式。");
  const [coverImageDataUrl, setCoverImageDataUrl] = useState("");
  const [coverImageName, setCoverImageName] = useState("");
  const [coverDimensions, setCoverDimensions] = useState<ImageDimensions | null>(null);
  const [borderImageDataUrl, setBorderImageDataUrl] = useState("");
  const [borderImageName, setBorderImageName] = useState("");
  const [borderSize, setBorderSize] = useState(120);
  const [borderColor, setBorderColor] = useState("#ffffff");
  const [borderImageUrl, setBorderImageUrl] = useState("");
  const [watermarkImageDataUrl, setWatermarkImageDataUrl] = useState("");
  const [watermarkImageName, setWatermarkImageName] = useState("");
  const [watermarkText, setWatermarkText] = useState("Life OS");
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>("bottom-right");
  const [watermarkFontSize, setWatermarkFontSize] = useState(42);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.42);
  const [watermarkColor, setWatermarkColor] = useState("#ffffff");
  const [watermarkImageUrl, setWatermarkImageUrl] = useState("");
  const [csvValue, setCsvValue] = useState("标题,数值\n收入,12000\n支出,4500");
  const [countdownTitle, setCountdownTitle] = useState("下一个重要节点");
  const [countdownTarget, setCountdownTarget] = useState("2026-06-30T09:00");
  const [worldTimeSourceZone, setWorldTimeSourceZone] = useState("Asia/Shanghai");
  const [worldTimeInput, setWorldTimeInput] = useState(() => formatDateTimeInputValue(new Date(), "Asia/Shanghai"));
  const [now, setNow] = useState(Date.now());
  const [percentageBase, setPercentageBase] = useState("1000");
  const [percentageValue, setPercentageValue] = useState("250");
  const [compoundPrincipal, setCompoundPrincipal] = useState("10000");
  const [compoundMonthly, setCompoundMonthly] = useState("1000");
  const [compoundRate, setCompoundRate] = useState("6");
  const [compoundYears, setCompoundYears] = useState("10");
  const [checklistTopic, setChecklistTopic] = useState("出门前");
  const [checklistOutput, setChecklistOutput] = useState(makeChecklist("出门前"));
  const [filenameInput, setFilenameInput] = useState("我的 图片 01.JPG\n草稿:最终版?.png");
  const [timerTotalSeconds, setTimerTotalSeconds] = useState(25 * 60);
  const [breakTotalSeconds, setBreakTotalSeconds] = useState(5 * 60);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerEndAt, setTimerEndAt] = useState<number | null>(null);
  const [timerPhase, setTimerPhase] = useState<TimerPhase>("focus");
  const [timerNotice, setTimerNotice] = useState("专注结束后会自动进入休息钟表。");
  const [focusTask, setFocusTask] = useState("");
  const [textValue, setTextValue] = useState("");
  const [markdownValue, setMarkdownValue] = useState("");
  const [jsonValue, setJsonValue] = useState("");
  const [jsonMessage, setJsonMessage] = useState("等待输入 JSON。");
  const [randomTotal, setRandomTotal] = useState("50");
  const [randomResult, setRandomResult] = useState("--");
  const [noteValue, setNoteValue] = useState("");
  const [startDate, setStartDate] = useState("2026-05-30");
  const [endDate, setEndDate] = useState("2026-06-30");
  const completedTimerKeyRef = useRef<string | null>(null);
  const splitFileInputRef = useRef<HTMLInputElement | null>(null);
  const formatFileInputRef = useRef<HTMLInputElement | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const borderFileInputRef = useRef<HTMLInputElement | null>(null);
  const watermarkFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setToolSettings(readToolSettings());
      setHasLoadedToolSettings(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!hasLoadedToolSettings) {
      return;
    }

    writeToolSettings(toolSettings);
  }, [hasLoadedToolSettings, toolSettings]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!isTimerRunning || timerEndAt === null) {
      return;
    }

    const endAt = timerEndAt;
    const phaseAtStart = timerPhase;
    const completionKey = `${phaseAtStart}:${endAt}`;

    function syncTimerWithClock() {
      const nextSecondsLeft = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));

      setSecondsLeft(nextSecondsLeft);

      if (nextSecondsLeft > 0) {
        return;
      }

      if (completedTimerKeyRef.current === completionKey) {
        return;
      }

      completedTimerKeyRef.current = completionKey;
      playTimerDoneSound();
      showTimerNotification(focusTask, phaseAtStart);

      if (phaseAtStart === "focus") {
        setTimerNotice(`专注结束，已自动进入 ${formatTimerMinutes(breakTotalSeconds)} 休息。`);
        setTimerPhase("break");
        setSecondsLeft(breakTotalSeconds);
        setTimerEndAt(Date.now() + breakTotalSeconds * 1000);
        setIsTimerRunning(true);
        return;
      }

      setTimerNotice("休息结束，可以开始下一轮专注。");
      setTimerPhase("focus");
      setSecondsLeft(timerTotalSeconds);
      setIsTimerRunning(false);
      setTimerEndAt(null);
    }

    syncTimerWithClock();

    const intervalId = window.setInterval(() => {
      syncTimerWithClock();
    }, 1000);

    window.addEventListener("focus", syncTimerWithClock);
    document.addEventListener("visibilitychange", syncTimerWithClock);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncTimerWithClock);
      document.removeEventListener("visibilitychange", syncTimerWithClock);
    };
  }, [breakTotalSeconds, focusTask, isTimerRunning, timerEndAt, timerPhase, timerTotalSeconds]);

  const visibleTools = [...tools, ...toolSettings.customTools].filter(
    (tool) => !toolSettings.hiddenToolIds.includes(tool.id)
  );
  const orderedTools = orderTools(visibleTools, toolSettings.toolOrder);
  const activeTool = getToolById(activeToolId, orderedTools);
  const searchText = search.trim().toLowerCase();
  const filteredTools = orderedTools.filter((tool) => {
    const matchesCategory =
      activeCategory === "全部" ||
      (activeCategory === "常用" && pinnedToolIds.includes(tool.id)) ||
      tool.category === activeCategory ||
      tool.status === activeCategory;
    const matchesSearch =
      !searchText ||
      tool.name.toLowerCase().includes(searchText) ||
      tool.subtitle.toLowerCase().includes(searchText);

    return matchesCategory && matchesSearch;
  });
  const textStats = countText(textValue);
  const dateDiff = getDateDiff(startDate, endDate);
  const activeTimerTotalSeconds = timerPhase === "focus" ? timerTotalSeconds : breakTotalSeconds;
  const pomodoroStroke = getSegmentStroke(secondsLeft, activeTimerTotalSeconds);
  const recordRings = [142, 118, 94, 70, 46];
  const activeRingRadius = recordRings[pomodoroStroke.activeSegment] ?? recordRings[0];
  const activeRingAngle = pomodoroStroke.activeProgress * Math.PI * 2;
  const activeRingEndX = 180 + activeRingRadius * Math.sin(activeRingAngle);
  const activeRingEndY = 180 - activeRingRadius * Math.cos(activeRingAngle);
  const activeRingPath = describeArc(180, 180, activeRingRadius, pomodoroStroke.activeProgress);
  const timerPhaseLabel = timerPhase === "focus" ? "专注钟表" : "休息走动";
  const timerPhaseMeta =
    timerPhase === "focus"
      ? `结束后休息 ${formatTimerMinutes(breakTotalSeconds)}`
      : `休息 ${formatTimerMinutes(breakTotalSeconds)}，走动一下`;
  const splitMode = getEffectiveImageSplitMode(splitModeId, customSplitColumns, customSplitRows);
  let qrMatrix: QrMatrix | null = null;
  let qrError = "";

  try {
    qrMatrix = qrText.trim() ? generateQrMatrix(qrText.trim()) : null;
  } catch (error) {
    qrError = error instanceof Error ? error.message : "二维码生成失败。";
  }

  const coverAdvice = getCoverAdvice(coverDimensions);
  const markdownTable = csvToMarkdownTable(csvValue);
  const cleanedFileNames = filenameInput
    .split(/\r?\n/)
    .map(cleanFileName)
    .join("\n");
  const countdownInfo = formatCountdownDuration(countdownTarget, now);
  const worldNow = new Date(now);
  const worldConversionDate = zonedInputToDate(worldTimeInput, worldTimeSourceZone);
  const worldSourceCity = worldClockCities.find((city) => city.timeZone === worldTimeSourceZone) ?? worldClockCities[0];
  const baseNumber = Number(percentageBase);
  const valueNumber = Number(percentageValue);
  const percentageRatio = baseNumber ? (valueNumber / baseNumber) * 100 : 0;
  const percentageIncrease = baseNumber ? ((valueNumber - baseNumber) / baseNumber) * 100 : 0;
  const discountPrice = baseNumber * (valueNumber / 100);
  const principal = Number(compoundPrincipal) || 0;
  const monthlyContribution = Number(compoundMonthly) || 0;
  const annualRate = (Number(compoundRate) || 0) / 100;
  const years = Number(compoundYears) || 0;
  const months = Math.max(0, Math.round(years * 12));
  const monthlyRate = annualRate / 12;
  const compoundTotal = Array.from({ length: months }).reduce((total) => {
    return (Number(total) + monthlyContribution) * (1 + monthlyRate);
  }, principal);
  const compoundInvested = principal + monthlyContribution * months;
  const compoundGain = Number(compoundTotal) - compoundInvested;

  function resetTransientToolState(toolId: string) {
    if (toolId === "pomodoro") {
      setIsTimerRunning(false);
      setTimerEndAt(null);
      setTimerPhase("focus");
      setSecondsLeft(timerTotalSeconds);
      setFocusTask("");
      setTimerNotice("专注结束后会自动进入休息钟表。");
      completedTimerKeyRef.current = null;
      return;
    }

    if (toolId === "crop-image") {
      setSplitImageDataUrl("");
      setSplitImageName("");
      setSplitModeId("grid-3x3");
      setCustomSplitColumns(3);
      setCustomSplitRows(3);
      setSplitPieces([]);
      setSplitMessage("上传一张图片，选择切割方式。所有处理只在本地浏览器完成。");
      if (splitFileInputRef.current) splitFileInputRef.current.value = "";
      return;
    }

    if (toolId === "qr-code") {
      setQrText("https://");
      return;
    }

    if (toolId === "image-format") {
      setFormatImageDataUrl("");
      setFormatImageName("");
      setImageOutputFormat("image/png");
      setImageQuality(0.92);
      setConvertedImageUrl("");
      setConvertedImageMessage("上传图片后选择目标格式。");
      if (formatFileInputRef.current) formatFileInputRef.current.value = "";
      return;
    }

    if (toolId === "cover-check") {
      setCoverImageDataUrl("");
      setCoverImageName("");
      setCoverDimensions(null);
      if (coverFileInputRef.current) coverFileInputRef.current.value = "";
      return;
    }

    if (toolId === "image-border") {
      setBorderImageDataUrl("");
      setBorderImageName("");
      setBorderSize(120);
      setBorderColor("#ffffff");
      setBorderImageUrl("");
      if (borderFileInputRef.current) borderFileInputRef.current.value = "";
      return;
    }

    if (toolId === "image-watermark") {
      setWatermarkImageDataUrl("");
      setWatermarkImageName("");
      setWatermarkText("Life OS");
      setWatermarkPosition("bottom-right");
      setWatermarkFontSize(42);
      setWatermarkOpacity(0.42);
      setWatermarkColor("#ffffff");
      setWatermarkImageUrl("");
      if (watermarkFileInputRef.current) watermarkFileInputRef.current.value = "";
      return;
    }

    if (toolId === "word-counter") {
      setTextValue("");
      return;
    }

    if (toolId === "markdown-cleaner" || toolId === "text-dedupe") {
      setMarkdownValue("");
      return;
    }

    if (toolId === "json-format") {
      setJsonValue("");
      setJsonMessage("等待输入 JSON。");
      return;
    }

    if (toolId === "csv-table") {
      setCsvValue("标题,数值\n收入,12000\n支出,4500");
      return;
    }

    if (toolId === "countdown") {
      setCountdownTitle("下一个重要节点");
      setCountdownTarget("2026-06-30T09:00");
      return;
    }

    if (toolId === "world-time") {
      setWorldTimeSourceZone("Asia/Shanghai");
      setWorldTimeInput(formatDateTimeInputValue(new Date(), "Asia/Shanghai"));
      return;
    }

    if (toolId === "date-diff") {
      setStartDate("2026-05-30");
      setEndDate("2026-06-30");
      return;
    }

    if (toolId === "percentage") {
      setPercentageBase("1000");
      setPercentageValue("250");
      return;
    }

    if (toolId === "compound-interest") {
      setCompoundPrincipal("10000");
      setCompoundMonthly("1000");
      setCompoundRate("6");
      setCompoundYears("10");
      return;
    }

    if (toolId === "random-picker") {
      setRandomTotal("50");
      setRandomResult("--");
      return;
    }

    if (toolId === "scratch-note") {
      setNoteValue("");
      return;
    }

    if (toolId === "checklist") {
      setChecklistTopic("出门前");
      setChecklistOutput(makeChecklist("出门前"));
      return;
    }

    if (toolId === "filename-cleaner") {
      setFilenameInput("我的 图片 01.JPG\n草稿:最终版?.png");
    }
  }

  function selectTool(toolId: string) {
    if (toolId === activeTool.id) {
      return;
    }

    resetTransientToolState(activeTool.id);
    setActiveToolId(toolId);
  }

  function handleAddWebsiteTool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = toolDraftName.trim();
    const url = normalizeUrl(toolDraftUrl);

    if (!name || !url) {
      setToolManageMessage("先填工具名称和网站地址。");
      return;
    }

    const customTool: ToolDefinition = {
      id: `custom-${Date.now()}`,
      name,
      subtitle: toolDraftSubtitle.trim() || url.replace(/^https?:\/\//i, ""),
      category: toolDraftCategory,
      status: "站内",
      url,
      isCustom: true
    };

    setToolSettings((currentSettings) => ({
      ...currentSettings,
      customTools: [...currentSettings.customTools, customTool],
      toolOrder: [...currentSettings.toolOrder.filter((toolId) => toolId !== customTool.id), customTool.id]
    }));
    setActiveToolId(customTool.id);
    setToolDraftName("");
    setToolDraftUrl("");
    setToolDraftSubtitle("");
    setToolManageMessage(`已添加：${customTool.name}`);
  }

  function handleRemoveTool(toolId: string) {
    const customTool = toolSettings.customTools.find((tool) => tool.id === toolId);
    const fallbackToolId = orderedTools.find((tool) => tool.id !== toolId)?.id ?? "pomodoro";

    setToolSettings((currentSettings) => ({
      customTools: currentSettings.customTools.filter((tool) => tool.id !== toolId),
      hiddenToolIds: customTool
        ? currentSettings.hiddenToolIds.filter((hiddenToolId) => hiddenToolId !== toolId)
        : Array.from(new Set([...currentSettings.hiddenToolIds, toolId])),
      toolOrder: currentSettings.toolOrder.filter((orderedToolId) => orderedToolId !== toolId)
    }));

    if (activeTool.id === toolId) {
      setActiveToolId(fallbackToolId);
    }

    setToolManageMessage(customTool ? "已删除自定义工具。" : "已隐藏内置工具，可用“恢复内置工具”找回。");
  }

  function handleRestoreBuiltInTools() {
    setToolSettings((currentSettings) => ({
      ...currentSettings,
      hiddenToolIds: []
    }));
    setToolManageMessage("内置工具已恢复。");
  }

  function moveTool(dragToolId: string, targetToolId: string) {
    if (dragToolId === targetToolId) {
      return;
    }

    const orderedToolIds = orderedTools.map((tool) => tool.id);
    const nextOrder = orderedToolIds.filter((toolId) => toolId !== dragToolId);
    const targetIndex = nextOrder.indexOf(targetToolId);

    if (targetIndex < 0) {
      return;
    }

    nextOrder.splice(targetIndex, 0, dragToolId);
    setToolSettings((currentSettings) => ({
      ...currentSettings,
      toolOrder: nextOrder
    }));
    setToolManageMessage("工具顺序已更新。");
  }

  async function splitImage(
    dataUrl: string,
    imageName: string,
    modeId: SplitModeId,
    columns = customSplitColumns,
    rows = customSplitRows
  ) {
    const mode = getEffectiveImageSplitMode(modeId, columns, rows);

    try {
      setSplitMessage("正在切图...");

      const image = await loadImageFromDataUrl(dataUrl);
      const sourceWidth = image.naturalWidth;
      const sourceHeight = image.naturalHeight;
      const baseName = getFileBaseName(imageName);
      const nextPieces: ImageSplitPiece[] = [];

      for (let row = 0; row < mode.rows; row += 1) {
        for (let column = 0; column < mode.columns; column += 1) {
          const sourceX = Math.round((sourceWidth * column) / mode.columns);
          const sourceY = Math.round((sourceHeight * row) / mode.rows);
          const sourceEndX = Math.round((sourceWidth * (column + 1)) / mode.columns);
          const sourceEndY = Math.round((sourceHeight * (row + 1)) / mode.rows);
          const pieceWidth = sourceEndX - sourceX;
          const pieceHeight = sourceEndY - sourceY;
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          if (!context) {
            throw new Error("浏览器不支持 Canvas 切图。");
          }

          canvas.width = pieceWidth;
          canvas.height = pieceHeight;
          context.drawImage(image, sourceX, sourceY, pieceWidth, pieceHeight, 0, 0, pieceWidth, pieceHeight);

          nextPieces.push({
            id: `${row}-${column}`,
            label: `${baseName}-${row + 1}-${column + 1}.png`,
            url: canvas.toDataURL("image/png"),
            width: pieceWidth,
            height: pieceHeight
          });
        }
      }

      setSplitPieces(nextPieces);
      setSplitMessage(`已切成 ${nextPieces.length} 张。顺序为从左到右、从上到下。`);
    } catch (error) {
      setSplitPieces([]);
      setSplitMessage(error instanceof Error ? error.message : "切图失败，请换一张图片试试。");
    }
  }

  async function handleSplitImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setSplitMessage("请选择图片文件。");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);

      setSplitImageDataUrl(dataUrl);
      setSplitImageName(file.name);
      await splitImage(dataUrl, file.name, splitModeId);
    } catch {
      setSplitMessage("图片读取失败，请重新选择。");
    }
  }

  function handleSplitModeChange(nextModeId: SplitModeId) {
    setSplitModeId(nextModeId);

    if (splitImageDataUrl) {
      void splitImage(splitImageDataUrl, splitImageName, nextModeId);
    }
  }

  function handleCustomSplitDimensionChange(axis: "columns" | "rows", rawValue: string) {
    const nextValue = clampSplitDimension(Number(rawValue));
    const nextColumns = axis === "columns" ? nextValue : customSplitColumns;
    const nextRows = axis === "rows" ? nextValue : customSplitRows;

    if (axis === "columns") {
      setCustomSplitColumns(nextValue);
    } else {
      setCustomSplitRows(nextValue);
    }

    if (splitImageDataUrl && splitModeId === "custom") {
      void splitImage(splitImageDataUrl, splitImageName, "custom", nextColumns, nextRows);
    }
  }

  function downloadSplitPiece(piece: ImageSplitPiece) {
    const link = document.createElement("a");

    link.href = piece.url;
    link.download = piece.label;
    link.click();
  }

  function downloadAllSplitPieces() {
    splitPieces.forEach((piece, index) => {
      window.setTimeout(() => downloadSplitPiece(piece), index * 120);
    });
  }

  function downloadQrSvg() {
    if (!qrMatrix) {
      return;
    }

    const svg = qrMatrixToSvg(qrMatrix);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    downloadDataUrl(url, "qr-code.svg");
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function convertImage(dataUrl: string, imageName: string, format: ImageOutputFormat, quality = imageQuality) {
    try {
      const image = await loadImageFromDataUrl(dataUrl);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("浏览器不支持图片转换。");
      }

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      if (format === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      context.drawImage(image, 0, 0);
      setConvertedImageUrl(canvas.toDataURL(format, quality));
      setConvertedImageMessage(`已转换为 ${getImageFormatExtension(format).toUpperCase()}。`);
    } catch (error) {
      setConvertedImageUrl("");
      setConvertedImageMessage(error instanceof Error ? error.message : `${imageName} 转换失败。`);
    }
  }

  async function handleFormatImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !file.type.startsWith("image/")) {
      setConvertedImageMessage("请选择图片文件。");
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);

    setFormatImageDataUrl(dataUrl);
    setFormatImageName(file.name);
    await convertImage(dataUrl, file.name, imageOutputFormat);
  }

  function handleFormatChange(format: ImageOutputFormat) {
    setImageOutputFormat(format);

    if (formatImageDataUrl) {
      void convertImage(formatImageDataUrl, formatImageName, format);
    }
  }

  async function handleCoverImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    const image = await loadImageFromDataUrl(dataUrl);

    setCoverImageDataUrl(dataUrl);
    setCoverImageName(file.name);
    setCoverDimensions({ width: image.naturalWidth, height: image.naturalHeight });
  }

  async function makeBorderImage(dataUrl: string, imageName: string, size = borderSize, color = borderColor) {
    try {
      const image = await loadImageFromDataUrl(dataUrl);
      const safeBorder = Math.max(0, Math.round(size));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("浏览器不支持图片加边。");
      }

      canvas.width = image.naturalWidth + safeBorder * 2;
      canvas.height = image.naturalHeight + safeBorder * 2;
      context.fillStyle = color;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, safeBorder, safeBorder);
      setBorderImageUrl(canvas.toDataURL("image/png"));
      setBorderImageName(imageName);
    } catch {
      setBorderImageUrl("");
    }
  }

  async function handleBorderImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);

    setBorderImageDataUrl(dataUrl);
    setBorderImageName(file.name);
    await makeBorderImage(dataUrl, file.name);
  }

  function handleBorderChange(nextSize = borderSize, nextColor = borderColor) {
    setBorderSize(nextSize);
    setBorderColor(nextColor);

    if (borderImageDataUrl) {
      void makeBorderImage(borderImageDataUrl, borderImageName, nextSize, nextColor);
    }
  }

  async function makeWatermarkImage(
    dataUrl: string,
    imageName: string,
    options = {
      text: watermarkText,
      position: watermarkPosition,
      fontSize: watermarkFontSize,
      opacity: watermarkOpacity,
      color: watermarkColor
    }
  ) {
    try {
      const image = await loadImageFromDataUrl(dataUrl);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      const safeText = options.text.trim() || "Life OS";
      const safeFontSize = Math.max(12, Math.min(260, Math.round(options.fontSize)));
      const safeOpacity = Math.max(0.05, Math.min(1, options.opacity));

      if (!context) {
        throw new Error("浏览器不支持图片加水印。");
      }

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      context.drawImage(image, 0, 0);
      context.save();
      context.globalAlpha = safeOpacity;
      context.fillStyle = options.color;
      context.font = `600 ${safeFontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif`;
      context.shadowColor = "rgba(0, 0, 0, 0.28)";
      context.shadowBlur = Math.max(2, safeFontSize * 0.08);

      if (options.position === "tile") {
        const diagonal = Math.hypot(canvas.width, canvas.height);
        const measured = context.measureText(safeText).width;
        const horizontalGap = Math.max(measured + safeFontSize * 3, safeFontSize * 7);
        const verticalGap = safeFontSize * 3.4;

        context.translate(canvas.width / 2, canvas.height / 2);
        context.rotate((-24 * Math.PI) / 180);
        context.textAlign = "center";
        context.textBaseline = "middle";

        for (let y = -diagonal; y <= diagonal; y += verticalGap) {
          for (let x = -diagonal; x <= diagonal; x += horizontalGap) {
            context.fillText(safeText, x, y);
          }
        }
      } else {
        const margin = Math.max(safeFontSize, Math.round(Math.min(canvas.width, canvas.height) * 0.04));
        let x = canvas.width - margin;
        let y = canvas.height - margin - safeFontSize / 2;

        context.textAlign = "right";
        context.textBaseline = "middle";

        if (options.position === "bottom-left") {
          x = margin;
          context.textAlign = "left";
        }

        if (options.position === "top-right") {
          y = margin + safeFontSize / 2;
        }

        if (options.position === "center") {
          x = canvas.width / 2;
          y = canvas.height / 2;
          context.textAlign = "center";
        }

        context.fillText(safeText, x, y);
      }

      context.restore();
      setWatermarkImageUrl(canvas.toDataURL("image/png"));
      setWatermarkImageName(imageName);
    } catch {
      setWatermarkImageUrl("");
    }
  }

  async function handleWatermarkImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);

    setWatermarkImageDataUrl(dataUrl);
    setWatermarkImageName(file.name);
    await makeWatermarkImage(dataUrl, file.name);
  }

  function handleWatermarkChange(
    nextOptions: Partial<{
      text: string;
      position: WatermarkPosition;
      fontSize: number;
      opacity: number;
      color: string;
    }>
  ) {
    const options = {
      text: nextOptions.text ?? watermarkText,
      position: nextOptions.position ?? watermarkPosition,
      fontSize: nextOptions.fontSize ?? watermarkFontSize,
      opacity: nextOptions.opacity ?? watermarkOpacity,
      color: nextOptions.color ?? watermarkColor
    };

    if (nextOptions.text !== undefined) setWatermarkText(nextOptions.text);
    if (nextOptions.position !== undefined) setWatermarkPosition(nextOptions.position);
    if (nextOptions.fontSize !== undefined) setWatermarkFontSize(nextOptions.fontSize);
    if (nextOptions.opacity !== undefined) setWatermarkOpacity(nextOptions.opacity);
    if (nextOptions.color !== undefined) setWatermarkColor(nextOptions.color);

    if (watermarkImageDataUrl) {
      void makeWatermarkImage(watermarkImageDataUrl, watermarkImageName, options);
    }
  }

  function applyTimerPreset(preset: TimerPreset) {
    setIsTimerRunning(false);
    setTimerPhase("focus");
    setTimerTotalSeconds(preset.focusSeconds);
    setBreakTotalSeconds(preset.breakSeconds);
    setSecondsLeft(preset.focusSeconds);
    setTimerEndAt(null);
    setTimerNotice(`当前节奏：专注 ${formatTimerMinutes(preset.focusSeconds)}，休息 ${formatTimerMinutes(preset.breakSeconds)}。`);
    completedTimerKeyRef.current = null;
  }

  function handleToggleTimer() {
    if (isTimerRunning) {
      setIsTimerRunning(false);
      setTimerEndAt(null);
      return;
    }

    requestTimerNotificationPermission();

    const nextSecondsLeft = secondsLeft > 0 ? secondsLeft : activeTimerTotalSeconds;

    setSecondsLeft(nextSecondsLeft);
    setTimerEndAt(Date.now() + nextSecondsLeft * 1000);
    setTimerNotice(timerPhase === "focus" ? "专注计时中。" : "休息计时中。");
    completedTimerKeyRef.current = null;
    setIsTimerRunning(true);
  }

  function handleResetTimer() {
    setIsTimerRunning(false);
    setTimerEndAt(null);
    setTimerPhase("focus");
    setSecondsLeft(timerTotalSeconds);
    setTimerNotice("已重置到专注钟表。");
    completedTimerKeyRef.current = null;
  }

  function formatJson() {
    try {
      const parsed = JSON.parse(jsonValue);
      setJsonValue(JSON.stringify(parsed, null, 2));
      setJsonMessage("JSON 格式有效，已完成格式化。");
    } catch {
      setJsonMessage("JSON 解析失败，请检查引号、逗号或括号。");
    }
  }

  function pickRandomItem() {
    const total = Math.floor(Number(randomTotal));

    if (!Number.isFinite(total) || total < 1) {
      setRandomResult("总数至少为 1。");
      return;
    }

    const safeTotal = Math.min(total, 999999);
    const picked = Math.floor(Math.random() * safeTotal) + 1;

    setRandomResult(String(picked));
  }

  function renderLocalTool() {
    if (activeTool.id === "pomodoro") {
      return (
        <div className="tool-pomodoro">
          <div className="tool-pomodoro__stage">
            <div className="tool-pomodoro__phase" aria-live="polite">
              <span>{timerPhase === "focus" ? "FOCUS" : "BREAK"}</span>
              <strong>{timerPhaseLabel}</strong>
              <small>{timerPhaseMeta}</small>
            </div>
            <div className="pomodoro-record">
              <svg className="pomodoro-record__dial" viewBox="0 0 360 360" aria-hidden="true">
                {recordRings.map((radius, index) => (
                  <circle
                    key={radius}
                    className={
                      index === pomodoroStroke.activeSegment
                        ? "pomodoro-record__track pomodoro-record__track--active"
                        : index < pomodoroStroke.activeSegment
                        ? "pomodoro-record__track pomodoro-record__track--done"
                        : "pomodoro-record__track"
                    }
                    cx="180"
                    cy="180"
                    r={radius}
                  />
                ))}
                {pomodoroStroke.activeProgress > 0.004 ? (
                  <path className="pomodoro-record__progress" d={activeRingPath} />
                ) : null}
                <circle
                  className="pomodoro-record__end-dot"
                  cx={activeRingEndX}
                  cy={activeRingEndY}
                  r="4"
                />
              </svg>
              <TimerFace seconds={secondsLeft} />
            </div>
          </div>
          <div className="tool-pomodoro__controls">
            <p className="tool-pomodoro__notice" role="status">
              {timerNotice}
            </p>
            <label className="tool-field">
              <span>当前任务</span>
              <input
                value={focusTask}
                onChange={(event) => setFocusTask(event.target.value)}
                placeholder="这轮专注要做什么..."
              />
            </label>
            <div className="tool-pomodoro__footer">
              <div className="tool-chip-row">
                {timerPresets.map((preset) => (
                  <button
                    key={preset.label}
                    className={
                      timerTotalSeconds === preset.focusSeconds &&
                      breakTotalSeconds === preset.breakSeconds
                        ? "tool-chip tool-chip--active"
                        : "tool-chip"
                    }
                    type="button"
                    onClick={() => applyTimerPreset(preset)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="tool-action-row">
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleToggleTimer}
                >
                  {isTimerRunning ? "暂停" : "开始"}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={handleResetTimer}
                >
                  重置
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    playTimerDoneSound();
                    showTimerNotification(focusTask, timerPhase);
                    setTimerNotice("测试提醒已发送。");
                  }}
                >
                  测试提醒
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTool.id === "crop-image") {
      return (
        <div className="tool-local tool-local--full image-splitter">
          <div className="image-splitter__toolbar">
            <div>
              <p className="eyebrow">LOCAL CANVAS</p>
              <h3>图片切割</h3>
              <p>{splitMessage}</p>
            </div>
            <div className="tool-action-row">
              <input
                ref={splitFileInputRef}
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={handleSplitImageUpload}
              />
              <button className="primary-button" type="button" onClick={() => splitFileInputRef.current?.click()}>
                上传图片
              </button>
              <button
                className="ghost-button"
                type="button"
                disabled={!splitPieces.length}
                onClick={downloadAllSplitPieces}
              >
                下载全部
              </button>
            </div>
          </div>

          <div className="image-splitter__modes" aria-label="切图方式">
            {imageSplitModes.map((mode) => (
              <button
                key={mode.id}
                className={mode.id === splitModeId ? "tool-chip tool-chip--active" : "tool-chip"}
                type="button"
                onClick={() => handleSplitModeChange(mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {splitModeId === "custom" ? (
            <div className="image-splitter__custom">
              <label className="tool-field">
                <span>列数</span>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={customSplitColumns}
                  onChange={(event) => handleCustomSplitDimensionChange("columns", event.target.value)}
                />
              </label>
              <span className="image-splitter__custom-mark">×</span>
              <label className="tool-field">
                <span>行数</span>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={customSplitRows}
                  onChange={(event) => handleCustomSplitDimensionChange("rows", event.target.value)}
                />
              </label>
              <small>最多 12 × 12，避免图片过多导致浏览器卡顿。</small>
            </div>
          ) : null}

          <div className="image-splitter__layout">
            <section className="image-splitter__preview">
              <div className="image-splitter__section-header">
                <span>原图</span>
                <small>{splitImageName || splitMode.note}</small>
              </div>
              {splitImageDataUrl ? (
                <img src={splitImageDataUrl} alt="待切割原图" />
              ) : (
                <div className="image-splitter__empty">
                  <strong>上传图片后开始切割</strong>
                  <span>支持 JPG、PNG、WebP 等常见图片格式。</span>
                </div>
              )}
            </section>

            <section className="image-splitter__result">
              <div className="image-splitter__section-header">
                <span>
                  切图结果 / {splitMode.columns} × {splitMode.rows}
                </span>
                <small>{splitPieces.length ? `${splitPieces.length} 张` : "等待生成"}</small>
              </div>
              {splitPieces.length ? (
                <div
                  className="image-splitter__grid"
                  style={{ gridTemplateColumns: `repeat(${splitMode.columns}, minmax(0, 1fr))` }}
                >
                  {splitPieces.map((piece, index) => (
                    <figure key={piece.id} className="image-splitter__piece">
                      <img src={piece.url} alt={`切图 ${index + 1}`} />
                      <figcaption>
                        <span>
                          {index + 1}. {piece.width} × {piece.height}
                        </span>
                        <button className="ghost-button ghost-button--small" type="button" onClick={() => downloadSplitPiece(piece)}>
                          下载
                        </button>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <div className="image-splitter__empty">
                  <strong>这里会显示每一块图片</strong>
                  <span>发布时按编号顺序上传即可。</span>
                </div>
              )}
            </section>
          </div>
        </div>
      );
    }

    if (activeTool.id === "qr-code") {
      const qrSize = qrMatrix ? qrMatrix.length + 8 : 0;

      return (
        <div className="tool-local tool-local--full utility-tool">
          <div className="utility-tool__grid utility-tool__grid--preview">
            <section className="utility-panel">
              <p className="eyebrow">LOCAL QR</p>
              <h3>链接转二维码</h3>
              <label className="tool-field">
                <span>文本或链接</span>
                <textarea
                  value={qrText}
                  onChange={(event) => setQrText(event.target.value)}
                  placeholder="粘贴链接或输入一段文字"
                  rows={7}
                />
              </label>
              <div className="tool-action-row">
                <button className="primary-button" type="button" disabled={!qrMatrix} onClick={downloadQrSvg}>
                  下载 SVG
                </button>
                <span className="section-subtitle">{qrError || "二维码在本地生成，不调用外部接口。"}</span>
              </div>
            </section>
            <section className="utility-panel utility-panel--center">
              {qrMatrix ? (
                <svg className="qr-preview" viewBox={`0 0 ${qrSize} ${qrSize}`} shapeRendering="crispEdges" aria-label="二维码预览">
                  <rect width={qrSize} height={qrSize} fill="#fff" />
                  <g fill="#111">
                    {qrMatrix.map((row, y) =>
                      row.map((isDark, x) =>
                        isDark ? <rect key={`${x}-${y}`} x={x + 4} y={y + 4} width="1" height="1" /> : null
                      )
                    )}
                  </g>
                </svg>
              ) : (
                <div className="image-splitter__empty">
                  <strong>等待内容</strong>
                  <span>输入链接后生成二维码。</span>
                </div>
              )}
            </section>
          </div>
        </div>
      );
    }

    if (activeTool.id === "image-format") {
      return (
        <div className="tool-local tool-local--full utility-tool">
          <div className="image-splitter__toolbar">
            <div>
              <p className="eyebrow">LOCAL CANVAS</p>
              <h3>图片转格式</h3>
              <p>{convertedImageMessage}</p>
            </div>
            <div className="tool-action-row">
              <input ref={formatFileInputRef} className="sr-only" type="file" accept="image/*" onChange={handleFormatImageUpload} />
              <button className="primary-button" type="button" onClick={() => formatFileInputRef.current?.click()}>
                上传图片
              </button>
              <button
                className="ghost-button"
                type="button"
                disabled={!convertedImageUrl}
                onClick={() =>
                  downloadDataUrl(
                    convertedImageUrl,
                    `${getFileBaseName(formatImageName)}.${getImageFormatExtension(imageOutputFormat)}`
                  )
                }
              >
                下载
              </button>
            </div>
          </div>
          <div className="image-splitter__modes">
            {imageOutputFormats.map((format) => (
              <button
                key={format.value}
                className={format.value === imageOutputFormat ? "tool-chip tool-chip--active" : "tool-chip"}
                type="button"
                onClick={() => handleFormatChange(format.value)}
              >
                {format.label}
              </button>
            ))}
            <label className="utility-inline-field">
              质量
              <input
                type="range"
                min="0.4"
                max="1"
                step="0.02"
                value={imageQuality}
                onChange={(event) => {
                  const nextQuality = Number(event.target.value);

                  setImageQuality(nextQuality);
                  if (formatImageDataUrl) void convertImage(formatImageDataUrl, formatImageName, imageOutputFormat, nextQuality);
                }}
              />
            </label>
          </div>
          <div className="utility-preview-frame">
            {convertedImageUrl ? <img src={convertedImageUrl} alt="转换后的图片" /> : <span>上传图片后显示预览。</span>}
          </div>
        </div>
      );
    }

    if (activeTool.id === "cover-check") {
      return (
        <div className="tool-local tool-local--full utility-tool">
          <div className="utility-tool__grid utility-tool__grid--preview">
            <section className="utility-panel">
              <p className="eyebrow">COVER CHECK</p>
              <h3>小红书封面检查</h3>
              <input ref={coverFileInputRef} className="sr-only" type="file" accept="image/*" onChange={handleCoverImageUpload} />
              <button className="primary-button" type="button" onClick={() => coverFileInputRef.current?.click()}>
                上传封面
              </button>
              <div className="tool-result-card">
                <span>状态</span>
                <strong>{coverAdvice.status}</strong>
                <span>比例</span>
                <p>{coverAdvice.ratio}</p>
                <span>建议</span>
                <p>{coverAdvice.advice}</p>
              </div>
            </section>
            <section className="utility-panel utility-panel--center">
              {coverImageDataUrl ? (
                <div className="cover-check-preview">
                  <img src={coverImageDataUrl} alt={coverImageName || "封面预览"} />
                  <div className="cover-check-preview__safe-area" />
                </div>
              ) : (
                <div className="image-splitter__empty">
                  <strong>上传封面图</strong>
                  <span>会显示尺寸、比例和标题安全区参考。</span>
                </div>
              )}
            </section>
          </div>
        </div>
      );
    }

    if (activeTool.id === "image-border") {
      return (
        <div className="tool-local tool-local--full utility-tool">
          <div className="image-splitter__toolbar">
            <div>
              <p className="eyebrow">LOCAL CANVAS</p>
              <h3>图片加白边</h3>
              <p>给图片四周增加统一边距，适合让画面更有呼吸感。</p>
            </div>
            <div className="tool-action-row">
              <input ref={borderFileInputRef} className="sr-only" type="file" accept="image/*" onChange={handleBorderImageUpload} />
              <button className="primary-button" type="button" onClick={() => borderFileInputRef.current?.click()}>
                上传图片
              </button>
              <button
                className="ghost-button"
                type="button"
                disabled={!borderImageUrl}
                onClick={() => downloadDataUrl(borderImageUrl, `${getFileBaseName(borderImageName)}-border.png`)}
              >
                下载
              </button>
            </div>
          </div>
          <div className="utility-controls">
            <label className="tool-field">
              <span>边距 px</span>
              <input
                type="number"
                min="0"
                max="1200"
                value={borderSize}
                onChange={(event) => handleBorderChange(Number(event.target.value), borderColor)}
              />
            </label>
            <label className="tool-field">
              <span>背景色</span>
              <input type="color" value={borderColor} onChange={(event) => handleBorderChange(borderSize, event.target.value)} />
            </label>
          </div>
          <div className="utility-preview-frame">
            {borderImageUrl ? <img src={borderImageUrl} alt="加边后的图片" /> : <span>上传图片后显示预览。</span>}
          </div>
        </div>
      );
    }

    if (activeTool.id === "image-watermark") {
      return (
        <div className="tool-local tool-local--full utility-tool">
          <div className="image-splitter__toolbar">
            <div>
              <p className="eyebrow">LOCAL CANVAS</p>
              <h3>图片加水印</h3>
              <p>文字水印在本地浏览器生成，适合发布前快速打标。</p>
            </div>
            <div className="tool-action-row">
              <input
                ref={watermarkFileInputRef}
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={handleWatermarkImageUpload}
              />
              <button className="primary-button" type="button" onClick={() => watermarkFileInputRef.current?.click()}>
                上传图片
              </button>
              <button
                className="ghost-button"
                type="button"
                disabled={!watermarkImageUrl}
                onClick={() => downloadDataUrl(watermarkImageUrl, `${getFileBaseName(watermarkImageName)}-watermark.png`)}
              >
                下载
              </button>
            </div>
          </div>
          <div className="utility-tool__grid utility-tool__grid--four">
            <label className="tool-field">
              <span>水印文字</span>
              <input
                value={watermarkText}
                onChange={(event) => handleWatermarkChange({ text: event.target.value })}
                placeholder="例如 Life OS"
              />
            </label>
            <label className="tool-field">
              <span>字号</span>
              <input
                type="number"
                min="12"
                max="260"
                value={watermarkFontSize}
                onChange={(event) => handleWatermarkChange({ fontSize: Number(event.target.value) })}
              />
            </label>
            <label className="tool-field">
              <span>透明度 {Math.round(watermarkOpacity * 100)}%</span>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={watermarkOpacity}
                onChange={(event) => handleWatermarkChange({ opacity: Number(event.target.value) })}
              />
            </label>
            <label className="tool-field">
              <span>颜色</span>
              <input type="color" value={watermarkColor} onChange={(event) => handleWatermarkChange({ color: event.target.value })} />
            </label>
          </div>
          <div className="tool-chip-row">
            {watermarkPositions.map((position) => (
              <button
                key={position.value}
                className={position.value === watermarkPosition ? "tool-chip tool-chip--active" : "tool-chip"}
                type="button"
                onClick={() => handleWatermarkChange({ position: position.value })}
              >
                {position.label}
              </button>
            ))}
          </div>
          <div className="utility-preview-frame">
            {watermarkImageUrl ? <img src={watermarkImageUrl} alt="加水印后的图片" /> : <span>上传图片后显示水印预览。</span>}
          </div>
        </div>
      );
    }

    if (activeTool.id === "word-counter") {
      return (
        <div className="tool-local tool-local--full">
          <label className="tool-field">
            <span>待统计文本</span>
            <textarea
              value={textValue}
              onChange={(event) => setTextValue(event.target.value)}
              placeholder="粘贴一段文字，统计字数、段落和行数。"
              rows={9}
            />
          </label>
          <div className="tool-stat-grid">
            <span>字词</span>
            <strong>{textStats.words}</strong>
            <span>字符</span>
            <strong>{textStats.characters}</strong>
            <span>段落</span>
            <strong>{textStats.paragraphs}</strong>
            <span>行数</span>
            <strong>{textStats.lines}</strong>
          </div>
        </div>
      );
    }

    if (activeTool.id === "date-diff") {
      return (
        <div className="tool-local tool-local--centered">
          <div className="tool-two-columns">
            <label className="tool-field">
              <span>开始日期</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label className="tool-field">
              <span>结束日期</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
          </div>
          <div className="tool-result-card">
            <span className="section-subtitle">相隔</span>
            <strong>{dateDiff === null ? "--" : `${Math.abs(dateDiff)} 天`}</strong>
            <span className="section-subtitle">
              {dateDiff === null ? "选择两个日期后自动计算。" : dateDiff >= 0 ? "结束日期在开始日期之后。" : "结束日期在开始日期之前。"}
            </span>
          </div>
        </div>
      );
    }

    if (activeTool.id === "countdown") {
      return (
        <div className="tool-local tool-local--centered utility-tool">
          <div className="utility-tool__grid">
            <label className="tool-field">
              <span>事件名称</span>
              <input value={countdownTitle} onChange={(event) => setCountdownTitle(event.target.value)} />
            </label>
            <label className="tool-field">
              <span>目标时间</span>
              <input type="datetime-local" value={countdownTarget} onChange={(event) => setCountdownTarget(event.target.value)} />
            </label>
          </div>
          <div className="tool-result-card utility-result-hero">
            <span>{countdownTitle || "目标时间"}</span>
            <strong>{countdownInfo.label}</strong>
            <p>{countdownInfo.detail}</p>
          </div>
        </div>
      );
    }

    if (activeTool.id === "world-time") {
      return (
        <div className="tool-local tool-local--full utility-tool world-time-tool">
          <section className="utility-panel">
            <div className="world-time-heading">
              <div>
                <p className="eyebrow">WORLD CLOCK</p>
                <h3>常用城市当前时间</h3>
              </div>
              <span>{formatWorldClock(worldNow, "Asia/Shanghai").dateLabel}</span>
            </div>
            <div className="world-clock-grid">
              {worldClockCities.map((city) => {
                const clock = formatWorldClock(worldNow, city.timeZone);

                return (
                  <article key={city.timeZone} className="world-clock-card">
                    <span>{city.region}</span>
                    <strong>{city.name}</strong>
                    <time>{clock.time}</time>
                    <small>{clock.dateLabel}</small>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="utility-panel">
            <div className="world-time-heading">
              <div>
                <p className="eyebrow">TIME CONVERTER</p>
                <h3>时间转换</h3>
              </div>
              <span>默认北京时间</span>
            </div>
            <div className="utility-tool__grid">
              <label className="tool-field">
                <span>源时区</span>
                <select value={worldTimeSourceZone} onChange={(event) => setWorldTimeSourceZone(event.target.value)}>
                  {worldClockCities.map((city) => (
                    <option key={city.timeZone} value={city.timeZone}>
                      {city.name} / {city.region}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tool-field">
                <span>{worldSourceCity.name}时间</span>
                <input type="datetime-local" value={worldTimeInput} onChange={(event) => setWorldTimeInput(event.target.value)} />
              </label>
            </div>
            <div className="tool-action-row">
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setWorldTimeSourceZone("Asia/Shanghai");
                  setWorldTimeInput(formatDateTimeInputValue(new Date(), "Asia/Shanghai"));
                }}
              >
                填入当前北京时间
              </button>
            </div>
            <div className="world-conversion-list">
              {worldClockCities.map((city) => {
                const converted = formatWorldClock(worldConversionDate, city.timeZone);
                const dayDelta = getWorldDayDeltaLabel(worldConversionDate, worldTimeSourceZone, city.timeZone);

                return (
                  <article key={city.timeZone} className="world-conversion-row">
                    <div>
                      <strong>{city.name}</strong>
                      <span>{city.region}</span>
                    </div>
                    <time>{converted.time}</time>
                    <small>
                      {converted.dateLabel} / {dayDelta}
                    </small>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      );
    }

    if (activeTool.id === "percentage") {
      return (
        <div className="tool-local tool-local--centered utility-tool">
          <div className="utility-tool__grid">
            <label className="tool-field">
              <span>基准值</span>
              <input value={percentageBase} onChange={(event) => setPercentageBase(event.target.value)} inputMode="decimal" />
            </label>
            <label className="tool-field">
              <span>当前值 / 百分比</span>
              <input value={percentageValue} onChange={(event) => setPercentageValue(event.target.value)} inputMode="decimal" />
            </label>
          </div>
          <div className="tool-stat-grid">
            <span>占比</span>
            <strong>{Number.isFinite(percentageRatio) ? `${percentageRatio.toFixed(2)}%` : "--"}</strong>
            <span>增长率</span>
            <strong>{Number.isFinite(percentageIncrease) ? `${percentageIncrease.toFixed(2)}%` : "--"}</strong>
            <span>折扣价</span>
            <strong>{Number.isFinite(discountPrice) ? discountPrice.toFixed(2) : "--"}</strong>
            <span>差值</span>
            <strong>{Number.isFinite(valueNumber - baseNumber) ? (valueNumber - baseNumber).toFixed(2) : "--"}</strong>
          </div>
        </div>
      );
    }

    if (activeTool.id === "compound-interest") {
      return (
        <div className="tool-local tool-local--centered utility-tool">
          <div className="utility-tool__grid utility-tool__grid--four">
            <label className="tool-field">
              <span>初始本金</span>
              <input value={compoundPrincipal} onChange={(event) => setCompoundPrincipal(event.target.value)} inputMode="decimal" />
            </label>
            <label className="tool-field">
              <span>每月投入</span>
              <input value={compoundMonthly} onChange={(event) => setCompoundMonthly(event.target.value)} inputMode="decimal" />
            </label>
            <label className="tool-field">
              <span>年化 %</span>
              <input value={compoundRate} onChange={(event) => setCompoundRate(event.target.value)} inputMode="decimal" />
            </label>
            <label className="tool-field">
              <span>年数</span>
              <input value={compoundYears} onChange={(event) => setCompoundYears(event.target.value)} inputMode="decimal" />
            </label>
          </div>
          <div className="tool-stat-grid">
            <span>期末金额</span>
            <strong>{Number(compoundTotal).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</strong>
            <span>累计投入</span>
            <strong>{compoundInvested.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</strong>
            <span>预估收益</span>
            <strong>{compoundGain.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</strong>
            <span>月份</span>
            <strong>{months}</strong>
          </div>
        </div>
      );
    }

    if (activeTool.id === "csv-table") {
      return (
        <div className="tool-local tool-local--full utility-tool">
          <div className="utility-tool__grid">
            <label className="tool-field">
              <span>CSV 内容</span>
              <textarea value={csvValue} onChange={(event) => setCsvValue(event.target.value)} rows={12} />
            </label>
            <label className="tool-field">
              <span>Markdown 表格</span>
              <textarea value={markdownTable} readOnly rows={12} />
            </label>
          </div>
          <button className="ghost-button" type="button" onClick={() => void navigator.clipboard?.writeText(markdownTable)}>
            复制表格
          </button>
        </div>
      );
    }

    if (activeTool.id === "checklist") {
      return (
        <div className="tool-local tool-local--full utility-tool">
          <label className="tool-field">
            <span>清单主题</span>
            <input value={checklistTopic} onChange={(event) => setChecklistTopic(event.target.value)} placeholder="例如：旅行前 / 发布前 / 出门前" />
          </label>
          <div className="tool-action-row">
            <button className="primary-button" type="button" onClick={() => setChecklistOutput(makeChecklist(checklistTopic))}>
              生成清单
            </button>
            <button className="ghost-button" type="button" onClick={() => void navigator.clipboard?.writeText(checklistOutput)}>
              复制
            </button>
          </div>
          <label className="tool-field">
            <span>结果</span>
            <textarea value={checklistOutput} onChange={(event) => setChecklistOutput(event.target.value)} rows={12} />
          </label>
        </div>
      );
    }

    if (activeTool.id === "filename-cleaner") {
      return (
        <div className="tool-local tool-local--full utility-tool">
          <div className="utility-tool__grid">
            <label className="tool-field">
              <span>原文件名，每行一个</span>
              <textarea value={filenameInput} onChange={(event) => setFilenameInput(event.target.value)} rows={12} />
            </label>
            <label className="tool-field">
              <span>整理后</span>
              <textarea value={cleanedFileNames} readOnly rows={12} />
            </label>
          </div>
          <button className="ghost-button" type="button" onClick={() => void navigator.clipboard?.writeText(cleanedFileNames)}>
            复制整理结果
          </button>
        </div>
      );
    }

    if (activeTool.id === "markdown-cleaner") {
      return (
        <div className="tool-local tool-local--full">
          <label className="tool-field">
            <span>Markdown / 文本</span>
            <textarea
              value={markdownValue}
              onChange={(event) => setMarkdownValue(event.target.value)}
              placeholder="粘贴需要清理的 Markdown 或普通文本。"
              rows={9}
            />
          </label>
          <div className="tool-action-row">
            <button className="primary-button" type="button" onClick={() => setMarkdownValue(cleanMarkdown(markdownValue))}>
              清理格式
            </button>
            <button className="ghost-button" type="button" onClick={() => setMarkdownValue("")}>
              清空
            </button>
          </div>
        </div>
      );
    }

    if (activeTool.id === "text-dedupe") {
      return (
        <div className="tool-local tool-local--full">
          <label className="tool-field">
            <span>每行一个内容</span>
            <textarea
              value={markdownValue}
              onChange={(event) => setMarkdownValue(event.target.value)}
              placeholder="粘贴重复文本，每行一个。"
              rows={9}
            />
          </label>
          <button className="primary-button" type="button" onClick={() => setMarkdownValue(dedupeLines(markdownValue))}>
            去重
          </button>
        </div>
      );
    }

    if (activeTool.id === "json-format") {
      return (
        <div className="tool-local tool-local--full">
          <label className="tool-field">
            <span>JSON</span>
            <textarea
              value={jsonValue}
              onChange={(event) => setJsonValue(event.target.value)}
              placeholder='例如 {"name":"Life OS"}'
              rows={9}
            />
          </label>
          <div className="tool-action-row">
            <button className="primary-button" type="button" onClick={formatJson}>
              格式化
            </button>
            <span className="section-subtitle">{jsonMessage}</span>
          </div>
        </div>
      );
    }

    if (activeTool.id === "random-picker") {
      const randomRangeEnd = Math.max(1, Math.min(999999, Math.floor(Number(randomTotal)) || 1));

      return (
        <div className="tool-local tool-local--centered utility-tool">
          <div className="utility-tool__grid">
            <label className="tool-field">
              <span>抽取总数</span>
              <input
                type="number"
                min="1"
                max="999999"
                inputMode="numeric"
                value={randomTotal}
                onChange={(event) => setRandomTotal(event.target.value)}
                placeholder="例如 50 / 100"
              />
            </label>
            <div className="tool-result-card utility-result-hero">
              <span>随机结果</span>
              <strong>{randomResult}</strong>
              <p>从 1 到 {randomRangeEnd} 中抽取一个数字。</p>
            </div>
          </div>
          <div className="tool-chip-row">
            {[50, 100, 200].map((total) => (
              <button
                key={total}
                className={randomTotal === String(total) ? "tool-chip tool-chip--active" : "tool-chip"}
                type="button"
                onClick={() => {
                  setRandomTotal(String(total));
                  setRandomResult("--");
                }}
              >
                {total}
              </button>
            ))}
          </div>
          <div className="tool-action-row">
            <button className="primary-button" type="button" onClick={pickRandomItem}>
              随机抽取
            </button>
            <button className="ghost-button" type="button" onClick={() => setRandomResult("--")}>
              重置
            </button>
          </div>
        </div>
      );
    }

    if (activeTool.id === "scratch-note") {
      return (
        <div className="tool-local tool-local--full">
          <label className="tool-field">
            <span>临时便签</span>
            <textarea
              value={noteValue}
              onChange={(event) => setNoteValue(event.target.value)}
              placeholder="临时写点东西，不进入长期系统。"
              rows={11}
            />
          </label>
          <button className="ghost-button" type="button" onClick={() => setNoteValue("")}>
            一键清空
          </button>
        </div>
      );
    }

    return (
      <div className="tool-empty">
        <p className="eyebrow">PLANNED</p>
        <h3>{activeTool.name}</h3>
        <p className="section-subtitle section-subtitle--body">
          这个工具已经进入工具库，后续可以在不重排页面的情况下补齐功能。
        </p>
      </div>
    );
  }

  return (
    <div className="tool-desk">
      <section className="tool-workspace">
        <main className="tool-runner">
          <div className="tool-runner__header">
            <div>
              <p className="eyebrow">CURRENT TOOL</p>
              <h2 className="section-title">当前工具 / {activeTool.name}</h2>
            </div>
            <div className="tool-runner__actions">
              <span className="tag">{activeTool.status === "站内" ? "站内打开" : activeTool.status}</span>
              {activeTool.url ? (
                <a className="ghost-button ghost-button--small" href={activeTool.url} target="_blank" rel="noreferrer">
                  新标签打开
                </a>
              ) : null}
            </div>
          </div>

          {activeTool.url ? (
            <div className="tool-embed">
              <div className="tool-embed__bar">
                <span>{activeTool.url.replace(/^https?:\/\//, "")}</span>
                <span>外部工具</span>
              </div>
              <iframe
                title={activeTool.name}
                src={activeTool.url}
                sandbox="allow-downloads allow-forms allow-popups allow-same-origin allow-scripts"
              />
              <p className="tool-embed__note">
                如果该网站不允许嵌入，这里可能显示空白或拒绝访问。可以使用右上角“新标签打开”。
              </p>
            </div>
          ) : (
            renderLocalTool()
          )}
        </main>

        <aside className="tool-library">
          <div className="tool-panel-heading">
            <div>
              <p className="eyebrow">TOOLS</p>
              <h2 className="section-title">工具库</h2>
            </div>
            <div className="tool-panel-actions">
              <span className="tag">{filteredTools.length} 个</span>
              <button
                className="ghost-button ghost-button--small"
                type="button"
                onClick={() => setIsToolManagerOpen(true)}
              >
                管理
              </button>
            </div>
          </div>

          <label className="tool-search">
            <span className="sr-only">搜索工具</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索工具..."
              type="search"
            />
          </label>

          <div className="tool-category-row" aria-label="工具分类">
            {categories.map((category) => (
              <button
                key={category}
                className={`tool-category ${activeCategory === category ? "tool-category--active" : ""}`}
                type="button"
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <p className="tool-library__hint">拖拽工具卡片可以调整位置，新增网站在“管理”里完成。</p>

          <div className="tool-card-grid">
            {filteredTools.map((tool) => (
              <button
                key={tool.id}
                className={`tool-card ${activeTool.id === tool.id ? "tool-card--active" : ""} ${
                  draggedToolId === tool.id ? "tool-card--dragging" : ""
                }`}
                type="button"
                draggable
                onDragStart={(event) => {
                  setDraggedToolId(tool.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", tool.id);
                }}
                onDragOver={(event) => {
                  if (draggedToolId) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const droppedToolId = event.dataTransfer.getData("text/plain") || draggedToolId;

                  if (droppedToolId) {
                    moveTool(droppedToolId, tool.id);
                  }

                  setDraggedToolId(null);
                }}
                onDragEnd={() => setDraggedToolId(null)}
                onClick={() => selectTool(tool.id)}
              >
                <span className="tool-card__top">
                  <strong>{tool.name}</strong>
                  <small>{tool.status}</small>
                </span>
                <span>{tool.subtitle}</span>
              </button>
            ))}
          </div>
        </aside>
      </section>

      {isToolManagerOpen ? (
        <div className="tool-modal-backdrop" role="presentation">
          <section className="tool-manager" role="dialog" aria-modal="true" aria-labelledby="tool-manager-title">
            <div className="tool-manager__header">
              <div>
                <p className="eyebrow">TOOLS MANAGER</p>
                <h2 id="tool-manager-title" className="section-title">
                  工具管理
                </h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="关闭工具管理"
                onClick={() => setIsToolManagerOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="tool-manager__body">
              <form className="tool-manager__form" onSubmit={handleAddWebsiteTool}>
                <div className="tool-manager__form-title">
                  <h3>添加已有网站</h3>
                  <p>{toolManageMessage}</p>
                </div>
                <label className="tool-field">
                  <span>工具名称</span>
                  <input
                    value={toolDraftName}
                    onChange={(event) => setToolDraftName(event.target.value)}
                    placeholder="例如 TinyPNG / Notion AI"
                  />
                </label>
                <label className="tool-field">
                  <span>网站地址</span>
                  <input
                    value={toolDraftUrl}
                    onChange={(event) => setToolDraftUrl(event.target.value)}
                    placeholder="例如 https://tinypng.com"
                  />
                </label>
                <label className="tool-field">
                  <span>备注</span>
                  <input
                    value={toolDraftSubtitle}
                    onChange={(event) => setToolDraftSubtitle(event.target.value)}
                    placeholder="一句话说明这个工具做什么"
                  />
                </label>
                <label className="tool-field">
                  <span>分类</span>
                  <select
                    value={toolDraftCategory}
                    onChange={(event) => setToolDraftCategory(event.target.value as ToolDefinition["category"])}
                  >
                    {toolManageCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="tool-action-row">
                  <button className="primary-button" type="submit">
                    添加工具
                  </button>
                  <button className="ghost-button" type="button" onClick={handleRestoreBuiltInTools}>
                    恢复内置工具
                  </button>
                </div>
              </form>

              <div className="tool-manager__list">
                <div className="tool-manager__form-title">
                  <h3>现有工具</h3>
                  <p>自定义工具会删除；内置工具会隐藏。</p>
                </div>
                <div className="tool-manager__items">
                  {orderedTools.map((tool) => (
                    <div key={tool.id} className="tool-manager__item">
                      <div>
                        <strong>{tool.name}</strong>
                        <span>{tool.isCustom ? "自定义网站" : tool.status}</span>
                      </div>
                      <button className="ghost-button ghost-button--small" type="button" onClick={() => handleRemoveTool(tool.id)}>
                        {tool.isCustom ? "删除" : "隐藏"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
