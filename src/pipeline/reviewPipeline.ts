import { setupBrowser, cleanupBrowser } from "../browser/session.js";
import { goToProject } from "../overleaf/goToProject.js";
import { selectFile } from "../overleaf/selectFile.js";
import { readPaper } from "../overleaf/readPaper.js";
import {
  readCommentThreads,
  formatCommentThreads,
  filterOutAiReviewer,
  type CommentThread,
} from "../overleaf/readComments.js";
import { createToolExecutor } from "../agent/toolExecutor.js";
import { OverleafAgent, type AgentReviewResult } from "../agent/OverleafAgent.js";

interface ReviewAgent {
  processReview(
    paperText: string,
    commentsText: string,
    humanReviewerThreads: CommentThread[],
  ): Promise<AgentReviewResult>;
}

export interface ReviewPipelineOptions {
  projectNameOrLink: string;
  fileName?: string;
  setupBrowserFn?: typeof setupBrowser;
  goToProjectFn?: typeof goToProject;
  selectFileFn?: typeof selectFile;
  readPaperFn?: typeof readPaper;
  readCommentThreadsFn?: typeof readCommentThreads;
  createAgent?: (toolExecutor: (name: string, args: string | undefined) => Promise<string>) => ReviewAgent;
}

export interface ReviewPipelineResult {
  success: boolean;
  projectNameOrLink: string;
  fileName?: string;
  navigationResult?: string;
  selectFileResult?: string;
  paperContent?: string;
  commentsContent?: string;
  humanReviewerThreads?: CommentThread[];
  agentResult?: AgentReviewResult;
  error?: string;
}

function isSuccessfulRead(content: string): boolean {
  return Boolean(content) && !content.includes("Error:");
}

export async function runReviewPipeline(
  options: ReviewPipelineOptions,
): Promise<ReviewPipelineResult> {
  const {
    projectNameOrLink,
    fileName,
    setupBrowserFn = setupBrowser,
    goToProjectFn = goToProject,
    selectFileFn = selectFile,
    readPaperFn = readPaper,
    readCommentThreadsFn = readCommentThreads,
    createAgent = (toolExecutor) => new OverleafAgent({ toolExecutor }),
  } = options;

  const session = await setupBrowserFn();

  try {
    const toolExecutor = createToolExecutor(session.page);
    const agent = createAgent(toolExecutor);

    const navigationResult = await goToProjectFn(session.page, projectNameOrLink);
    if (navigationResult.includes("Error:")) {
      return {
        success: false,
        projectNameOrLink,
        fileName,
        navigationResult,
        error: navigationResult,
      };
    }

    let selectFileResult: string | undefined;
    if (fileName && fileName.trim().length > 0) {
      selectFileResult = await selectFileFn(session.page, fileName);
      if (selectFileResult.startsWith("Error")) {
        return {
          success: false,
          projectNameOrLink,
          fileName,
          navigationResult,
          selectFileResult,
          error: selectFileResult,
        };
      }
    }

    const paperContent = await readPaperFn(session.page);

    let allThreads: CommentThread[];
    try {
      allThreads = await readCommentThreadsFn(session.page);
    } catch (error) {
      return {
        success: false,
        projectNameOrLink,
        fileName,
        navigationResult,
        selectFileResult,
        paperContent,
        commentsContent: `Error reading comments: ${error}`,
        error: "Failed to read paper or comments correctly.",
      };
    }

    const commentsContent = formatCommentThreads(allThreads);
    const humanReviewerThreads = filterOutAiReviewer(allThreads);

    if (!isSuccessfulRead(paperContent)) {
      return {
        success: false,
        projectNameOrLink,
        fileName,
        navigationResult,
        selectFileResult,
        paperContent,
        commentsContent,
        humanReviewerThreads,
        error: "Failed to read paper or comments correctly.",
      };
    }

    const agentResult = await agent.processReview(
      paperContent,
      commentsContent,
      humanReviewerThreads,
    );

    return {
      success: true,
      projectNameOrLink,
      fileName,
      navigationResult,
      selectFileResult,
      paperContent,
      commentsContent,
      humanReviewerThreads,
      agentResult,
    };
  } finally {
    await cleanupBrowser(session);
  }
}
