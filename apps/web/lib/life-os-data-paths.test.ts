import { afterEach, describe, expect, it } from "vitest";
import { join, resolve } from "node:path";
import {
  getLifeOsDataDirectoryInfo,
  getLifeOsDataPath
} from "./life-os-data-paths";

const originalDataDirectory = process.env.LIFE_OS_DATA_DIR;

afterEach(() => {
  if (originalDataDirectory === undefined) {
    delete process.env.LIFE_OS_DATA_DIR;
  } else {
    process.env.LIFE_OS_DATA_DIR = originalDataDirectory;
  }
});

describe("Life OS data paths", () => {
  it("prefers an explicitly configured private data directory", () => {
    process.env.LIFE_OS_DATA_DIR = join(".codex-tmp", "private-data");

    expect(getLifeOsDataDirectoryInfo()).toEqual({
      path: resolve(".codex-tmp", "private-data"),
      source: "environment"
    });
  });

  it("builds store paths below the selected data directory", () => {
    process.env.LIFE_OS_DATA_DIR = join(".codex-tmp", "private-data");

    expect(getLifeOsDataPath("backups", "finance.json")).toBe(
      resolve(".codex-tmp", "private-data", "backups", "finance.json")
    );
  });
});
