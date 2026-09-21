# Contributing to God's Eye

Contributions welcome! Follow these guidelines to keep things smooth.

## Getting Started

1. Fork the repo
2. Clone your fork
3. Create a feature branch: `git checkout -b feat/your-feature`
4. Follow the [Setup](README.md#setup) section in the README to get running locally

## Code Style

### Go

- Run `gofmt` and `go vet` before committing
- Follow standard Go project layout conventions

### TypeScript / React

- Run `pnpm lint` in `packages/frontend` before committing
- Use Prettier for formatting: `pnpm format`
- Follow existing component patterns in `src/components/`

## Commit Messages

Format:

```
<tag>: <Short summary of what was done.>
```

Rules:

- Start with a capital letter and end with a period.
- Keep the summary to 50 characters or less.
- Present tense: describe what the commit does, not what you did.
- No scopes, and no `Co-Authored-By` lines.

Tags: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`

Examples:

- `feat: Add satellite layer toggle.`
- `fix: Handle nil pointer in vessel ingestion.`
- `docs: Update setup instructions.`

Before committing, run `pnpm lint && pnpm format && pnpm typecheck && pnpm test`, plus `go vet ./services/... && go test ./services/...` for Go changes. Stage files explicitly; do not use `git add -A` or `git add .`.

## Pull Requests

- Branch from `main`, PR back to `main`
- Keep PRs focused — one feature or fix per PR
- Include a summary of what changed and why
- Link related issues if applicable
- Ensure tests pass before requesting review

## Reporting Issues

Open a GitHub issue with:

- Clear description of the problem or feature request
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Environment details (OS, browser, Go/Node versions)

## Questions?

Open a discussion or issue — happy to help.
