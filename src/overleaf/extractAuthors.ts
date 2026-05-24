import { setupBrowser } from "../browser/session.js";
import { parseAuthorsFromLatex } from "../latex/parseAuthors.js";
import { goToProject } from "./goToProject.js";
import { getFullDocText } from "./getFullDocText.js";

export async function extractAuthorsFromOverleaf(
  projectNameOrLink: string,
): Promise<string[]> {
  const { page, context } = await setupBrowser();
  try {
    const navResult = await goToProject(page, projectNameOrLink);
    if (navResult.startsWith("Error")) {
      throw new Error(navResult);
    }
    const text = await getFullDocText(page);
    return parseAuthorsFromLatex(text);
  } finally {
    await context.close();
  }
}
