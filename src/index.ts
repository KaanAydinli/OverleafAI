// Pipeline (high-level)
export { runAIReview } from "./pipeline/runAIReview.js";
export {
  runReviewPipeline,
  type ReviewPipelineOptions,
  type ReviewPipelineResult,
} from "./pipeline/reviewPipeline.js";

// Overleaf extractors
export { extractAuthorsFromOverleaf } from "./overleaf/extractAuthors.js";
export { extractTitleFromOverleaf } from "./overleaf/extractTitle.js";

// Pure LaTeX parsers (no browser needed)
export { parseAuthorsFromLatex } from "./latex/parseAuthors.js";
export { parseTitleFromLatex } from "./latex/parseTitle.js";

// Browser primitives (advanced users wiring custom flows)
export {
  setupBrowser,
  cleanupBrowser,
  type BrowserSession,
} from "./browser/session.js";

// Agent + types
export {
  OverleafAgent,
  type AgentReviewResult,
  type ReviewerScore,
} from "./agent/OverleafAgent.js";
export type {
  CommentThread,
  CommentEntry,
  LineContext,
} from "./overleaf/readComments.js";
