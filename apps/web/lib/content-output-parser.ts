type ContentJsonPayload = {
  titles?: unknown;
  body?: unknown;
  tags?: unknown;
};

const WRAPPER_KEYS = ["content", "output", "result", "response", "data", "text"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasContentFields(value: Record<string, unknown>) {
  return "titles" in value || "body" in value || "tags" in value;
}

function stripThinkingBlocks(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function escapeControlCharactersInsideStrings(text: string) {
  let output = "";
  let inString = false;
  let escaped = false;

  for (const character of text) {
    if (!inString) {
      output += character;
      if (character === '"') {
        inString = true;
      }
      continue;
    }

    if (escaped) {
      output += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      output += character;
      escaped = true;
      continue;
    }

    if (character === '"') {
      output += character;
      inString = false;
      continue;
    }

    if (character === "\n") {
      output += "\\n";
    } else if (character === "\r") {
      output += "\\r";
    } else if (character === "\t") {
      output += "\\t";
    } else {
      output += character;
    }
  }

  return output;
}

function quoteKnownContentKeys(text: string) {
  return text.replace(/([,{]\s*)(titles|body|tags)\s*:/g, '$1"$2":');
}

function tryJsonParse(text: string): unknown {
  const trimmed = text.trim();

  if (!trimmed) {
    return undefined;
  }

  const repaired = quoteKnownContentKeys(trimmed);
  const candidates = repaired === trimmed ? [trimmed] : [trimmed, repaired];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      try {
        return JSON.parse(escapeControlCharactersInsideStrings(candidate)) as unknown;
      } catch {
        // Try the next conservative repair.
      }
    }
  }

  if (/^\s*\{\\"/.test(trimmed)) {
    try {
      return JSON.parse(
        '"' + trimmed.replace(/\r/g, "\\r").replace(/\n/g, "\\n") + '"'
      ) as unknown;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function findBalancedJsonObject(text: string) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
    } else if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return "";
}

function getJsonCandidates(rawText: string) {
  const cleaned = stripThinkingBlocks(rawText);
  const candidates = [cleaned];
  const fencedMatches = cleaned.matchAll(/\x60\x60\x60(?:json)?\s*([\s\S]*?)\s*\x60\x60\x60/gi);

  for (const match of fencedMatches) {
    if (match[1]) {
      candidates.push(match[1]);
    }
  }

  const balanced = findBalancedJsonObject(cleaned);
  if (balanced) {
    candidates.push(balanced);
  }

  return [...new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))];
}

function unwrapContentPayload(value: unknown, depth = 0): ContentJsonPayload | null {
  if (depth > 5) {
    return null;
  }

  if (typeof value === "string") {
    for (const candidate of getJsonCandidates(value)) {
      const parsed = tryJsonParse(candidate);
      if (parsed !== undefined && parsed !== value) {
        const result = unwrapContentPayload(parsed, depth + 1);
        if (result) {
          return result;
        }
      }
    }
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  if (hasContentFields(value)) {
    return value;
  }

  for (const key of WRAPPER_KEYS) {
    if (key in value) {
      const result = unwrapContentPayload(value[key], depth + 1);
      if (result) {
        return result;
      }
    }
  }

  const message = value.message;
  if (isRecord(message) && "content" in message) {
    return unwrapContentPayload(message.content, depth + 1);
  }

  return null;
}

export function parseContentJsonPayload(rawText: string): ContentJsonPayload | null {
  for (const candidate of getJsonCandidates(rawText)) {
    const parsed = tryJsonParse(candidate);
    if (parsed === undefined) {
      continue;
    }

    const payload = unwrapContentPayload(parsed);
    if (payload) {
      return payload;
    }
  }

  return null;
}

export function looksLikeContentJson(rawText: string) {
  const text = stripThinkingBlocks(rawText);
  return /(?:^|\x60\x60\x60json|\{)[\s\S]{0,240}\\?["'](?:titles|body|tags)\\?["']\s*:/i.test(text);
}
