import type { Page } from "playwright";

const OVERLEAF_EDITOR_SELECTOR = ".cm-content[contenteditable='true']";
const OVERLEAF_JOIN_PROJECT_BUTTON_SELECTOR =
  "button:has-text('OK, join project'), button[type='submit']:has-text('join project')";
const OVERLEAF_READY_SELECTOR = `${OVERLEAF_EDITOR_SELECTOR}, ${OVERLEAF_JOIN_PROJECT_BUTTON_SELECTOR}`;

function isOverleafProjectLink(value: string): boolean {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const isOverleafHost = host === "overleaf.com" || host.endsWith(".overleaf.com");
    if (!isOverleafHost) {
      return false;
    }

    const path = parsed.pathname.trim();
    if (!path || path === "/") {
      return false;
    }

    if (path.startsWith("/project/")) {
      return true;
    }

    const segments = path.split("/").filter(Boolean);
    if (segments.length !== 1) {
      return false;
    }

    const [singleSegment] = segments;
    return /^[A-Za-z0-9]+$/.test(singleSegment);
  } catch {
    return false;
  }
}

export async function goToProject(
  page: Page,
  projectNameOrLink: string,
): Promise<string> {
  try {
    if (isOverleafProjectLink(projectNameOrLink)) {
      await page.goto(projectNameOrLink);

      // Shared links can open an invite page first, so handle join prompt before editor access.
      await page.waitForSelector(OVERLEAF_READY_SELECTOR, { timeout: 20000 });

      const joinProjectButton = page
        .locator(OVERLEAF_JOIN_PROJECT_BUTTON_SELECTOR)
        .first();

      // If the join button does not exist, we assume the user is already in the project.
      const joinButtonExists = (await joinProjectButton.count()) > 0;
      if (joinButtonExists && (await joinProjectButton.isVisible().catch(() => false))) {
        await joinProjectButton.click({ timeout: 10000 });
      }

      const editor = page.locator(OVERLEAF_EDITOR_SELECTOR);
      await editor.waitFor({ timeout: 20000 });

      return `Successfully opened project link: ${projectNameOrLink}`;
    }

    await page.goto("https://www.overleaf.com/project");

    const projectLink = page
      .locator("a.dash-cell-name")
      .filter({ hasText: new RegExp(`^${projectNameOrLink}$`, "i") })
      .first();

    const fallbackLink = page
      .locator(`a:text-is("${projectNameOrLink}")`)
      .first();

    if (await projectLink.isVisible()) {
      await projectLink.click();
    } else if (await fallbackLink.isVisible()) {
      await fallbackLink.click();
    } else {
      return `Error: Could not find project named "${projectNameOrLink}".`;
    }

    await page.waitForURL(/\/project\/.+/, { timeout: 20000 });
    const editor = page.locator(OVERLEAF_EDITOR_SELECTOR);
    await editor.waitFor({ timeout: 20000 });

    return `Successfully opened project: ${projectNameOrLink}`;
  } catch (error) {
    return `Error opening project ${projectNameOrLink}: ${error}`;
  }
}
