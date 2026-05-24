interface JsonSchemaProperty {
  type: "string" | "integer";
  description: string;
}

interface JsonSchemaObject {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
  additionalProperties?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: JsonSchemaObject;
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "post_comment",
    description:
      "Post a comment anchored to a specific verbatim quote from the paper. Provide the EXACT text you want to comment on as 'quoteText' — the system locates that text in the document, scrolls to it, selects it, and attaches the comment. The longer and more distinctive the quote, the more reliably it resolves to a single location. The commentText MUST follow the strict template '[Review] <critique>. [Suggestion] <actionable fix>.' as specified in the system prompt.",
    input_schema: {
      type: "object",
      properties: {
        quoteText: {
          type: "string",
          description:
            "A verbatim, distinctive snippet of text copied directly from the paper that identifies WHERE the comment should be anchored. Must be at least 8 characters and should usually be a full sentence or a long phrase (15–250 characters) so it resolves to a single unique location in the document. Copy the text EXACTLY as it appears in the paper, including punctuation and LaTeX commands; do NOT paraphrase, summarize, or fix typos. Whitespace differences (line breaks, multiple spaces) are tolerated, but every other character must match. If a short quote could occur multiple times, extend it with neighboring words until it is unique. Do NOT pass a line number, line range, or section reference here — only the quoted text itself.",
        },
        commentText: {
          type: "string",
          description:
            "The text of the comment to post. MUST start with the literal '[Review] ' tag containing a concrete critique grounded in the paper, followed by ' [Suggestion] ' containing a concrete, actionable fix. Both tags are required, in this order, with the literal square brackets. Example: '[Review] Table 2 reports 89.1% but the abstract claims 92.4% on the same benchmark. [Suggestion] Reconcile the two numbers or add a sentence explaining the difference.'",
        },
      },
      required: ["quoteText", "commentText"],
      additionalProperties: false,
    },
  },
  {
    name: "post_response_comment",
    description:
      "Post a reply to an existing comment thread specified by its comment index (1-based). Use this to respond to existing comments during your review. The responseText MUST follow the strict template '[Review] <critique or position>. [Suggestion] <actionable next step>.' as specified in the system prompt.",
    input_schema: {
      type: "object",
      properties: {
        commentIndex: {
          type: "integer",
          description: "The 1-indexed comment thread number to reply to",
        },
        responseText: {
          type: "string",
          description:
            "The text of the response. MUST start with the literal '[Review] ' tag containing your specific position on the prior thread (agreement, disagreement, refinement) grounded in concrete content, followed by ' [Suggestion] ' containing a concrete next step for the authors. Both tags are required, in this order, with the literal square brackets. Example: '[Review] I agree with Reviewer 1 that the ablation does not isolate the attention module. [Suggestion] Add an ablation removing only attention while keeping the residual path, and report it in Table 3.'",
        },
      },
      required: ["commentIndex", "responseText"],
      additionalProperties: false,
    },
  },
];
