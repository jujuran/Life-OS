import { readFileSync } from "node:fs";

const trackedFiles = readFileSync(0, "utf8")
  .split("\0")
  .filter(Boolean);

const forbiddenPaths = [
  /^apps\/web\/data\//,
  /(^|\/)\.env\.local$/,
  /(^|\/)content-studio-seed\.ts$/,
  /(^|\/)finance-dashboard-seed\.ts$/
];

const detectors = [
  { name: "OpenAI-style API key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { name: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/g },
  { name: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  {
    name: "private key block",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g
  }
];

const findings = [];

for (const file of trackedFiles) {
  if (forbiddenPaths.some((pattern) => pattern.test(file))) {
    findings.push(`tracked private path: ${file}`);
    continue;
  }

  if (file === "scripts/check-secrets.mjs") {
    continue;
  }

  const buffer = readFileSync(file);
  if (buffer.includes(0) || buffer.length > 2_000_000) {
    continue;
  }

  const content = buffer.toString("utf8");
  for (const detector of detectors) {
    detector.pattern.lastIndex = 0;
    if (detector.pattern.test(content)) {
      findings.push(`${detector.name}: ${file}`);
    }
  }
}

if (findings.length) {
  console.error("Potential private data or secrets were found:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log(`Secret scan passed for ${trackedFiles.length} tracked files.`);
