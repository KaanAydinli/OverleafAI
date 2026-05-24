import type { Locator, Page } from "playwright";

const FILE_TREE_TAB_SELECTORS = [
  "#ide-rail-tabs-tab-file-tree",
  '[data-rr-ui-event-key="file-tree"]',
  'button[aria-controls="ide-rail-tabs-tabpane-file-tree"]',
];

const REVIEW_PANEL_TAB_SELECTORS = [
  "#ide-rail-tabs-tab-review-panel",
  '[data-rr-ui-event-key="review-panel"]',
  'button[aria-controls="ide-rail-tabs-tabpane-review-panel"]',
  'button:has(span.material-symbols:text-is("rate_review"))',
];

const EDITOR_SELECTOR = ".cm-content[contenteditable='true']";

async function findTab(page: Page, selectors: string[]): Promise<Locator | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      await locator.waitFor({ state: "attached", timeout: 5000 });
      return locator;
    } catch {

    }
  }
  return null;
}

async function isTabOpen(tab: Locator): Promise<boolean> {
  const [ariaSelected, classes] = await Promise.all([
    tab.getAttribute("aria-selected").catch(() => null),
    tab.getAttribute("class").catch(() => null),
  ]);
  if (ariaSelected === "true") return true;
  if (classes && /\bopen-rail\b/.test(classes)) return true;
  return false;
}

async function ensureTabOpen(tab: Locator): Promise<void> {
  if (await isTabOpen(tab)) return;
  await tab.click({ timeout: 10000 });

  for (let i = 0; i < 20; i++) {
    if (await isTabOpen(tab)) return;
    await tab.page().waitForTimeout(150);
  }
}

export async function selectFile(page: Page, fileName: string): Promise<string> {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return "Error: fileName is required";
  }

  try {
    const fileTreeTab = await findTab(page, FILE_TREE_TAB_SELECTORS);
    if (!fileTreeTab) {
      return "Error: Could not find the file tree tab button.";
    }
    await ensureTabOpen(fileTreeTab);

    const fileItem = page
      .locator(`li[role="treeitem"][aria-label="${trimmed}"]`)
      .first();

    try {
      await fileItem.waitFor({ state: "visible", timeout: 10000 });
    } catch {
      return `Error: Could not find file "${trimmed}" in the file tree.`;
    }

    const fileButton = fileItem.locator(".file-tree-entity-button").first();
    if ((await fileButton.count()) > 0) {
      await fileButton.click({ timeout: 10000 });
    } else {
      await fileItem.click({ timeout: 10000 });
    }

    await page.locator(EDITOR_SELECTOR).first().waitFor({ timeout: 20000 });

    const reviewPanelTab = await findTab(page, REVIEW_PANEL_TAB_SELECTORS);
    if (!reviewPanelTab) {
      return `Error: Opened "${trimmed}" but could not find the review panel tab.`;
    }
    await ensureTabOpen(reviewPanelTab);

    return `Successfully opened file: ${trimmed}`;
  } catch (error) {
    return `Error selecting file ${trimmed}: ${error}`;
  }
}
