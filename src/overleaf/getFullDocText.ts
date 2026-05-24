import type { Page } from "playwright";

export async function getFullDocText(page: Page): Promise<string> {
  const editor = page.locator(".cm-content[contenteditable='true']");
  await editor.waitFor({ timeout: 5000 });

  const text = await page.evaluate(() => {
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
    const toStr = doc["toString"] as () => string;
    return toStr.call(doc);
  });

  if (typeof text === "string" && text.length > 0) {
    return text;
  }

  const lines = await page.locator(".cm-line").allTextContents();
  return lines.join("\n");
}
