import { execFileSync } from "node:child_process";
import * as fs from "fs";
import * as path from "path";
import { type BrowserContext, type Page } from "playwright";
import { config } from "./config.js";

export interface BrowserSession {
  page: Page;
  context: BrowserContext;
}

let attemptedBrowserInstall = false;

export async function setupBrowser(sessionFile?: string): Promise<BrowserSession> {
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve(process.cwd(), ".playwright-browsers");

  const { chromium } = await import("playwright");

  const isHeadless = process.env.HEADLESS !== "false";

  const sessionFromEnv = resolveSessionFromEnv();
  const sessionPath = sessionFromEnv ? undefined : resolveSessionPath(sessionFile);

  const launchOptions = {
    headless: isHeadless,
    args: isHeadless
      ? [
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--disable-setuid-sandbox",
          "--no-sandbox",
        ]
      : [],
  };

  let browser;
  try {
    browser = await chromium.launch(launchOptions);
  } catch (error) {
    if (!isMissingPlaywrightBrowserError(error) || attemptedBrowserInstall) {
      throw error;
    }

    attemptedBrowserInstall = true;
    installPlaywrightChromium();
    browser = await chromium.launch(launchOptions);
  }

  const context = await browser.newContext({
    storageState: sessionFromEnv ?? sessionPath,
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  return { page, context };
}

export async function cleanupBrowser(session: BrowserSession): Promise<void> {
  const browser = session.context.browser();

  try {
    await session.context.close();
  } catch {
    // ignore
  }

  try {
    if (browser && browser.isConnected()) {
      await browser.close();
    }
  } catch {
    // ignore
  }
}

function isMissingPlaywrightBrowserError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("Executable doesn't exist") ||
    message.includes("playwright install")
  );
}

function installPlaywrightChromium(): void {
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

  execFileSync(npxCommand, ["playwright", "install", "chromium"], {
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? "0",
    },
    stdio: "inherit",
  });
}

function resolveSessionFromEnv() {
  const raw = process.env.OVERLEAF_SESSION_JSON;
  if (!raw || !raw.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`OVERLEAF_SESSION_JSON is not valid JSON: ${message}`);
  }
}

function resolveSessionPath(sessionFile?: string): string | undefined {
  if (sessionFile) {
    const directPath = path.resolve(sessionFile);
    if (fs.existsSync(directPath)) {
      return directPath;
    }
    const sessionsDirPath = path.join(config.sessionsDir, sessionFile);
    if (fs.existsSync(sessionsDirPath)) {
      return sessionsDirPath;
    }

    throw new Error(
      `Session file not found: ${sessionFile}. Checked ${directPath} and ${sessionsDirPath}.`,
    );
  }

  if (!fs.existsSync(config.sessionsDir)) {
    throw new Error(
      `No session file found. Sessions directory does not exist: ${config.sessionsDir}.`,
    );
  }

  const firstJson = fs
    .readdirSync(config.sessionsDir)
    .find((file) => file.endsWith(".json"));

  if (!firstJson) {
    throw new Error(
      `No session file found in ${config.sessionsDir}. Add a .json storage state file or pass sessionFile.`,
    );
  }

  return path.join(config.sessionsDir, firstJson);
}
