import {
  runReviewPipeline,
  type ReviewPipelineResult,
} from "./reviewPipeline.js";

export async function runAIReview(
  projectNameOrLink: string,
  fileName?: string,
): Promise<ReviewPipelineResult> {
  const target = projectNameOrLink.trim();
  if (!target) {
    throw new Error("projectNameOrLink is required");
  }

  const trimmedFileName = fileName?.trim();

  return runReviewPipeline({
    projectNameOrLink: target,
    fileName: trimmedFileName && trimmedFileName.length > 0 ? trimmedFileName : undefined,
  });
}
