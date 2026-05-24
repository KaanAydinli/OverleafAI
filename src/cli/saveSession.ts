import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { chromium } from "playwright";

const SESSIONS_DIR = path.resolve("./sessions");

async function promptUser(question: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, () => {
      rl.close();
      resolve();
    });
  });
}

async function saveSession() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }

  console.log("Launching headed browser — log into Overleaf, then come back here.");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.goto("https://www.overleaf.com/login");

  await promptUser("\nPress ENTER here once you are fully logged in to Overleaf...");

  const sessionFile = path.join(SESSIONS_DIR, "session.json");
  await context.storageState({ path: sessionFile });

  console.log(`\nSession saved to ${sessionFile}`);

  await browser.close();
}

saveSession().catch((err) => {
  console.error("Failed to save session:", err);
  process.exit(1);
});
