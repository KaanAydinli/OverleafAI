# Contributing to overleaf-ai-reviewer

Thanks for your interest in contributing. This document describes how to set
up a local environment, the workflow for proposing changes, and what to keep
in mind when sending a pull request.

## Code of Conduct

By participating in this project you agree to abide by the
[Code of Conduct](./CODE_OF_CONDUCT.md). Please report unacceptable behavior
to the repository owner via a GitHub issue marked `conduct`.

## Local development

Requirements:

- Node.js `>=20`
- An Anthropic API key (`ANTHROPIC_API_KEY`)
- An Overleaf account, used once to capture a Playwright storage-state JSON

Setup:

```bash
git clone https://github.com/KaanAydinli/OverleafAI.git
cd OverleafAI
npm install
cp .env.example .env       # fill in ANTHROPIC_API_KEY
npm run save-session       # one-time browser login; writes ./sessions/session.json
npm run build
```

Useful scripts:

| Script              | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `npm run typecheck` | TypeScript type check, no emit                          |
| `npm run build`     | Compile to `dist/`                                      |
| `npm run save-session` | Launch a headed browser to capture an Overleaf session |

## Workflow

1. Open an issue first for anything non-trivial so the design can be discussed
   before code is written.
2. Fork the repo and create a topic branch from `main`:
   `git checkout -b feat/short-description`.
3. Keep commits focused. Prefer
   [Conventional Commits](https://www.conventionalcommits.org/) style
   (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
4. Before pushing, make sure the project still typechecks and builds:
   ```bash
   npm run typecheck
   npm run build
   ```
5. Open a pull request against `main`. Describe **what** changed and **why**,
   and link any related issue.

## Coding guidelines

- **TypeScript strict mode** is on. Don't suppress errors with `any` or
  `// @ts-ignore` unless you explain why in a comment.
- **No secrets in code or fixtures.** `.env`, `sessions/`, and `dist/` are
  gitignored — keep them that way.
- **No new top-level dependencies** without justification in the PR. Playwright
  and the Anthropic SDK are heavy enough already.
- **Match the existing file layout.** Each Overleaf page action lives in its
  own file under `src/overleaf/`; LaTeX parsers under `src/latex/`; pipeline
  glue under `src/pipeline/`.
- **Public API surface** is whatever `src/index.ts` re-exports. Update it when
  you add something users should be able to call.

## Reporting bugs

Open a GitHub issue with:

- What you ran (command + relevant env vars, redacted).
- What you expected.
- What actually happened, including stack traces and Playwright logs if
  available.
- Node version (`node -v`) and OS.

**Never paste real Overleaf cookies, session JSON, or Anthropic API keys into
an issue.** Redact them.

## Security

If you find a security issue (for example, something that could leak a user's
Overleaf session or API key), please **do not** open a public issue. Email the
repository owner via the address listed on the GitHub profile, or open a
private security advisory through GitHub.

## License

By contributing, you agree that your contributions will be licensed under the
[AGPL-3.0-or-later](./LICENSE) license that covers this project.
