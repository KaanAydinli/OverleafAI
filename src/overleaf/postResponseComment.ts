import type { Locator, Page } from "playwright";

export async function postResponseComment(
  page: Page,
  commentIndex: number,
  responseText: string,
): Promise<string> {
  try {
    console.log(`\n--- Posting response on comment ${commentIndex} ---`);
    console.log(`[Agent Action] -> Response Text: "${responseText}"`);

    const commentEntries = page.locator(".review-panel-entry-comment");
    const count = await commentEntries.count();

    if (count === 0) {
      return "Error: No comments found.";
    }

    if (commentIndex < 1 || commentIndex > count) {
      return `Error: Comment index ${commentIndex} is out of range (1-${count}).`;
    }

    const targetComment = commentEntries.nth(commentIndex - 1);
    await targetComment.scrollIntoViewIfNeeded().catch(() => {});

    const indicator = targetComment.locator(".review-panel-entry-indicator").first();
    if ((await indicator.count()) > 0) {
      await indicator.click({ force: true }).catch(() => {});
      await page.waitForTimeout(200);
    }

    const replyTextarea = targetComment.locator(
      'textarea.review-panel-comment-input[placeholder="Reply"]',
    );

    if ((await replyTextarea.count()) === 0) {
      return `Error: Could not find reply textarea for comment ${commentIndex}.`;
    }

    const initialReplyCount = await targetComment
      .locator(".review-panel-comment-wrapper")
      .count();

    await replyTextarea.click({ force: true });
    await page.waitForTimeout(200);
    await replyTextarea.focus();

    await replyTextarea.evaluate((el) => {
      (el as HTMLTextAreaElement).value = "";
    });

    await page.keyboard.type(responseText, { delay: 10 });
    await page.waitForTimeout(300);

    const submittedViaButton = await tryClickSubmitButton(targetComment);
    if (submittedViaButton) {
      await page.waitForTimeout(800);
    }

    if (
      await isReplyStillUnsent(
        targetComment,
        replyTextarea,
        responseText,
        initialReplyCount,
      )
    ) {
      await replyTextarea.focus();
      const modifier = process.platform === "darwin" ? "Meta" : "Control";
      await page.keyboard.press(`${modifier}+Enter`);
      await page.waitForTimeout(800);
    }

    if (
      await isReplyStillUnsent(
        targetComment,
        replyTextarea,
        responseText,
        initialReplyCount,
      )
    ) {
      await replyTextarea.focus();
      await replyTextarea.press("Enter");
      await page.waitForTimeout(800);
    }

    if (
      await isReplyStillUnsent(
        targetComment,
        replyTextarea,
        responseText,
        initialReplyCount,
      )
    ) {
      const formSubmitted = await submitClosestForm(replyTextarea);
      if (formSubmitted) {
        await page.waitForTimeout(800);
      }
    }

    if (
      await isReplyStillUnsent(
        targetComment,
        replyTextarea,
        responseText,
        initialReplyCount,
      )
    ) {
      return `Error: Reply did not post for comment ${commentIndex}. The textarea still contains the response or no new reply appeared.`;
    }

    return `Successfully posted response to comment ${commentIndex}.`;
  } catch (error) {
    return `Error posting response: ${error}`;
  }
}

async function isReplyStillUnsent(
  targetComment: Locator,
  textarea: Locator,
  expectedText: string,
  initialReplyCount: number,
): Promise<boolean> {
  const newReplyCount = await targetComment
    .locator(".review-panel-comment-wrapper")
    .count()
    .catch(() => initialReplyCount);

  if (newReplyCount > initialReplyCount) {
    return false;
  }

  try {
    const value = await textarea.inputValue();
    return value.trim() === expectedText.trim() && expectedText.length > 0;
  } catch {
    return true;
  }
}

async function tryClickSubmitButton(targetComment: Locator): Promise<boolean> {
  const candidates = [
    'button[type="submit"]',
    'button:has-text("Reply")',
    'button:has-text("Send")',
    'button:has-text("Post")',
    'button:has-text("Comment")',
  ];

  for (const selector of candidates) {
    const buttons = targetComment.locator(selector);
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      if (!(await button.isVisible().catch(() => false))) continue;
      if (await button.isDisabled().catch(() => false)) continue;

      await button.click({ force: true }).catch(() => {});
      return true;
    }
  }

  return false;
}

async function submitClosestForm(textarea: Locator): Promise<boolean> {
  return await textarea
    .evaluate((el) => {
      const form = (el as HTMLElement).closest("form");
      if (!form) return false;
      if (typeof (form as HTMLFormElement).requestSubmit === "function") {
        (form as HTMLFormElement).requestSubmit();
      } else {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
      return true;
    })
    .catch(() => false);
}
