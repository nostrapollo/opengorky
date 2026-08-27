# Contributing to opengorky

Thanks for helping build a fast, local-first visual workspace.

## Before you start

- Search existing issues before opening a new one.
- Keep proposals aligned with the current single-user, local-first scope.
- Discuss large architectural changes in an issue before implementation.
- Never include private canvas files, credentials, or personal data in issues,
  fixtures, screenshots, or commits.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

The app runs at `http://localhost:3000`. Browser data is origin-scoped, so use
JSON export before clearing site data or changing development origins.

## Required verification

Run the complete local suite before opening a pull request:

```bash
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
```

For interaction changes, also test the affected behavior in a browser and
describe the scenario in the pull request.

## Pull requests

- Keep each pull request focused on one coherent change.
- Add or update tests for document-model and persistence behavior.
- Preserve backward compatibility with saved documents or include an explicit
  migration.
- Explain user-visible behavior, verification, and known limitations.
- Do not introduce hosted-service requirements into core functionality.

By contributing, you agree that your contribution will be distributed under
the repository's license once that license is selected. No contributions will
be accepted before a `LICENSE` file is committed.
