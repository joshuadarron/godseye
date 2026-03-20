# Commit Command

Create a new commit for all uncommitted changes.

---

## Workflow

### 1. Review Changes

```bash
git status && git diff HEAD && git status --porcelain
```

Review what files are:

- Modified (staged and unstaged)
- Untracked (new files)
- Deleted

### 2. Run Quality Checks

Before staging anything, run all quality checks and **abort the commit if any fail**:

```bash
pnpm lint && pnpm format && pnpm typecheck && pnpm test
```

If a check fails, fix the issue first — do not commit broken code. Re-run the checks after fixing until all pass. For Go changes, also run:

```bash
cd services/api && go vet ./... && go test ./...
```

### 3. Stage Files

Add untracked and changed files individually:

```bash
git add <file1> <file2> ...
```

**Do not use `git add -A` or `git add .`** — always add files explicitly to avoid committing sensitive files (.env, credentials, etc.) or unintended changes.

### 4. Create Commit

Write an atomic commit with a tagged message:

```bash
git commit -m "<tag>: <Summary of changes.>"
```

---

## Commit Message Format

### Structure

```
<tag>: <Short summary of what was done.>
```

### Rules

- **Complete sentence** — Start with a capital letter, end with a period.
- **Short** — 50 characters or less for the summary line.
- **Present tense** — Describe what the commit does, not what you did.
- **Specific** — Clearly state what changed.
- **Do NOT add `Co-Authored-By` lines to commit messages.** Commits should contain only the message itself.

### Tags

| Tag        | Use When                                   |
| ---------- | ------------------------------------------ |
| `feat`     | Adding new functionality                   |
| `fix`      | Fixing a bug                               |
| `docs`     | Documentation only changes                 |
| `style`    | Formatting, whitespace, no code change     |
| `refactor` | Code restructuring without behavior change |
| `test`     | Adding or updating tests                   |
| `chore`    | Build scripts, dependencies, tooling       |
| `perf`     | Performance improvements                   |

### Examples

**Good:**

```
feat: Add captive portal detection for Android devices.
fix: Resolve null pointer in chat message handler.
docs: Update deployment guide with troubleshooting section.
refactor: Extract validation logic into separate service.
chore: Update Go dependencies to latest versions.
```

**Bad:**

```
updated stuff                    # Vague, no tag, no punctuation
feat: added new feature          # Lowercase, missing period
Fix bug                          # Missing tag prefix
feat: Add the new user authentication system with OAuth2 support and JWT tokens for session management  # Too long
```

---

## Best Practices

### Atomic Commits

- Each commit should represent **one logical change**.
- If you can describe the change with "and" (e.g., "fix bug and add feature"), split it into two commits.

### Review Before Committing

- Always run `git diff` before committing to verify changes.
- Check for debug code, console.log statements, or commented-out code.
- Ensure no sensitive data (API keys, passwords) is included.

### Commit Frequently

- Small, frequent commits are easier to review and revert.
- Don't bundle unrelated changes together.

### Never Commit

- `.env` files or secrets
- Build artifacts (`dist/`, `node_modules/`)
- IDE-specific files unless in `.gitignore`
- Large binary files

---

## Quick Reference

```bash
# 1. Check status
git status && git diff HEAD

# 2. Run quality checks (abort if any fail)
pnpm lint && pnpm format && pnpm typecheck && pnpm test

# 3. Stage specific files
git add path/to/file1 path/to/file2

# 4. Commit with message
git commit -m "feat: Add new feature description."
```
