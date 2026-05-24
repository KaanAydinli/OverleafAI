# overleaf-ai-reviewer

A standalone Node.js library that drives a Claude-powered peer reviewer over a
real Overleaf project. It opens your project in a headless Playwright browser,
reads the LaTeX source and any existing review threads, and posts anchored
review comments back into Overleaf — following a strict
`[Review] … [Suggestion] …` template.

The package also exposes the lower-level building blocks (browser session,
LaTeX parsers, Overleaf page actions) so you can wire your own flows on top.

## Install

```bash
npm install overleaf-ai-reviewer
npx playwright install chromium
```

You will need an Anthropic API key and an Overleaf storage-state JSON
(captured once via the `save-session` script below).

## Environment

| Variable                | Required | Default                | Notes                                                                            |
| ----------------------- | -------- | ---------------------- | -------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`     | yes      | —                      | Used by the agent.                                                               |
| `CLAUDE_MODEL`          | no       | `claude-sonnet-4-5`    | Any Claude model the SDK accepts.                                                |
| `HEADLESS`              | no       | `true`                 | Set to `false` to watch the automation.                                          |
| `MAX_TOOL_CALLS`        | no       | `10`                   | Hard cap on agent tool calls per review. Can also be passed via `new OverleafAgent({ maxToolCalls })`. |
| `OVERLEAF_SESSION_JSON` | no       | —                      | Inline storage-state JSON. Overrides `SESSIONS_DIR`.                             |
| `SESSIONS_DIR`          | no       | `./sessions`           | Where the library looks for a `*.json` storage-state file.                       |

Sessions are loaded with this priority: `OVERLEAF_SESSION_JSON` (parsed
inline) → explicit path passed to `setupBrowser(sessionFile)` → the first
`*.json` file inside `SESSIONS_DIR`.

## One-time session capture

Clone this repo, install, and run:

```bash
npm run save-session
```

A headed browser opens at the Overleaf login page. Log in, then return to the
terminal and press Enter. The script writes `./sessions/session.json`. Point
the library at it via `SESSIONS_DIR` or `OVERLEAF_SESSION_JSON`.

## Usage

### Run the full review pipeline

```ts
import { runAIReview } from "overleaf-ai-reviewer";

const result = await runAIReview(
  "https://www.overleaf.com/project/abc123",
  // optional file name within the project to focus on:
  "main.tex",
);

if (!result.success) {
  console.error(result.error);
} else {
  console.log(`Posted ${result.agentResult?.toolCallCount} comments.`);
  console.log(result.agentResult?.reviewerScores);
}
```

### Pure LaTeX parsers (no browser)

```ts
import { parseAuthorsFromLatex, parseTitleFromLatex } from "overleaf-ai-reviewer";

const latex = `\\title{My Paper}\\author{Alice \\and Bob}`;
parseTitleFromLatex(latex);   // "My Paper"
parseAuthorsFromLatex(latex); // ["Alice", "Bob"]
```

### Scrape title + authors from a live project

```ts
import {
  extractTitleFromOverleaf,
  extractAuthorsFromOverleaf,
} from "overleaf-ai-reviewer";

const title = await extractTitleFromOverleaf("https://www.overleaf.com/project/abc123");
const authors = await extractAuthorsFromOverleaf("https://www.overleaf.com/project/abc123");
```

### Low-level browser session

```ts
import { setupBrowser, cleanupBrowser } from "overleaf-ai-reviewer";

const session = await setupBrowser();
try {
  // session.page is a Playwright Page — drive it however you like.
} finally {
  await cleanupBrowser(session);
}
```

## Package layout

```
src/
  browser/    setupBrowser, cleanupBrowser, BrowserSession
  latex/      parseTitleFromLatex, parseAuthorsFromLatex (pure)
  overleaf/   Playwright actions: goToProject, selectFile, readPaper,
              readComments, postComment, postCommentOnRange,
              postResponseComment, editorScroll, getFullDocText, plus
              the extractTitle/extractAuthors orchestrators
  agent/      OverleafAgent, tool definitions, tool executor, system prompt
  pipeline/   runAIReview + runReviewPipeline (the high-level entry point)
  cli/        saveSession (script, not part of the library API)
  index.ts    public re-exports
```

## License

GNU Affero General Public License v3.0 (AGPL-3.0) — see [LICENSE](./LICENSE).

Copyright (C) 2026 KaanAydinli

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License as published by the Free
Software Foundation, either version 3 of the License, or (at your option) any
later version.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
details.
