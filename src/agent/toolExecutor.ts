import type { Page } from "playwright";
import { toolDefinitions } from "./tools.js";
import { postComment } from "../overleaf/postComment.js";
import { postCommentOnRange } from "../overleaf/postCommentOnRange.js";
import { postResponseComment } from "../overleaf/postResponseComment.js";

export const tools = toolDefinitions;

interface PostCommentArgs {
  quoteText: string;
  commentText: string;
}

interface PostCommentOnRangeArgs {
  startLine: number;
  endLine: number;
  commentText: string;
}

interface PostResponseCommentArgs {
  commentIndex: number;
  responseText: string;
}

function parseArgs(args: string | undefined): Record<string, unknown> {
  if (!args) return {};

  try {
    const parsed: unknown = JSON.parse(args);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}

function toPostCommentArgs(parsed: Record<string, unknown>): PostCommentArgs {
  return {
    quoteText: String(parsed.quoteText ?? ""),
    commentText: String(parsed.commentText ?? ""),
  };
}

function toPostCommentOnRangeArgs(parsed: Record<string, unknown>): PostCommentOnRangeArgs {
  return {
    startLine: Number(parsed.startLine),
    endLine: Number(parsed.endLine),
    commentText: String(parsed.commentText ?? ""),
  };
}

function toPostResponseCommentArgs(
  parsed: Record<string, unknown>,
): PostResponseCommentArgs {
  return {
    commentIndex: Number(parsed.commentIndex),
    responseText: String(parsed.responseText ?? ""),
  };
}

export const executeTool = async (
  page: Page,
  name: string,
  args: string | undefined,
): Promise<string> => {
  const parsed = parseArgs(args);

  switch (name) {
    case "post_comment": {
      const params = toPostCommentArgs(parsed);
      return await postComment(page, params.quoteText, params.commentText);
    }
    case "post_comment_on_range": {
      const params = toPostCommentOnRangeArgs(parsed);
      return await postCommentOnRange(page, params.startLine, params.endLine, params.commentText);
    }
    case "post_response_comment": {
      const params = toPostResponseCommentArgs(parsed);
      return await postResponseComment(page, params.commentIndex, params.responseText);
    }
    default:
      return `Error: Unknown function ${name}`;
  }
};

export function createToolExecutor(page: Page) {
  return async (name: string, args: string | undefined): Promise<string> =>
    executeTool(page, name, args);
}
