import type { Page } from "playwright";
import { scrollAndCollectAll, linesMapToOrderedTexts } from "./editorScroll.js";

export async function readPaper(page: Page): Promise<string> {
  try {
    const { lines } = await scrollAndCollectAll(page);
    if (lines.size === 0) return "";
    const ordered = linesMapToOrderedTexts(lines);
    return ordered.map((text, i) => `${i + 1}: ${text}`).join("\n");
  } catch (error) {
    return `Error reading paper: ${error}`;
  }
}
