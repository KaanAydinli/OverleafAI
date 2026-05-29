# overleaf-ai-reviewer

A Node.js app that drives a Claude-powered peer reviewer over a real Overleaf
project. It opens your project in a headless Playwright browser, reads the
LaTeX source and any existing review threads, and posts anchored review
comments back into Overleaf — following a strict
`[Review] … [Suggestion] …` template.

The codebase also exposes the lower-level building blocks (browser session,
LaTeX parsers, Overleaf page actions) so you can wire your own flows on top.

> ⚠️ **Disclaimer (Educational/Research Use).** This repository is provided for
> educational and research purposes only. It is **not** affiliated with or
> endorsed by Overleaf. It automates browser actions via a captured session,
> and such automation may conflict with the
> [Overleaf Terms of Service](https://www.overleaf.com/legal) or applicable
> policies.
>
> Do not use this project against any service unless you have explicit
> permission and your usage is compliant with that service's terms and all
> applicable laws and agreements. You are solely responsible for your use.

## Getting started

Clone the repo and install dependencies (this also installs the Chromium
build that Playwright drives):

```bash
git clone https://github.com/KaanAydinli/OverleafAI.git
cd OverleafAI
npm install
```

Copy `.env.example` to `.env` and fill in your Anthropic API key. You will
also need an Overleaf storage-state JSON, captured once via the
`save-session` script below.

```bash
cp .env.example .env
npm run save-session
npm run build
```

> Not published to npm. Treat this as application code you run locally — clone
> it, configure it, and run it from the checkout.

## Environment

| Variable                | Required | Default                | Notes                                                                            |
| ----------------------- | -------- | ---------------------- | -------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`     | yes      | —                      | Used by the agent.                                                               |
| `CLAUDE_MODEL`          | no       | `claude-sonnet-4-5`    | Any Claude model the SDK accepts.                                                |
| `HEADLESS`              | no       | `true`                 | Set to `false` to watch the automation.                                          |
| `MAX_TOOL_CALLS`        | no       | `10`                   | Hard cap on agent tool calls per review. Can also be passed via `new OverleafAgent({ maxToolCalls })`. |
| `OVERLEAF_SESSION_JSON` | no       | —                      | Inline storage-state JSON. Overrides `SESSIONS_DIR`.                             |
| `SESSIONS_DIR`          | no       | `./sessions`           | Where the app looks for a `*.json` storage-state file.                           |

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
the app at it via `SESSIONS_DIR` or `OVERLEAF_SESSION_JSON`.

## Usage

> The examples below import from the local source tree. There is no published
> npm package — import paths assume you are working from inside this repo (or
> from a project that has cloned it as a sibling).

### Run the full review pipeline

```ts
import { runAIReview } from "./src/index.js";

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
import { parseAuthorsFromLatex, parseTitleFromLatex } from "./src/index.js";

const latex = `\\title{My Paper}\\author{Alice \\and Bob}`;
parseTitleFromLatex(latex);   // "My Paper"
parseAuthorsFromLatex(latex); // ["Alice", "Bob"]
```

### Scrape title + authors from a live project

```ts
import {
  extractTitleFromOverleaf,
  extractAuthorsFromOverleaf,
} from "./src/index.js";

const title = await extractTitleFromOverleaf("https://www.overleaf.com/project/abc123");
const authors = await extractAuthorsFromOverleaf("https://www.overleaf.com/project/abc123");
```

### Low-level browser session

```ts
import { setupBrowser, cleanupBrowser } from "./src/index.js";

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
  cli/        saveSession (one-off script for capturing an Overleaf session)
  index.ts    re-exports for convenient imports from the rest of the codebase
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
