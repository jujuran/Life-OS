import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export type LifeOsDataDirectorySource =
  | "environment"
  | "legacy"
  | "platform-default";

export type LifeOsDataDirectoryInfo = {
  path: string;
  source: LifeOsDataDirectorySource;
};

const DATA_DIRECTORY_ENV_NAME = "LIFE_OS_DATA_DIR";

export function getLegacyLifeOsDataDirectory() {
  return join(process.cwd(), "data");
}

export function getPlatformLifeOsDataDirectory() {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA?.trim();
    return join(localAppData || homedir(), "Life OS");
  }

  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "Life OS");
  }

  const xdgDataHome = process.env.XDG_DATA_HOME?.trim();
  return join(xdgDataHome || join(homedir(), ".local", "share"), "life-os");
}

export function getLifeOsDataDirectoryInfo(): LifeOsDataDirectoryInfo {
  const configuredDirectory = process.env[DATA_DIRECTORY_ENV_NAME]?.trim();

  if (configuredDirectory) {
    return {
      path: resolve(configuredDirectory),
      source: "environment"
    };
  }

  const legacyDirectory = getLegacyLifeOsDataDirectory();

  if (existsSync(legacyDirectory)) {
    return {
      path: legacyDirectory,
      source: "legacy"
    };
  }

  return {
    path: getPlatformLifeOsDataDirectory(),
    source: "platform-default"
  };
}

export function getLifeOsDataDirectory() {
  return getLifeOsDataDirectoryInfo().path;
}

export function getLifeOsDataPath(...segments: string[]) {
  return join(getLifeOsDataDirectory(), ...segments);
}
