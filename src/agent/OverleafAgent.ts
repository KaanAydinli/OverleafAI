import Anthropic from "@anthropic-ai/sdk";
import { tools as toolDefinitions } from "./toolExecutor.js";
import { getSystemPrompt } from "./systemprompt.js";
import type { CommentThread } from "../overleaf/readComments.js";

type ToolExecutor = (name: string, args: string | undefined) => Promise<string>;

interface ClaudeContentBlock {
  type: string;
  id?: string;
  name?: string;
  text?: string;
  input?: unknown;
}

interface OverleafAgentOptions {
  client?: Anthropic;
  toolExecutor?: ToolExecutor;
  model?: string;
  maxToolCalls?: number;
}

export interface ReviewerScore {
  author: string;
  score: number;
  rationale: string;
}

export interface AgentReviewResult {
  toolCallCount: number;
  finalText: string;
  reviewerScores: ReviewerScore[];
}

const DEFAULT_MAX_TOOL_CALLS = 10;

function resolveMaxToolCalls(explicit?: number): number {
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    return Math.floor(explicit);
  }

  const raw = process.env.MAX_TOOL_CALLS;
  if (raw && raw.trim().length > 0) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return DEFAULT_MAX_TOOL_CALLS;
}

export class OverleafAgent {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly toolExecutor: ToolExecutor;
  private readonly maxToolCalls: number;

  constructor(options: OverleafAgentOptions = {}) {
    this.toolExecutor =
      options.toolExecutor ??
      (async () => "Error: Tool executor is not configured for this session.");

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!options.client && !apiKey) {
      throw new Error("ANTHROPIC_API_KEY is missing in environment.");
    }

    this.client = options.client ?? new Anthropic({ apiKey });
    this.model =
      options.model ??
      process.env.CLAUDE_MODEL ??
      process.env.ANTHROPIC_MODEL ??
      "claude-sonnet-4-5";
    this.maxToolCalls = resolveMaxToolCalls(options.maxToolCalls);
  }

  async processReview(
    paperText: string,
    commentsText: string,
    humanReviewerThreads: CommentThread[] = [],
  ): Promise<AgentReviewResult> {
    const hasExistingComments = !commentsText.includes("No comments found");
    const hasHumanReviewers = humanReviewerThreads.length > 0;

    const uniqueReviewers = Array.from(
      new Set(humanReviewerThreads.map((t) => t.mainComment.author)),
    );

    const reviewerSnapshot = hasHumanReviewers
      ? `=== HUMAN REVIEWER COMMENT SNAPSHOT (taken before your review; excludes AI Reviewer) ===
${humanReviewerThreads
  .map((thread) => {
    const ctx = thread.lineContext;
    const prevLine =
      ctx.previousLineText === null
        ? `      Line ${ctx.currentLineNumber - 1}: (start of document)`
        : `      Line ${ctx.previousLineNumber}: ${JSON.stringify(ctx.previousLineText)}`;
    const curLine = `    > Line ${ctx.currentLineNumber} (ANCHOR — this is what the comment is about): ${JSON.stringify(ctx.currentLineText)}`;
    const nextLine =
      ctx.nextLineText === null
        ? `      Line ${ctx.currentLineNumber + 1}: (end of document)`
        : `      Line ${ctx.nextLineNumber}: ${JSON.stringify(ctx.nextLineText)}`;
    return `Thread (commentIndex=${thread.domIndex}, anchored on line ${thread.lineNumber}, by ${thread.mainComment.author}):
  Comment text: ${thread.mainComment.text}
  Anchor context:
${prevLine}
${curLine}
${nextLine}`;
  })
  .join("\n\n")}

When calling 'post_response_comment', use the 'commentIndex' value shown for each thread above — these indices match the actual comments in Overleaf. Do NOT renumber threads sequentially.

Reviewers to score: ${uniqueReviewers.join(", ")}`
      : "";

    const baseInstruction = hasExistingComments
      ? `Review the following paper and its existing comments.

Guidelines:
1. Engage selectively. Reply via 'post_response_comment' ONLY to threads where you have a substantive, paper-grounded point to add — agreement-with-refinement, a concrete pushback, or a stronger reformulation. Skip threads where you would only add filler or restate the original comment.
2. After replying, use 'post_comment' sparingly for the most critical gaps no thread covers.
3. Quality over quantity. Aim for at most ~5–7 high-signal interactions in total across replies and new comments. Stop early if you have nothing meaningful left to add — do not pad to look thorough.`
      : `Review the following paper. There are no existing comments yet. Use 'post_comment' sparingly — at most ~5 high-signal comments — on specific lines where intervention is genuinely necessary.`;

    const scoringInstruction = hasHumanReviewers
      ? `

REQUIRED FINAL STEP: After you finish all tool calls, you MUST output a final text block (no tool call, no other text after it) titled exactly:
[Reviewer Scores]
On separate lines, score EVERY human reviewer listed below out of 10 based on the quality, specificity, and usefulness of their comments. Use this exact format per line:
- <author>: <score>/10 — <one-sentence rationale grounded in their actual comments>
Score every listed reviewer exactly once. Do NOT include yourself or any "AI Reviewer" entries. The scoring block is REQUIRED — omitting it is a failure.`
      : "";

    const instruction = `${baseInstruction}${scoringInstruction}

=== PAPER CONTENT ===
${paperText}

=== EXISTING COMMENTS ===
${commentsText}${reviewerSnapshot ? `\n\n${reviewerSnapshot}` : ""}`;

    const cachedSystem = [
      {
        type: "text" as const,
        text: getSystemPrompt(),
        cache_control: { type: "ephemeral" as const },
      },
    ];

    const toolsArr = toolDefinitions as any[];
    const cachedTools = toolsArr.map((tool, i) =>
      i === toolsArr.length - 1
        ? { ...tool, cache_control: { type: "ephemeral" as const } }
        : tool,
    );

    const initialUserContent = [
      {
        type: "text" as const,
        text: instruction,
        cache_control: { type: "ephemeral" as const },
      },
    ];

    const messages: unknown[] = [{ role: "user", content: initialUserContent }];
    let toolCallCount = 0;
    let finalText = "";

    while (true) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1200,
        system: cachedSystem as any,
        tools: cachedTools as any,
        messages: messages as Anthropic.MessageParam[],
      });

      const blocks = response.content as ClaudeContentBlock[];
      const responseText = blocks
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text as string)
        .join("\n")
        .trim();

      if (responseText) {
        finalText = responseText;
      }

      const toolUses = blocks.filter(
        (block) =>
          block.type === "tool_use" &&
          typeof block.id === "string" &&
          typeof block.name === "string",
      );
      if (toolUses.length === 0) {
        break;
      }

      toolCallCount += toolUses.length;
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
        is_error?: boolean;
      }> = [];

      for (const toolUse of toolUses) {
        let resultData: string;

        try {
          const argsStr = toolUse.input ? JSON.stringify(toolUse.input) : undefined;
          resultData = await this.toolExecutor(toolUse.name as string, argsStr);
        } catch (error) {
          resultData = `Error executing ${toolUse.name as string}: ${String(error)}`;

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id as string,
            content: resultData,
            is_error: true,
          });

          continue;
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id as string,
          content: resultData,
        });
      }

      messages.push({ role: "user", content: toolResults });

      if (toolCallCount >= this.maxToolCalls) {
        console.log(
          `[Agent] Reached MAX_TOOL_CALLS cap (${this.maxToolCalls}). Stopping further tool calls.`,
        );
        break;
      }
    }

    let reviewerScores = parseReviewerScores(finalText, uniqueReviewers);

    if (hasHumanReviewers && reviewerScores.length === 0) {
      messages.push({
        role: "user",
        content: `You did not output the required [Reviewer Scores] block. Output it NOW as plain text only — no tool calls, no other commentary. Score every reviewer listed earlier (${uniqueReviewers.join(", ")}) using exactly this format:
[Reviewer Scores]
- <author>: <score>/10 — <one-sentence rationale>`,
      });

      const followUp = await this.client.messages.create({
        model: this.model,
        max_tokens: 600,
        system: cachedSystem as any,
        messages: messages as Anthropic.MessageParam[],
      });

      const followUpBlocks = followUp.content as ClaudeContentBlock[];
      const followUpText = followUpBlocks
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text as string)
        .join("\n")
        .trim();

      if (followUpText) {
        finalText = finalText
          ? `${finalText}\n\n${followUpText}`
          : followUpText;
        reviewerScores = parseReviewerScores(followUpText, uniqueReviewers);
      }
    }

    logReviewerScores(reviewerScores, uniqueReviewers);

    return {
      toolCallCount,
      finalText,
      reviewerScores,
    };
  }
}

function logReviewerScores(
  scores: ReviewerScore[],
  expected: string[],
): void {
  if (expected.length === 0) {
    console.log("\n--- Reviewer Scores ---");
    console.log("[Agent Action] -> No human reviewers to score.");
    return;
  }

  console.log("\n--- Reviewer Scores ---");
  if (scores.length === 0) {
    console.log("[Agent Action] -> No scores produced (parsing failed).");
    return;
  }

  for (const s of scores) {
    console.log(`[Agent Action] -> ${s.author}: ${s.score}/10 — ${s.rationale}`);
  }

  const average = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
  console.log(`[Agent Action] -> Average: ${average.toFixed(2)}/10`);

  const missing = expected.filter(
    (name) => !scores.some((s) => s.author === name),
  );
  if (missing.length > 0) {
    console.log(`[Agent Action] -> Missing scores for: ${missing.join(", ")}`);
  }
}

function parseReviewerScores(
  finalText: string,
  knownReviewers: string[],
): ReviewerScore[] {
  if (!finalText) return [];

  const blockMatch = finalText.match(/\[Reviewer Scores\]\s*([\s\S]*)$/i);
  if (!blockMatch) return [];

  const block = blockMatch[1];
  const lineRegex = /^\s*-\s*(.+?):\s*(\d{1,2})\s*\/\s*10\s*[—\-–]\s*(.+?)\s*$/gm;
  const scores: ReviewerScore[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = lineRegex.exec(block)) !== null) {
    const author = match[1].trim();
    const score = Math.min(10, Math.max(0, parseInt(match[2], 10)));
    const rationale = match[3].trim();

    if (seen.has(author)) continue;
    if (author.toLowerCase() === "ai reviewer") continue;
    if (knownReviewers.length > 0 && !knownReviewers.includes(author)) continue;

    seen.add(author);
    scores.push({ author, score, rationale });
  }

  return scores;
}
