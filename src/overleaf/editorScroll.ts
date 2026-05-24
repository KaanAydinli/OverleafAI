import type { Page } from "playwright";

export interface CommentWrapperRaw {
  text: string;
  author: string;
  time: string;
}

export interface CommentEntryRaw {
  dataPos: number;
  domOrder: number;
  wrappers: CommentWrapperRaw[];
}

export interface EditorSnapshot {
  lines: Map<number, string>;
  comments: Map<number, CommentEntryRaw>;
  totalLines: number;
}

const SCROLL_SETTLE_MS = 180;
const MAX_ITERATIONS = 600;

export async function scrollAndCollectAll(page: Page): Promise<EditorSnapshot> {
  const editor = page.locator(".cm-content[contenteditable='true']");
  await editor.waitFor({ timeout: 5000 });
  await editor.click();

  await page.keyboard.press("Control+Home");
  await page.waitForTimeout(SCROLL_SETTLE_MS);

  await page.keyboard.press("Control+End");
  await page.waitForTimeout(SCROLL_SETTLE_MS + 200);

  const totalLines = await page.evaluate(() => {
    const gutters = Array.from(document.querySelectorAll(".cm-gutterElement"));
    let max = 0;
    for (const g of gutters) {
      const n = parseInt((g.textContent || "").trim(), 10);
      if (!isNaN(n) && n > max) max = n;
    }
    return max;
  });

  await page.keyboard.press("Control+Home");
  await page.waitForTimeout(SCROLL_SETTLE_MS + 100);

  const lines = new Map<number, string>();
  const comments = new Map<number, CommentEntryRaw>();
  let domOrderCounter = 0;
  let lastTotal = -1;
  let stableCount = 0;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const snapshot = await page.evaluate(() => {
      const gutterEls = Array.from(
        document.querySelectorAll(".cm-gutterElement"),
      );
      const lineEls = Array.from(document.querySelectorAll(".cm-line"));
      const numberedGutters: number[] = [];
      for (const g of gutterEls) {
        const n = parseInt((g.textContent || "").trim(), 10);
        if (!isNaN(n)) numberedGutters.push(n);
      }
      const lineData: [number, string][] = [];
      const len = Math.min(numberedGutters.length, lineEls.length);
      for (let i = 0; i < len; i++) {
        lineData.push([numberedGutters[i], lineEls[i].textContent || ""]);
      }

      const commentEls = Array.from(
        document.querySelectorAll(".review-panel-entry-comment"),
      );
      const commentData: {
        dataPos: number;
        wrappers: { text: string; author: string; time: string }[];
      }[] = [];
      for (const entry of commentEls) {
        const dpStr = entry.getAttribute("data-pos");
        if (!dpStr) continue;
        const dp = parseInt(dpStr, 10);
        if (isNaN(dp)) continue;
        const wrapperEls = Array.from(
          entry.querySelectorAll(".review-panel-comment-wrapper"),
        );
        const wrappers = wrapperEls.map((w) => {
          const body = w.querySelector(".review-panel-comment-body");
          const author = w.querySelector(".review-panel-entry-user");
          const time = w.querySelector(".review-panel-entry-time");
          return {
            text: (body?.textContent || "").trim(),
            author: (author?.textContent || "").trim() || "Unknown",
            time: (time?.textContent || "").trim(),
          };
        });
        if (wrappers.length > 0) {
          commentData.push({ dataPos: dp, wrappers });
        }
      }

      return { lineData, commentData };
    });

    for (const [num, text] of snapshot.lineData) {
      lines.set(num, text);
    }
    for (const c of snapshot.commentData) {
      const existing = comments.get(c.dataPos);
      if (!existing) {
        comments.set(c.dataPos, {
          dataPos: c.dataPos,
          domOrder: domOrderCounter++,
          wrappers: c.wrappers,
        });
      } else if (c.wrappers.length > existing.wrappers.length) {
        existing.wrappers = c.wrappers;
      }
    }

    const reachedEnd = totalLines > 0 && lines.size >= totalLines;
    const currentTotal = lines.size + comments.size;

    if (reachedEnd) {
      stableCount++;
      if (stableCount >= 2) break;
    } else if (currentTotal === lastTotal) {
      stableCount++;
      if (stableCount >= 4) break;
    } else {
      stableCount = 0;
    }
    lastTotal = currentTotal;

    await page.keyboard.press("PageDown");
    await page.waitForTimeout(SCROLL_SETTLE_MS);
  }

  return { lines, comments, totalLines };
}

export function linesMapToOrderedTexts(lines: Map<number, string>): string[] {
  if (lines.size === 0) return [];
  const maxLine = Math.max(...lines.keys());
  const result: string[] = [];
  for (let i = 1; i <= maxLine; i++) {
    result.push(lines.get(i) ?? "");
  }
  return result;
}
