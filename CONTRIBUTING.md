# Contributing to God's Eye

Contributions welcome! Follow these guidelines to keep things smooth.

## Getting Started

1. Fork the repo
2. Clone your fork
3. Create a feature branch: `git checkout -b feat/your-feature`
4. Follow the [Setup Guide](SETUP.md) to get running locally

## Code Style

### Go

- Run `gofmt` and `go vet` before committing
- Follow standard Go project layout conventions

### TypeScript / React

- Run `pnpm lint` in `packages/frontend` before committing
- Use Prettier for formatting: `pnpm format`
- Follow existing component patterns in `src/components/`

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): short description

Optional longer body explaining the "why".
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:

- `feat(frontend): add satellite layer toggle`
- `fix(api): handle nil pointer in vessel ingestion`
- `docs: update setup instructions`

Keep subject line under 50 characters. Body wraps at 72.

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
