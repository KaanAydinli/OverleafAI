import type { Page } from "playwright";

const SETTLE_MS = 200;
const POST_DIALOG_WAIT_MS = 4000;
const POST_VERIFY_WAIT_MS = 8000;
const RENDER_WAIT_MS = 4000;
const MAX_ATTEMPTS = 2;

interface QuoteMatch {
  from: number;
  to: number;
  matchedText: string;
}

async function snapshotCommentPositions(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const els = Array.from(
      document.querySelectorAll(".review-panel-entry-comment"),
    );
    return els
      .map((e) => e.getAttribute("data-pos") || "")
      .filter((p) => p.length > 0);
  });
}

async function waitForNewComment(
  page: Page,
  before: string[],
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const newPos = await page.evaluate((existing: string[]) => {
      const set = new Set(existing);
      const els = Array.from(
        document.querySelectorAll(".review-panel-entry-comment"),
      );
      for (const e of els) {
        const p = e.getAttribute("data-pos") || "";
        if (p && !set.has(p)) return p;
      }
      return null;
    }, before);
    if (newPos) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

function normalizeForMatch(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function isCommentTextPresent(page: Page, text: string): Promise<boolean> {
  const needle = normalizeForMatch(text);
  if (!needle) return false;
  return await page.evaluate((q: string) => {
    const norm = (s: string) => s.replace(/\s+/g, " ").trim();
    const bodies = Array.from(
      document.querySelectorAll(".review-panel-comment-body"),
    );
    return bodies.some((b) => norm(b.textContent || "").includes(q));
  }, needle);
}

async function findQuoteInDocument(
  page: Page,
  quote: string,
): Promise<QuoteMatch | null> {
  return await page.evaluate(({ q }: { q: string }) => {
    type AnyObj = Record<string, unknown>;
    const contentEl = document.querySelector(
      ".cm-content[contenteditable='true']",
    ) as AnyObj | null;
    let view = (contentEl?.["cmView"] as AnyObj | undefined)?.["view"] as
      | AnyObj
      | undefined;
    if (!view) {
      const editorEl = document.querySelector(".cm-editor") as AnyObj | null;
      if (editorEl) {
        for (const key of Object.getOwnPropertyNames(editorEl)) {
          const v = editorEl[key] as AnyObj | undefined;
          if (v && typeof v["dispatch"] === "function" && v["state"]) {
            view = v;
            break;
          }
        }
      }
    }
    if (!view) return null;

    const doc = (view["state"] as AnyObj)["doc"] as AnyObj;
    const docText = (doc["toString"] as () => string).call(doc);

    const exactIdx = docText.indexOf(q);
    if (exactIdx >= 0) {
      return {
        from: exactIdx,
        to: exactIdx + q.length,
        matchedText: docText.slice(exactIdx, exactIdx + q.length),
      };
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const flexible = escaped.replace(/\s+/g, "\\s+");
    try {
      const re = new RegExp(flexible);
      const m = docText.match(re);
      if (m && typeof m.index === "number") {
        return {
          from: m.index,
          to: m.index + m[0].length,
          matchedText: m[0],
        };
      }
    } catch {

    }
    return null;
  }, { q: quote });
}

async function scrollPositionIntoView(
  page: Page,
  position: number,
): Promise<string> {
  return await page.evaluate(({ pos }: { pos: number }) => {
    type AnyObj = Record<string, unknown>;
    const contentEl = document.querySelector(
      ".cm-content[contenteditable='true']",
    ) as AnyObj | null;
    let view = (contentEl?.["cmView"] as AnyObj | undefined)?.["view"] as
      | AnyObj
      | undefined;
    if (!view) {
      const editorEl = document.querySelector(".cm-editor") as AnyObj | null;
      if (editorEl) {
        for (const key of Object.getOwnPropertyNames(editorEl)) {
          const v = editorEl[key] as AnyObj | undefined;
          if (v && typeof v["dispatch"] === "function" && v["state"]) {
            view = v;
            break;
          }
        }
      }
    }
    if (!view) return "Error: Could not find CodeMirror view.";

    (view["dispatch"] as (tr: unknown) => void)({
      selection: { anchor: pos, head: pos },
      scrollIntoView: true,
    });
    if (typeof view["focus"] === "function") (view["focus"] as () => void)();
    return "ok";
  }, { pos: position });
}


async function waitForPositionRendered(
  page: Page,
  position: number,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rendered = await page.evaluate(({ pos }: { pos: number }) => {
      type AnyObj = Record<string, unknown>;
      const contentEl = document.querySelector(
        ".cm-content[contenteditable='true']",
      ) as AnyObj | null;
      let view = (contentEl?.["cmView"] as AnyObj | undefined)?.["view"] as
        | AnyObj
        | undefined;
      if (!view) {
        const editorEl = document.querySelector(".cm-editor") as AnyObj | null;
        if (editorEl) {
          for (const key of Object.getOwnPropertyNames(editorEl)) {
            const v = editorEl[key] as AnyObj | undefined;
            if (v && typeof v["dispatch"] === "function" && v["state"]) {
              view = v;
              break;
            }
          }
        }
      }
      if (!view) return false;
      try {
        const coords = (view["coordsAtPos"] as (p: number) => unknown).call(
          view,
          pos,
        );
        return coords !== null && coords !== undefined;
      } catch {
        return false;
      }
    }, { pos: position });
    if (rendered) return true;
    await page.waitForTimeout(150);
  }
  return false;
}


async function setSelectionWithDomRange(
  page: Page,
  fromPos: number,
  toPos: number,
): Promise<string> {
  return await page.evaluate(
    ({ from, to }: { from: number; to: number }) => {
      type AnyObj = Record<string, unknown>;
      const contentEl = document.querySelector(
        ".cm-content[contenteditable='true']",
      ) as HTMLElement | null;
      if (!contentEl) return "Error: cm-content not found.";

      let view = ((contentEl as unknown) as AnyObj)["cmView"] as
        | AnyObj
        | undefined;
      view = (view?.["view"] as AnyObj | undefined) ?? undefined;
      if (!view) {
        const editorEl = document.querySelector(".cm-editor") as AnyObj | null;
        if (editorEl) {
          for (const key of Object.getOwnPropertyNames(editorEl)) {
            const v = editorEl[key] as AnyObj | undefined;
            if (v && typeof v["dispatch"] === "function" && v["state"]) {
              view = v;
              break;
            }
          }
        }
      }
      if (!view) return "Error: Could not find CodeMirror view.";

      (view["dispatch"] as (tr: unknown) => void)({
        selection: { anchor: from, head: to },
      });
      if (typeof view["focus"] === "function") (view["focus"] as () => void)();

      try {
        const domAtPos = view["domAtPos"] as (
          pos: number,
        ) => { node: Node; offset: number };
        const fromInfo = domAtPos.call(view, from);
        const toInfo = domAtPos.call(view, to);

        const range = document.createRange();
        range.setStart(fromInfo.node, fromInfo.offset);
        range.setEnd(toInfo.node, toInfo.offset);

        const sel = window.getSelection();
        if (!sel) return "Error: window.getSelection() unavailable.";
        sel.removeAllRanges();
        sel.addRange(range);

        if (sel.toString().length === 0) {
          return "Error: DOM range installed but resulting selection is empty.";
        }
      } catch (e) {
        return `Error: failed to install DOM Range — ${String(e)}`;
      }
      return "ok";
    },
    { from: fromPos, to: toPos },
  );
}

async function dispatchCommentShortcutViaCM6(page: Page): Promise<void> {
  await page.evaluate(() => {
    type AnyObj = Record<string, unknown>;
    const contentEl = document.querySelector(
      ".cm-content[contenteditable='true']",
    ) as HTMLElement | null;
    if (!contentEl) return;

    let view = ((contentEl as unknown) as AnyObj)["cmView"] as AnyObj | undefined;
    view = (view?.["view"] as AnyObj | undefined) ?? undefined;
    if (!view) {
      const editorEl = document.querySelector(".cm-editor") as AnyObj | null;
      if (editorEl) {
        for (const key of Object.getOwnPropertyNames(editorEl)) {
          const v = editorEl[key] as AnyObj | undefined;
          if (v && typeof v["dispatch"] === "function" && v["state"]) {
            view = v;
            break;
          }
        }
      }
    }

    const targetEl =
      ((view?.["contentDOM"] as HTMLElement | undefined) ?? contentEl);

    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    const evInit: KeyboardEventInit = {
      key: "c",
      code: "KeyC",
      keyCode: 67,
      which: 67,
      ctrlKey: !isMac,
      metaKey: isMac,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
      composed: true,
    } as KeyboardEventInit;

    targetEl.dispatchEvent(new KeyboardEvent("keydown", evInit));
    targetEl.dispatchEvent(new KeyboardEvent("keyup", evInit));
  });
}

export async function postComment(
  page: Page,
  quoteText: string,
  commentText: string,
): Promise<string> {
  const preview =
    quoteText.length > 80 ? `${quoteText.slice(0, 80)}…` : quoteText;
  console.log(`\n--- Posting comment on quote: "${preview}" ---`);
  console.log(`[Agent Action] -> Comment Text: "${commentText}"`);

  if (!quoteText || quoteText.trim().length < 8) {
    return `Error: quoteText is too short to locate uniquely. Provide at least a distinctive 8+ character phrase copied from the paper.`;
  }

  const isMac = process.platform === "darwin";
  const playwrightShortcut = isMac ? "Meta+Shift+C" : "Control+Shift+C";

  try {
    const editor = page.locator(".cm-content[contenteditable='true']");
    await editor.waitFor({ timeout: 5000 });
    await page.waitForTimeout(SETTLE_MS);

    const match = await findQuoteInDocument(page, quoteText);
    if (!match) {
      return `Error: Could not locate the quote in the paper. Copy text VERBATIM from the paper (not paraphrased). Tried quote: "${preview}"`;
    }

    if (await isCommentTextPresent(page, commentText)) {
      const matchPreview =
        match.matchedText.length > 60
          ? `${match.matchedText.slice(0, 60)}…`
          : match.matchedText;
      console.log(
        `[postComment] Comment text already present in review panel — skipping post.`,
      );
      return `Successfully posted comment on quote: "${matchPreview}" (already present)`;
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const before = await snapshotCommentPositions(page);

      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(120);


      const scrollResult = await scrollPositionIntoView(page, match.from);
      if (scrollResult !== "ok") return scrollResult;

  
      const rendered = await waitForPositionRendered(
        page,
        match.from,
        RENDER_WAIT_MS,
      );
      if (!rendered) {
        console.log(
          `[postComment] Attempt ${attempt}/${MAX_ATTEMPTS}: matched position did not render in DOM.`,
        );
        continue;
      }

      await page.waitForTimeout(350);

      const selResult = await setSelectionWithDomRange(
        page,
        match.from,
        match.to,
      );
      if (selResult !== "ok") {
        console.log(
          `[postComment] Attempt ${attempt}/${MAX_ATTEMPTS}: ${selResult}`,
        );
        continue;
      }

      await dispatchCommentShortcutViaCM6(page);

      const commentBox = page
        .locator(
          'textarea[placeholder*="Add"], textarea[placeholder*="comment"], textarea[placeholder*="Leave"], textarea[placeholder*="Write"], .review-panel textarea',
        )
        .last();

      let dialogOpened = true;
      try {
        await commentBox.waitFor({ timeout: 2000 });
      } catch {
        dialogOpened = false;
      }

      if (!dialogOpened) {
        console.log(
          `[postComment] Attempt ${attempt}: synthetic shortcut did not open dialog; falling back to physical keystroke.`,
        );
        await setSelectionWithDomRange(page, match.from, match.to);
        await page.waitForTimeout(150);
        await page.keyboard.press(playwrightShortcut);
        try {
          await commentBox.waitFor({ timeout: POST_DIALOG_WAIT_MS });
          dialogOpened = true;
        } catch {
          dialogOpened = false;
        }
      }

      if (!dialogOpened) {
        console.log(
          `[postComment] Attempt ${attempt}/${MAX_ATTEMPTS}: comment dialog never opened.`,
        );
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(400);
        continue;
      }


      await commentBox.focus();
      await page.waitForTimeout(150);
      await commentBox.fill(commentText);
      await page.waitForTimeout(200);
      await commentBox.click({ force: true });
      await page.keyboard.press("Enter");

      const appeared = await waitForNewComment(
        page,
        before,
        POST_VERIFY_WAIT_MS,
      );

      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(200);

      const matchPreview =
        match.matchedText.length > 60
          ? `${match.matchedText.slice(0, 60)}…`
          : match.matchedText;

      if (appeared) {
        return `Successfully posted comment on quote: "${matchPreview}"`;
      }

      if (await isCommentTextPresent(page, commentText)) {
        console.log(
          `[postComment] Attempt ${attempt}/${MAX_ATTEMPTS}: data-pos diff missed it, but comment text is in the review panel — treating as success.`,
        );
        return `Successfully posted comment on quote: "${matchPreview}"`;
      }

      console.log(
        `[postComment] Attempt ${attempt}/${MAX_ATTEMPTS}: dialog opened but no new entry appeared in review panel.`,
      );
    }

    return `Error: Failed to post comment after ${MAX_ATTEMPTS} attempts. Comment was not added to the review panel — do NOT retry this quote; move on to a different one.`;
  } catch (error) {
    return `Error posting comment: ${error}`;
  }
}
