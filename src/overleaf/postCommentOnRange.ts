import type { Page } from "playwright";

export async function postCommentOnRange(
  page: Page,
  startLine: number,
  endLine: number,
  commentText: string,
): Promise<string> {
  try {
    const rangeLabel = startLine === endLine
      ? `line ${startLine}`
      : `lines ${startLine}–${endLine}`;
    console.log(`\n--- Posting comment on ${rangeLabel} ---`);
    console.log(`[Agent Action] -> Comment Text: "${commentText}"`);

    if (startLine > endLine) {
      return `Error: startLine (${startLine}) is greater than endLine (${endLine}). Please provide a valid range.`;
    }

    const isMac = process.platform === "darwin";
    const editor = page.locator(".cm-content[contenteditable='true']");
    await editor.waitFor({ timeout: 5000 });

    await editor.click({ force: true });
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);


    const scrollResult = await page.evaluate(
      ({ start, end }: { start: number; end: number }) => {
        type AnyObj = Record<string, unknown>;

        const contentEl = document.querySelector(".cm-content[contenteditable='true']") as AnyObj | null;
        let targetView = (contentEl?.["cmView"] as AnyObj | undefined)?.["view"] as AnyObj | undefined;

        if (!targetView) {
          const editorEl = document.querySelector(".cm-editor") as AnyObj | null;
          if (editorEl) {
            for (const key of Object.getOwnPropertyNames(editorEl)) {
              const v = editorEl[key] as AnyObj | undefined;
              if (v && typeof v["dispatch"] === "function" && v["state"]) {
                targetView = v;
                break;
              }
            }
          }
        }

        if (!targetView) return "Error: Could not find CodeMirror view.";

        const doc = (targetView["state"] as AnyObj)["doc"] as AnyObj;
        const totalLines = doc["lines"] as number;
        if (start > totalLines) return `Error: Line ${start} is out of bounds. Document only has ${totalLines} lines.`;
        if (end > totalLines) return `Error: Line ${end} is out of bounds. Document only has ${totalLines} lines.`;


        const startFrom = ((doc["line"] as (n: number) => AnyObj)(start))["from"] as number;
        (targetView["dispatch"] as (tr: unknown) => void)({
          selection: { anchor: startFrom, head: startFrom },
          scrollIntoView: true,
        });
        if (typeof targetView["focus"] === "function") (targetView["focus"] as () => void)();
        return "ok";
      },
      { start: startLine, end: endLine },
    );

    if (scrollResult !== "ok") return scrollResult;
    await page.waitForTimeout(500);


    await page.keyboard.press("Home");
    await page.waitForTimeout(150);

    if (startLine === endLine) {
      await page.keyboard.press("Shift+End");
      await page.keyboard.press("Shift+End");
    } else {
      const lineDelta = endLine - startLine;
      for (let i = 0; i < lineDelta; i++) {
        await page.keyboard.press("Shift+ArrowDown");
      }
      await page.keyboard.press("Shift+End");
      await page.keyboard.press("Shift+End");
    }

    await page.waitForTimeout(300);
    await page.keyboard.press(isMac ? "Meta+Shift+C" : "Control+Shift+C");
    await page.waitForTimeout(1000);

    const commentBox = page
      .locator('textarea[placeholder*="Add"], textarea[placeholder*="comment"], textarea[placeholder*="Leave"], textarea[placeholder*="Write"], .review-panel textarea')
      .last();
    await commentBox.waitFor({ timeout: 5000 });

    await commentBox.fill(commentText);
    await page.waitForTimeout(300);
    await commentBox.click({ force: true });
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");

    await page.waitForTimeout(2000);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await editor.click({ position: { x: 100, y: 100 }, force: true });
    await page.waitForTimeout(500);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    return `Successfully posted comment on ${rangeLabel}.`;
  } catch (error) {
    return `Error posting comment on range: ${error}`;
  }
}
