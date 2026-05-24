import type { Page } from "playwright";
import { scrollAndCollectAll, linesMapToOrderedTexts } from "./editorScroll.js";

export interface CommentEntry {
  text: string;
  author: string;
  time: string;
}

export interface LineContext {
  previousLineNumber: number | null;
  previousLineText: string | null;
  currentLineNumber: number;
  currentLineText: string;
  nextLineNumber: number | null;
  nextLineText: string | null;
}

export interface CommentThread {
  domIndex: number;
  lineNumber: number;
  lineContext: LineContext;
  mainComment: CommentEntry;
  replies: CommentEntry[];
}

export const AI_REVIEWER_AUTHOR = "AI Reviewer";

export async function readCommentThreads(page: Page): Promise<CommentThread[]> {
  const reviewPanelVisible = await page
    .locator('[data-testid="review-panel"]')
    .first()
    .waitFor({ timeout: 10000 })
    .then(() => true)
    .catch(() => false);

  if (!reviewPanelVisible) {
    return [];
  }

  const { lines, comments } = await scrollAndCollectAll(page);

  if (comments.size === 0) {
    return [];
  }

  const orderedLines = linesMapToOrderedTexts(lines);

  let currentPos = 0;
  const positionToLine: { [key: number]: number } = {};
  for (let i = 0; i < orderedLines.length; i++) {
    const lineLength = orderedLines[i].length;
    for (let j = 0; j <= lineLength; j++) {
      positionToLine[currentPos + j] = i + 1;
    }
    currentPos += lineLength + 1;
  }

  const sortedComments = Array.from(comments.values()).sort(
    (a, b) => a.dataPos - b.dataPos,
  );

  const commentThreads: CommentThread[] = sortedComments.map((c, idx) => {
    const lineNum = positionToLine[c.dataPos] || 0;
    const main = c.wrappers[0];
    const replies = c.wrappers.slice(1);
    return {
      domIndex: idx + 1,
      lineNumber: lineNum,
      lineContext: buildLineContext(orderedLines, lineNum),
      mainComment: {
        text: main.text,
        author: main.author,
        time: main.time,
      },
      replies: replies.map((r) => ({
        text: r.text,
        author: r.author,
        time: r.time,
      })),
    };
  });

  return commentThreads;
}

function buildLineContext(lines: string[], lineNumber: number): LineContext {
  const idx = lineNumber - 1;
  const hasPrev = idx - 1 >= 0;
  const hasNext = idx + 1 < lines.length;
  const inRange = idx >= 0 && idx < lines.length;

  return {
    previousLineNumber: hasPrev ? lineNumber - 1 : null,
    previousLineText: hasPrev ? lines[idx - 1] : null,
    currentLineNumber: lineNumber,
    currentLineText: inRange ? lines[idx] : "",
    nextLineNumber: hasNext ? lineNumber + 1 : null,
    nextLineText: hasNext ? lines[idx + 1] : null,
  };
}

function formatLineContext(context: LineContext): string {
  const prev =
    context.previousLineText === null
      ? `    Line ${context.currentLineNumber - 1}: (start of document — no previous line)`
      : `    Line ${context.previousLineNumber}: ${JSON.stringify(context.previousLineText)}`;
  const current = `  > Line ${context.currentLineNumber} (anchor): ${JSON.stringify(context.currentLineText)}`;
  const next =
    context.nextLineText === null
      ? `    Line ${context.currentLineNumber + 1}: (end of document — no next line)`
      : `    Line ${context.nextLineNumber}: ${JSON.stringify(context.nextLineText)}`;

  return [prev, current, next].join("\n");
}

export function formatCommentThreads(threads: CommentThread[]): string {
  if (threads.length === 0) {
    return "No comments found.";
  }

  const formatted = threads
    .map((thread) => {
      let output =
        `Comment ${thread.domIndex}:\n` +
        `  Line: ${thread.lineNumber}\n` +
        `  Anchor context (the comment is anchored to the line marked with '>'):\n` +
        formatLineContext(thread.lineContext) +
        `\n` +
        `  Text: ${thread.mainComment.text}\n` +
        `  Author: ${thread.mainComment.author}\n` +
        `  Time: ${thread.mainComment.time}`;

      if (thread.replies.length > 0) {
        output += `\n  Replies (${thread.replies.length}):`;
        thread.replies.forEach((reply, replyIdx) => {
          output +=
            `\n    Reply ${replyIdx + 1}:\n` +
            `      Text: ${reply.text}\n` +
            `      Author: ${reply.author}\n` +
            `      Time: ${reply.time}`;
        });
      }

      return output;
    })
    .join("\n\n");

  return `Found ${threads.length} comment thread(s):\n\n${formatted}`;
}

export function filterOutAiReviewer(threads: CommentThread[]): CommentThread[] {
  return threads.filter(
    (thread) => thread.mainComment.author !== AI_REVIEWER_AUTHOR,
  );
}

export async function readComments(page: Page): Promise<string> {
  try {
    const threads = await readCommentThreads(page);
    return formatCommentThreads(threads);
  } catch (error) {
    return `Error reading comments: ${error}`;
  }
}
